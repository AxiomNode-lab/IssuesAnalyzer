import { describe, expect, it } from "vitest";

import {
  SCORE_VERSION,
  calculateOpportunityScore,
  type OpportunityScoreInput,
  type ScoreComponentInput,
} from "./index.js";

function component(
  key: ScoreComponentInput["key"],
  score: number,
  confidence = 80,
): ScoreComponentInput {
  return {
    key,
    score,
    confidence: {
      level: confidence >= 75 ? "high" : confidence >= 45 ? "medium" : "low",
      value: confidence,
    },
    evidenceKeys: [`${key}.evidence`],
    reason: `${key} reason`,
    warnings: [],
  };
}

function input(
  activity = 80,
  competition = 20,
  responsiveness = 80,
  actionability = 80,
): OpportunityScoreInput {
  return {
    components: [
      component("responsiveness", responsiveness),
      component("activity", activity),
      component("competition", competition),
      component("actionability", actionability),
    ],
  };
}

describe("calculateOpportunityScore", () => {
  it("produces a versioned, explainable score in canonical component order", () => {
    const result = calculateOpportunityScore(input());
    expect(result.version).toBe(SCORE_VERSION);
    expect(result.score).toBe(80);
    expect(result.decision).toBe("pursue");
    expect(result.components.map((item) => item.key)).toEqual([
      "activity",
      "competition",
      "responsiveness",
      "actionability",
    ]);
    expect(result.components[1]).toMatchObject({
      rawScore: 20,
      normalizedScore: 80,
      weight: 0.2,
      weightedPoints: 16,
    });
  });

  it("inverts competition because higher analyzer values mean more risk", () => {
    expect(calculateOpportunityScore(input(50, 0, 50, 50)).score).toBe(60);
    expect(calculateOpportunityScore(input(50, 100, 50, 50)).score).toBe(40);
  });

  it("prevents zero competition from overpowering stale evidence via the explicit guardrail", () => {
    const result = calculateOpportunityScore({
      ...input(41, 0, 50, 85),
      hardWarnings: [
        {
          key: "stale_opportunity_uncertain_maintainers",
          evidenceKeys: ["repository.latestActivityAt", "responsiveness.sampleSize"],
          reason: "Repository activity is stale and maintainer evidence is insufficient.",
        },
      ],
    });
    expect(result.uncappedScore).toBeGreaterThanOrEqual(70);
    expect(result.score).toBe(69);
    expect(result.decision).toBe("review_carefully");
  });

  it("caps an active linked implementation below Pursue", () => {
    const result = calculateOpportunityScore({
      ...input(84, 80, 25, 85),
      hardWarnings: [
        {
          key: "active_competing_implementation",
          evidenceKeys: ["competition.activePullRequestCount"],
          reason: "An active linked pull request already implements this issue.",
        },
      ],
    });
    expect(result.uncappedScore).toBe(60);
    expect(result.score).toBe(49);
    expect(result.decision).toBe("review_carefully");
  });

  it("uses a stricter cap when the issue is assigned and has active implementation work", () => {
    const result = calculateOpportunityScore({
      ...input(84, 80, 25, 85),
      hardWarnings: [
        {
          key: "assigned_active_competing_implementation",
          evidenceKeys: ["issue.assigneeCount", "competition.activePullRequestCount"],
          reason: "The issue is assigned and active implementation work is already visible.",
        },
      ],
    });
    expect(result.score).toBe(39);
    expect(result.decision).toBe("skip");
  });

  it("prevents incomplete competition evidence from producing Pursue", () => {
    const result = calculateOpportunityScore({
      ...input(80, 0, 80, 90),
      hardWarnings: [
        {
          key: "competition_evidence_incomplete",
          evidenceKeys: ["competition.activePullRequestCount"],
          reason: "Competition evidence is incomplete, so zero visible work is not conclusive.",
        },
      ],
    });
    expect(result.uncappedScore).toBeGreaterThanOrEqual(70);
    expect(result.score).toBe(69);
    expect(result.decision).toBe("review_carefully");
  });

  it("preserves component warnings and calculates weighted confidence", () => {
    const source = input();
    const components = source.components.map((item, index) => ({
      ...item,
      confidence: { level: "low" as const, value: index === 0 ? 10 : 20 },
      warnings: [`${item.key} warning`],
    }));
    const result = calculateOpportunityScore({ components });
    expect(result.confidence.level).toBe("low");
    expect(result.warnings).toHaveLength(4);
  });

  it.each([
    ["repository_archived", 0],
    ["repository_disabled", 0],
    ["issue_closed", 20],
    ["issue_low_actionability", 39],
    ["stale_opportunity_uncertain_maintainers", 69],
    ["active_competing_implementation", 49],
    ["assigned_active_competing_implementation", 39],
    ["competition_evidence_incomplete", 69],
  ] as const)("applies the %s hard-warning cap", (key, cap) => {
    const result = calculateOpportunityScore({
      ...input(100, 0, 100, 100),
      hardWarnings: [{ key, evidenceKeys: ["repository.state"], reason: "Guardrail." }],
    });
    expect(result.score).toBe(cap);
  });

  it("uses the strictest cap when several hard warnings apply", () => {
    const result = calculateOpportunityScore({
      ...input(100, 0, 100),
      hardWarnings: [
        { key: "issue_closed", evidenceKeys: ["issue.state"], reason: "Issue is closed." },
        {
          key: "repository_archived",
          evidenceKeys: ["repository.archived"],
          reason: "Repository is archived.",
        },
      ],
    });
    expect(result.score).toBe(0);
  });

  it("keeps scores bounded for all integer component values", () => {
    for (let score = 0; score <= 100; score += 1) {
      const result = calculateOpportunityScore(input(score, score, score));
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    }
  });

  it("preserves monotonic scoring invariants", () => {
    for (let score = 0; score < 100; score += 1) {
      expect(calculateOpportunityScore(input(score + 1, 50, 50)).score).toBeGreaterThanOrEqual(
        calculateOpportunityScore(input(score, 50, 50)).score,
      );
      expect(calculateOpportunityScore(input(50, 50, score + 1)).score).toBeGreaterThanOrEqual(
        calculateOpportunityScore(input(50, 50, score)).score,
      );
      expect(calculateOpportunityScore(input(50, 50, 50, score + 1)).score).toBeGreaterThanOrEqual(
        calculateOpportunityScore(input(50, 50, 50, score)).score,
      );
      expect(calculateOpportunityScore(input(50, score + 1, 50)).score).toBeLessThanOrEqual(
        calculateOpportunityScore(input(50, score, 50)).score,
      );
    }
  });

  it("rejects missing and duplicate components", () => {
    expect(() =>
      calculateOpportunityScore({
        components: [
          component("activity", 50),
          component("competition", 50),
          component("responsiveness", 50),
        ],
      }),
    ).toThrow(
      "Exactly one activity, competition, responsiveness, and actionability component is required.",
    );

    expect(() =>
      calculateOpportunityScore({
        components: [
          component("activity", 50),
          component("activity", 50),
          component("responsiveness", 50),
          component("actionability", 50),
        ],
      }),
    ).toThrow("Duplicate component: activity.");
  });
});
