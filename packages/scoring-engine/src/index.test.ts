import { describe, expect, it } from "vitest";

import {
  SCORE_VERSION,
  SCORE_WEIGHTS,
  calibrateOpportunityScore,
  calculateOpportunityScore,
  type OpportunityScoreInput,
  type ScoreComponentInput,
} from "./index.js";

function component(
  key: ScoreComponentInput["key"],
  score: number,
  confidence = 80,
  evidenceKeys: readonly string[] = [`${key}.evidence`],
): ScoreComponentInput {
  return {
    key,
    score,
    confidence: {
      level: confidence >= 75 ? "high" : confidence >= 45 ? "medium" : "low",
      value: confidence,
    },
    evidenceKeys,
    reason: `${key} reason`,
    warnings: [],
  };
}

function input(
  activity = 80,
  competitionRisk = 20,
  responsiveness = 80,
  actionability = 80,
): OpportunityScoreInput {
  return {
    components: [
      component("responsiveness", responsiveness),
      component("activity", activity),
      component("competition", competitionRisk),
      component("actionability", actionability),
    ],
  };
}

describe("calibrateOpportunityScore", () => {
  it("is an identity calibration in v4", () => {
    expect(calibrateOpportunityScore(0)).toBe(0);
    expect(calibrateOpportunityScore(50)).toBe(50);
    expect(calibrateOpportunityScore(86)).toBe(86);
    expect(calibrateOpportunityScore(100)).toBe(100);
  });

  it("bounds non-integer inputs", () => {
    expect(calibrateOpportunityScore(-5)).toBe(0);
    expect(calibrateOpportunityScore(101)).toBe(100);
    expect(calibrateOpportunityScore(72.4)).toBe(72);
  });
});

describe("calculateOpportunityScore", () => {
  it("produces an auditable weighted score without nonlinear tail inflation", () => {
    const result = calculateOpportunityScore(input());
    expect(result.version).toBe(SCORE_VERSION);
    expect(result.baseScore).toBe(80);
    expect(result.calibratedScore).toBe(80);
    expect(result.score).toBe(80);
    expect(result.components.map((item) => item.key)).toEqual([
      "activity",
      "competition",
      "responsiveness",
      "actionability",
    ]);
    expect(Object.fromEntries(result.components.map(({ key, weight }) => [key, weight]))).toEqual(
      SCORE_WEIGHTS,
    );
  });

  it("converts competition risk to contributor availability before weighting", () => {
    expect(calculateOpportunityScore(input(50, 0, 50, 50)).score).toBeGreaterThan(
      calculateOpportunityScore(input(50, 100, 50, 50)).score,
    );
  });

  it("keeps confidence separate from opportunity score", () => {
    const source = input();
    const components = source.components.map((item) => ({
      ...item,
      confidence: { level: "low" as const, value: 20 },
    }));
    const result = calculateOpportunityScore({ components });
    expect(result.score).toBe(80);
    expect(result.confidence.level).toBe("low");
  });

  it("applies evidence-based risk adjustments after the positive score", () => {
    const source = input(95, 0, 90, 90);
    const components = source.components.map((item) =>
      item.key === "actionability"
        ? {
            ...item,
            evidenceKeys: [
              ...item.evidenceKeys,
              "actionability.unresolvedMaintainerDecision",
              "actionability.researchRisk",
            ],
          }
        : item,
    );
    const result = calculateOpportunityScore({ components });
    expect(result.baseScore).toBe(92);
    expect(result.adjustmentsApplied.map((item) => item.key)).toEqual([
      "unresolved_maintainer_decision",
      "research_or_architecture_required",
    ]);
    expect(result.uncappedScore).toBe(67);
    expect(result.score).toBe(67);
    expect(result.decision).toBe("review_carefully");
  });

  it("penalizes trivial contribution value independently from actionability", () => {
    const source = input(95, 0, 80, 100);
    const components = source.components.map((item) =>
      item.key === "actionability"
        ? {
            ...item,
            evidenceKeys: [...item.evidenceKeys, "actionability.trivialContribution"],
          }
        : item,
    );
    const result = calculateOpportunityScore({ components });
    expect(result.adjustmentsApplied).toContainEqual(
      expect.objectContaining({ key: "trivial_low_value_contribution", points: -15 }),
    );
    expect(result.score).toBeLessThan(result.baseScore);
  });

  it("caps an active linked implementation at 20 even when all positive signals are perfect", () => {
    const result = calculateOpportunityScore({
      ...input(100, 0, 100, 100),
      hardWarnings: [
        {
          key: "active_competing_implementation",
          evidenceKeys: ["competition.activePullRequestCount"],
          reason: "An active linked pull request already implements this issue.",
        },
      ],
    });
    expect(result.score).toBe(20);
    expect(result.decision).toBe("skip");
  });

  it("uses a stricter cap when assignment and active implementation are both visible", () => {
    const result = calculateOpportunityScore({
      ...input(100, 0, 100, 100),
      hardWarnings: [
        {
          key: "assigned_active_competing_implementation",
          evidenceKeys: ["issue.assigneeCount", "competition.activePullRequestCount"],
          reason: "The issue is assigned and active implementation work is already visible.",
        },
      ],
    });
    expect(result.score).toBe(15);
    expect(result.decision).toBe("skip");
  });

  it("treats closed, archived, and disabled work as ineligible", () => {
    for (const key of ["issue_closed", "repository_archived", "repository_disabled"] as const) {
      const result = calculateOpportunityScore({
        ...input(100, 0, 100, 100),
        hardWarnings: [{ key, evidenceKeys: ["state"], reason: "Unavailable." }],
      });
      expect(result.score).toBe(0);
    }
  });

  it("keeps incomplete evidence as confidence information rather than a score penalty", () => {
    const source = input(90, 0, 90, 90);
    const result = calculateOpportunityScore({
      components: source.components.map((item) =>
        item.key === "competition"
          ? { ...item, confidence: { level: "medium" as const, value: 55 } }
          : item,
      ),
      hardWarnings: [
        {
          key: "competition_evidence_incomplete",
          evidenceKeys: ["competition.activePullRequestCount"],
          reason: "Competition evidence is incomplete.",
        },
      ],
    });
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.confidence.value).toBeLessThan(80);
  });

  it("uses the strictest hard cap after adjustments", () => {
    const source = input(100, 0, 100, 100);
    const components = source.components.map((item) =>
      item.key === "actionability"
        ? {
            ...item,
            evidenceKeys: [...item.evidenceKeys, "actionability.trivialContribution"],
          }
        : item,
    );
    const result = calculateOpportunityScore({
      components,
      hardWarnings: [
        { key: "issue_closed", evidenceKeys: ["issue.state"], reason: "Issue is closed." },
        {
          key: "active_competing_implementation",
          evidenceKeys: ["competition.activePullRequestCount"],
          reason: "Active PR.",
        },
      ],
    });
    expect(result.score).toBe(0);
  });

  it("keeps scores bounded and monotonic without risk signals", () => {
    for (let score = 0; score <= 100; score += 1) {
      const result = calculateOpportunityScore(input(score, 100 - score, score, score));
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
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
