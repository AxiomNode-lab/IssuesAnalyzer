import { GitHubClientError, StaleWhileRevalidateCache } from "@opportunity-radar/github-client";
import type {
  GitHubIssueEvent,
  GitHubQuota,
  GitHubResponse,
} from "@opportunity-radar/github-client";
import { describe, expect, it, vi } from "vitest";

import { createAnalysisService, InvalidAnalysisInputError } from "./analysis";

const asOf = new Date("2026-08-27T12:00:00.000Z");
const referenceUrl = "https://github.com/sympy/sympy/issues/27888";
const quota: GitHubQuota = { limit: 5000, remaining: 4900, used: 100, resetAt: asOf };

function response<T>(data: T): GitHubResponse<T> {
  return { data, quota, requestId: "request-id" };
}

function issue(number = 27888) {
  return {
    id: number,
    number,
    title: "Real issue title",
    body: "Issue body",
    state: "open" as const,
    locked: false,
    comments: 2,
    author: { login: "reporter", profileUrl: "https://github.com/reporter" },
    labels: ["bug"],
    assignees: [],
    createdAt: new Date("2026-08-01T10:00:00.000Z"),
    updatedAt: new Date("2026-08-20T10:00:00.000Z"),
    closedAt: null,
    htmlUrl: `https://github.com/sympy/sympy/issues/${number}`,
  };
}

function maintainerComment(issueNumber = 1) {
  return {
    id: issueNumber,
    body: "I can review this.",
    author: { login: "maintainer", profileUrl: "https://github.com/maintainer" },
    authorAssociation: "MEMBER" as const,
    createdAt: new Date("2026-08-02T10:00:00.000Z"),
    updatedAt: new Date("2026-08-02T10:00:00.000Z"),
    htmlUrl: `https://github.com/sympy/sympy/issues/${issueNumber}#comment`,
  };
}

function evidenceClient() {
  return {
    getIssue: vi.fn(async () => response(issue())),
    getRepository: vi.fn(async () =>
      response({
        id: 1,
        fullName: "sympy/sympy",
        htmlUrl: "https://github.com/sympy/sympy",
        description: "Computer algebra",
        archived: false,
        disabled: false,
        fork: false,
        defaultBranch: "master",
        stars: 100,
        forks: 20,
        openIssues: 10,
        createdAt: new Date("2010-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-08-26T00:00:00.000Z"),
        pushedAt: new Date("2026-08-26T00:00:00.000Z"),
      }),
    ),
    listIssueComments: vi.fn(async () => response([maintainerComment(27888)])),
    listIssueCommentsByNumber: vi.fn(
      async (
        _reference: Readonly<{ owner: string; repository: string }>,
        _issueNumber: number,
      ) => response([maintainerComment()]),
    ),
    listRecentIssues: vi.fn(async () => response<readonly ReturnType<typeof issue>[]>([])),
    listRecentCommits: vi.fn(async () =>
      response([
        {
          sha: "abc",
          htmlUrl: "https://github.com/sympy/sympy/commit/abc",
          committedAt: new Date("2026-08-26T00:00:00.000Z"),
        },
      ]),
    ),
    listRecentReleases: vi.fn(async () => response([])),
    getCommunityProfile: vi.fn(async () =>
      response({
        healthPercentage: 90,
        sourceUrl: "https://github.com/sympy/sympy/community",
        contributingGuide: true,
        codeOfConduct: true,
        issueTemplate: true,
        pullRequestTemplate: true,
      }),
    ),
    listIssueTimeline: vi.fn(async () => response<GitHubIssueEvent[]>([])),
    listRecentPullRequests: vi.fn(async () => response([])),
  };
}

