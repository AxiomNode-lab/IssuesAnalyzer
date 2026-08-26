import { describe, expect, it } from "vitest";

import {
  analyzeCompetition,
  type CommentEvidence,
  type CompetitionInput,
  type PullRequestEvidence,
  type TimelineEvidence,
} from "./index";

const asOf = new Date("2026-08-26T00:00:00.000Z");
const issueUrl = "https://github.com/example/project/issues/42";
const actor = (login: string) => ({ login, profileUrl: `https://github.com/${login}` });
const comment = (body: string | null, login = "contributor"): CommentEvidence => ({
  author: actor(login),
  body,
  createdAt: new Date("2026-08-25T00:00:00.000Z"),
  sourceUrl: `${issueUrl}#issuecomment-1`,
});
const event = (name: string): TimelineEvidence => ({
  event: name,
  actor: actor("contributor"),
  createdAt: new Date("2026-08-25T00:00:00.000Z"),
  sourceUrl: issueUrl,
});
const pullRequest = (body: string | null, title = "Fix"): PullRequestEvidence => ({
  number: 7,
  title,
  body,
  state: "open",
  draft: false,
  author: actor("contributor"),
  createdAt: new Date("2026-08-24T00:00:00.000Z"),
  updatedAt: new Date("2026-08-25T00:00:00.000Z"),
  closedAt: null,
  mergedAt: null,
  sourceUrl: "https://github.com/example/project/pull/7",
});

function input(overrides: Partial<CompetitionInput> = {}): CompetitionInput {
  return {
    asOf,
    issue: {
      number: 42,
      canonicalUrl: issueUrl,
      authorLogin: "maintainer",
      assignees: [],
    },
    comments: [],
    timeline: [],
    pullRequests: [],
    ...overrides,
  };
}

describe("analyzeCompetition", () => {
  it("reports visible competition for an assigned issue", () => {
    const result = analyzeCompetition(
      input({ issue: { ...input().issue, assignees: [actor("developer")] } }),
    );
    expect(result.status).toBe("visible");
    expect(result.score).toBe(75);
    expect(result.inferences).toContainEqual(
      expect.objectContaining({ key: "competition.assigned" }),
    );
  });

  it("recognizes only pull requests that explicitly reference the issue", () => {
    const result = analyzeCompetition(
      input({
        pullRequests: [
          pullRequest("Closes #42"),
          { ...pullRequest("Unrelated change"), number: 8, sourceUrl: "https://example.test/pr/8" },
        ],
      }),
    );
    expect(result.status).toBe("visible");
    expect(result.score).toBe(90);
    expect(result.facts).toContainEqual(
      expect.objectContaining({ key: "competition.linkedPullRequestCount", value: 1 }),
    );
  });

  it("treats claim language as a cautious possible signal", () => {
    const result = analyzeCompetition(input({ comments: [comment("I'd like to work on this")] }));
    expect(result.status).toBe("possible");
    expect(result.score).toBe(50);
    expect(result.inferences).toContainEqual(
      expect.objectContaining({
        key: "competition.claimLanguage",
        caution: expect.stringContaining("intent only"),
      }),
    );
  });

  it("ignores bot and issue-author claim comments", () => {
    const result = analyzeCompetition(
      input({
        comments: [
          comment("I am working on this", "automation[bot]"),
          comment("I am working on this", "maintainer"),
        ],
      }),
    );
    expect(result.status).toBe("none_visible");
    expect(result.score).toBe(0);
  });

  it("never treats no visible signals as guaranteed availability", () => {
    const result = analyzeCompetition(input());
    expect(result.status).toBe("none_visible");
    expect(result.inferences).toContainEqual(
      expect.objectContaining({
        key: "competition.noneVisible",
        caution: expect.stringContaining("does not guarantee"),
      }),
    );
  });

  it("returns uncertain and lowers confidence when bounded sources are unavailable", () => {
    const result = analyzeCompetition(
      input({ comments: null, timeline: null, pullRequests: null }),
    );
    expect(result.status).toBe("uncertain");
    expect(result.confidence).toEqual({ level: "low", value: 25 });
    expect(result.warnings).toHaveLength(3);
  });

  it("uses relevant timeline references as possible evidence", () => {
    const result = analyzeCompetition(input({ timeline: [event("cross-referenced")] }));
    expect(result.status).toBe("possible");
    expect(result.score).toBe(35);
  });

  it("bounds every evidence window after selecting newest records", () => {
    const comments = Array.from({ length: 510 }, (_, index) => ({
      ...comment(null),
      sourceUrl: `${issueUrl}#issuecomment-${index}`,
      createdAt: new Date(asOf.getTime() - index * 1_000),
    }));
    const timeline = Array.from({ length: 310 }, (_, index) => ({
      ...event("labeled"),
      sourceUrl: `${issueUrl}#event-${index}`,
      createdAt: new Date(asOf.getTime() - index * 1_000),
    }));
    const pullRequests = Array.from({ length: 110 }, (_, index) => ({
      ...pullRequest(null),
      number: index + 1,
      sourceUrl: `https://github.com/example/project/pull/${index + 1}`,
      updatedAt: new Date(asOf.getTime() - index * 1_000),
    }));

    const result = analyzeCompetition(input({ comments, timeline, pullRequests }));
    expect(result.evidenceWindow).toEqual({
      commentsUsed: 500,
      timelineEventsUsed: 300,
      pullRequestsUsed: 100,
    });
    expect(result.warnings).toHaveLength(3);
  });

  it("rejects future evidence and remains deterministic", () => {
    expect(() =>
      analyzeCompetition(
        input({
          comments: [
            {
              ...comment("working on this"),
              createdAt: new Date("2026-08-27T00:00:00.000Z"),
            },
          ],
        }),
      ),
    ).toThrow(new RangeError("comment date cannot be after asOf."));
    expect(analyzeCompetition(input())).toEqual(analyzeCompetition(input()));
  });

  it("adds provenance and freshness to every fact", () => {
    const result = analyzeCompetition(input({ comments: [comment("Can I work on this?")] }));
    for (const fact of result.facts) {
      expect(fact.sourceUrl).not.toBe("");
      expect(fact.observedAt).toEqual(asOf);
      expect(fact.freshnessDays).toBeGreaterThanOrEqual(0);
    }
  });
});
