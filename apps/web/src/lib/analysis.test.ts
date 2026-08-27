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

function evidenceClient() {
  return {
    getIssue: vi.fn(async () =>
      response({
        id: 27888,
        number: 27888,
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
        htmlUrl: referenceUrl,
      }),
    ),
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
    listIssueComments: vi.fn(async () =>
      response([
        {
          id: 2,
          body: "I can review this.",
          author: { login: "maintainer", profileUrl: "https://github.com/maintainer" },
          authorAssociation: "MEMBER" as const,
          createdAt: new Date("2026-08-02T10:00:00.000Z"),
          updatedAt: new Date("2026-08-02T10:00:00.000Z"),
          htmlUrl: `${referenceUrl}#issuecomment-2`,
        },
      ]),
    ),
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

describe("live analysis orchestration", () => {
  it("validates, collects real-shaped evidence, invokes every analyzer, and maps the score report", async () => {
    const client = evidenceClient();
    const analyze = createAnalysisService({ client, now: () => asOf });

    const report = await analyze(referenceUrl);

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
    for (const method of Object.values(client)) expect(method).toHaveBeenCalledOnce();
  });

  it("allows an active, unopposed, concrete coding task to produce Pursue", async () => {
    const client = evidenceClient();
    client.getIssue.mockResolvedValueOnce(
      response({
        ...(await evidenceClient().getIssue()).data,
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
        ...(await evidenceClient().getIssue()).data,
        title: 'Improve how we handle active "good first issue" issues',
        labels: ["meta", "discuss"],
        body: `### Potential improvements
There are several approaches worth considering. I'd be happy to hear other approaches though.
#### 1. Use a different label
#### 2. Remove the label when a PR exists
#### 3. Create a claim system`,
      }),
    );
    const report = await createAnalysisService({ client, now: () => asOf })(referenceUrl);
    expect(report.verdict).not.toBe("pursue");
    expect(report.score).toBeLessThanOrEqual(39);
    expect(report.decisionReason).toContain("low-actionability discussion");
  });

  it("does not permanently gate a discussion after an accepted implementation direction", async () => {
    const client = evidenceClient();
    client.getIssue.mockResolvedValueOnce(
      response({
        ...(await evidenceClient().getIssue()).data,
        title: "Meta: select parser behavior",
        labels: ["meta", "discuss"],
        body: "We have decided on the strict parser. Please implement `parseInput`. Expected behavior: return a typed error.",
      }),
    );
    const report = await createAnalysisService({ client, now: () => asOf })(referenceUrl);
    expect(report.score).toBeGreaterThan(39);
    expect(report.risks).not.toContainEqual(expect.stringContaining("low-actionability"));
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
    expect(competition.facts).toContainEqual(
      expect.objectContaining({ label: "Active linked pull requests", value: "1" }),
    );
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
    for (const method of Object.values(client)) expect(method).toHaveBeenCalledOnce();
  });

  it.each(["not_found", "rate_limited"] as const)(
    "surfaces a primary GitHub %s failure",
    async (kind) => {
      const client = evidenceClient();
      client.getIssue.mockRejectedValueOnce(new GitHubClientError(kind, "upstream failure"));
      const analyze = createAnalysisService({ client, now: () => asOf });

      await expect(analyze(referenceUrl)).rejects.toMatchObject({ kind });
    },
  );

  it("marks missing secondary evidence as partial without fabricating it", async () => {
    const client = evidenceClient();
    client.listIssueComments.mockRejectedValueOnce(new GitHubClientError("not_found", "missing"));
    client.listRecentCommits.mockRejectedValueOnce(new GitHubClientError("not_found", "missing"));
    const analyze = createAnalysisService({ client, now: () => asOf });

    const report = await analyze(referenceUrl);

    expect(report.partial).toBe(true);
    expect(report.risks).toContain("Commit evidence is unavailable.");
    expect(report.risks).toContain("Historical responsiveness evidence is unavailable.");
  });

  it.each(["invalid_payload", "rate_limited", "network"] as const)(
    "does not hide a secondary GitHub %s failure when no stale report exists",
    async (kind) => {
      const client = evidenceClient();
      client.listIssueComments.mockRejectedValueOnce(new GitHubClientError(kind, "failure"));
      const analyze = createAnalysisService({ client, now: () => asOf });

      await expect(analyze(referenceUrl)).rejects.toMatchObject({ kind });
    },
  );
});