function expectPrimaryEvidenceCalls(client: ReturnType<typeof evidenceClient>, times = 1) {
  expect(client.getIssue).toHaveBeenCalledTimes(times);
  expect(client.getRepository).toHaveBeenCalledTimes(times);
  expect(client.listIssueComments).toHaveBeenCalledTimes(times);
  expect(client.listRecentIssues).toHaveBeenCalledTimes(times);
  expect(client.listRecentCommits).toHaveBeenCalledTimes(times);
  expect(client.listRecentReleases).toHaveBeenCalledTimes(times);
  expect(client.getCommunityProfile).toHaveBeenCalledTimes(times);
  expect(client.listIssueTimeline).toHaveBeenCalledTimes(times);
  expect(client.listRecentPullRequests).toHaveBeenCalledTimes(times);
}

describe("live analysis orchestration", () => {
  it("validates, collects real-shaped evidence, invokes every analyzer, and maps the score report", async () => {
    const client = evidenceClient();
    const report = await createAnalysisService({ client, now: () => asOf })(referenceUrl);

    expect(report).toMatchObject({
      repository: "sympy/sympy",
      issueNumber: 27888,
      issueTitle: "Real issue title",
      issueUrl: referenceUrl,
      scoreVersion: "opportunity-score-v2",
      stale: false,
    });
    expect(report.components.map((component) => component.key)).toEqual([
      "activity",
      "competition",
      "responsiveness",
      "actionability",
    ]);
    expect(report.components.every((component) => Number.isInteger(component.score))).toBe(true);
    expectPrimaryEvidenceCalls(client);
  });

  it("collects a bounded multi-thread responsiveness sample", async () => {
    const client = evidenceClient();
    const historical = Array.from({ length: 12 }, (_, index) => ({
      ...issue(index + 1),
      createdAt: new Date(`2026-08-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`),
    }));
    client.listRecentIssues.mockResolvedValueOnce(response(historical));
    client.listIssueCommentsByNumber.mockImplementation(async (_reference, issueNumber) =>
      response([
        {
          ...maintainerComment(issueNumber),
          createdAt: new Date(`2026-08-${String(issueNumber).padStart(2, "0")}T12:00:00.000Z`),
        },
      ]),
    );

    const report = await createAnalysisService({ client, now: () => asOf })(referenceUrl);
    const responsiveness = report.components.find(
      (component) => component.key === "responsiveness",
    )!;

    expect(client.listIssueCommentsByNumber).toHaveBeenCalledTimes(12);
    expect(responsiveness.facts).toContainEqual(
      expect.objectContaining({ label: "Historical sample", value: "12" }),
    );
    expect(responsiveness.confidence).toBe("high");
  });

  it("allows an active, unopposed, concrete coding task to produce Pursue", async () => {
    const client = evidenceClient();
    client.getIssue.mockResolvedValueOnce(
      response({
        ...issue(),
        title: "Fix parser behavior for empty input",
        body: "Steps to reproduce: call `parseInput`. Expected behavior: return an empty result.",
        labels: ["bug", "good first issue"],
      }),
    );
    const report = await createAnalysisService({ client, now: () => asOf })(referenceUrl);
    expect(report.verdict).toBe("pursue");
  });

  it("gates a Node.js-style unresolved policy discussion so it cannot produce Pursue", async () => {
    const client = evidenceClient();
    client.getIssue.mockResolvedValueOnce(
      response({
        ...issue(),
        title: 'Improve how we handle active "good first issue" issues',
        labels: ["meta", "discuss"],
        body: `### Potential improvements\nThere are several approaches worth considering. I'd be happy to hear other approaches though.\n#### 1. Use a different label\n#### 2. Remove the label when a PR exists\n#### 3. Create a claim system`,
      }),
    );
    const report = await createAnalysisService({ client, now: () => asOf })(referenceUrl);
    expect(report.verdict).not.toBe("pursue");
    expect(report.score).toBeLessThanOrEqual(39);
  });

  it("caps a stale repository with insufficient maintainer evidence below Pursue", async () => {
    const client = evidenceClient();
    client.getRepository.mockResolvedValueOnce(
      response({
        ...(await evidenceClient().getRepository()).data,
        updatedAt: new Date("2025-11-01T00:00:00.000Z"),
        pushedAt: new Date("2025-11-01T00:00:00.000Z"),
      }),
    );
    client.listRecentCommits.mockResolvedValueOnce(response([]));
    const report = await createAnalysisService({ client, now: () => asOf })(referenceUrl);
    expect(report.verdict).toBe("review_carefully");
    expect(report.score).toBeLessThanOrEqual(69);
    expect(report.decisionReason).toContain("repository activity is stale");
  });

  it("counts a SymPy-style active timeline PR instead of reporting zero linked work", async () => {
    const client = evidenceClient();
    client.listIssueTimeline.mockResolvedValueOnce(
      response([
        {
          nodeId: "event-1",
          event: "cross-referenced",
          actor: null,
          createdAt: new Date("2026-08-25T00:00:00.000Z"),
          sourceUrl: referenceUrl,
          referencedPullRequest: {
            number: 29942,
            title: "Implement refine handler",
            state: "open" as const,
            draft: true,
            author: { login: "contributor", profileUrl: "https://github.com/contributor" },
            createdAt: new Date("2026-08-20T00:00:00.000Z"),
            updatedAt: new Date("2026-08-25T00:00:00.000Z"),
            closedAt: null,
            mergedAt: null,
            htmlUrl: "https://github.com/sympy/sympy/pull/29942",
          },
        },
      ]),
    );
    const report = await createAnalysisService({ client, now: () => asOf })(referenceUrl);
    const competition = report.components.find((component) => component.key === "competition")!;
    expect(competition.score).toBe(80);
  });

  it("rejects unsafe URLs before calling GitHub", async () => {
    const client = evidenceClient();
    const analyze = createAnalysisService({ client });
    await expect(analyze("https://github.com.evil.test/o/r/issues/1")).rejects.toBeInstanceOf(
      InvalidAnalysisInputError,
    );
    expect(client.getIssue).not.toHaveBeenCalled();
  });

  it("deduplicates equivalent concurrent requests", async () => {
    const client = evidenceClient();
    const analyze = createAnalysisService({
      client,
      cache: new StaleWhileRevalidateCache(),
      now: () => asOf,
    });
    const [first, second] = await Promise.all([analyze(referenceUrl), analyze(referenceUrl)]);
    expect(first).toEqual(second);
    expectPrimaryEvidenceCalls(client);
  });

  it.each(["not_found", "rate_limited"] as const)(
    "surfaces a primary GitHub %s failure",
    async (kind) => {
      const client = evidenceClient();
      client.getIssue.mockRejectedValueOnce(new GitHubClientError(kind, "upstream failure"));
      await expect(
        createAnalysisService({ client, now: () => asOf })(referenceUrl),
      ).rejects.toMatchObject({ kind });
    },
  );

  it("marks missing secondary evidence as partial without fabricating it", async () => {
    const client = evidenceClient();
    client.listRecentIssues.mockRejectedValueOnce(new GitHubClientError("not_found", "missing"));
    client.listRecentCommits.mockRejectedValueOnce(new GitHubClientError("not_found", "missing"));
    const report = await createAnalysisService({ client, now: () => asOf })(referenceUrl);
    expect(report.partial).toBe(true);
    expect(report.risks).toContain("Commit evidence is unavailable.");
    expect(report.risks).toContain("Historical responsiveness evidence is unavailable.");
  });

  it.each(["invalid_payload", "rate_limited", "network"] as const)(
    "does not hide a secondary GitHub %s failure when no stale report exists",
    async (kind) => {
      const client = evidenceClient();
      client.listRecentIssues.mockRejectedValueOnce(new GitHubClientError(kind, "failure"));
      await expect(
        createAnalysisService({ client, now: () => asOf })(referenceUrl),
      ).rejects.toMatchObject({ kind });
    },
  );
});
