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
    confidence: { level: confidence >= 75 ? "high" : confidence >= 45 ? "medium" : "low", value: confidence },
    evidenceKeys: [`${key}.evidence`],
    reason: `${key} reason`,
    warnings: [],
  };
}

function input(activity = 80, competition = 20, responsiveness = 80): OpportunityScoreInput {
  return {
    components: [
      component("responsiveness", responsiveness),
      component("activity", activity),
      component("competition", competition),
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
    ]);
    expect(result.components[1]).toMatchObject({
      rawScore: 20,
      normalizedScore: 80,
      weight: 0.4,
      weightedPoints: 32,
      evidenceKeys: ["competition.evidence"],
      reason: "competition reason",
    });
  });

  it("is deterministic and does not mutate input", () => {
    const source = input(73, 41, 62);
    const snapshot = structuredClone(source);
    expect(calculateOpportunityScore(source)).toEqual(calculateOpportunityScore(source));
    expect(source).toEqual(snapshot);
  });

  it.each([
    [70, "pursue"],
    [69, "review_carefully"],
    [40, "review_carefully"],
    [39, "skip"],
  ] as const)("maps score %i to %s", (target, expected) => {
    expect(calculateOpportunityScore(input(target, 100 - target, target)).decision).toBe(expected);
  });

  it("inverts competition because a higher analyzer score means more competition", () => {
    expect(calculateOpportunityScore(input(50, 0, 50)).score).toBe(70);
    expect(calculateOpportunityScore(input(50, 100, 50)).score).toBe(30);
  });

  it("preserves component warnings and calculates weighted confidence", () => {
    const source = input();
    const components = source.components.map((item, index) => ({
      ...item,
      confidence: { level: "low" as const, value: index === 0 ? 10 : 20 },
      warnings: [`${item.key} warning`],
    }));
    const result = calculateOpportunityScore({ components });

    expect(result.confidence).toEqual({ level: "low", value: 16 });
    expect(result.warnings).toEqual([
      "activity warning",
      "competition warning",
      "responsiveness warning",
    ]);
  });

  it.each([
    ["repository_archived", 0],
    ["repository_disabled", 0],
    ["issue_closed", 20],
  ] as const)("applies the %s hard-warning cap", (key, cap) => {
    const result = calculateOpportunityScore({
      ...input(100, 0, 100),
      hardWarnings: [{ key, evidenceKeys: ["repository.state"], reason: "Work cannot proceed." }],
    });

    expect(result.uncappedScore).toBe(100);
    expect(result.score).toBe(cap);
    expect(result.decision).toBe("skip");
    expect(result.hardWarningsApplied[0]?.scoreCap).toBe(cap);
  });

  it("uses the strictest cap when several hard warnings apply", () => {
    const result = calculateOpportunityScore({
      ...input(100, 0, 100),
      hardWarnings: [
        { key: "issue_closed", evidenceKeys: ["issue.state"], reason: "Issue is closed." },
        { key: "repository_archived", evidenceKeys: ["repository.archived"], reason: "Repository is archived." },
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
      expect(calculateOpportunityScore(input(50, score + 1, 50)).score).toBeLessThanOrEqual(
        calculateOpportunityScore(input(50, score, 50)).score,
      );
    }
  });

  it.each([-1, 1.5, 101, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects an invalid component score: %s",
    (score) => {
      expect(() =>
        calculateOpportunityScore({
          components: [
            component("activity", score),
            component("competition", 0),
            component("responsiveness", 0),
          ],
        }),
      ).toThrow(RangeError);
    },
  );

  it("rejects missing and duplicate components", () => {
    expect(() =>
      calculateOpportunityScore({
        components: [component("activity", 50), component("competition", 50)],
      }),
    ).toThrow("Exactly one activity, competition, and responsiveness component is required.");

    expect(() =>
      calculateOpportunityScore({
        components: [
          component("activity", 50),
          component("activity", 50),
          component("responsiveness", 50),
        ],
      }),
    ).toThrow("Duplicate component: activity.");
  });

  it("rejects empty provenance and reasons", () => {
    expect(() =>
      calculateOpportunityScore({
        components: [
          { ...component("activity", 50), evidenceKeys: [] },
          component("competition", 50),
          component("responsiveness", 50),
        ],
      }),
    ).toThrow("activity evidenceKeys must contain non-empty values.");

    expect(() =>
      calculateOpportunityScore({
        ...input(),
        hardWarnings: [{ key: "issue_closed", evidenceKeys: [], reason: "" }],
      }),
    ).toThrow("issue_closed evidenceKeys must contain non-empty values.");
  });
});
