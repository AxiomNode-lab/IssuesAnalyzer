export const SCORE_VERSION = "opportunity-score-v2" as const;

export type ConfidenceLevel = "high" | "medium" | "low";
export type ComponentKey = "activity" | "competition" | "responsiveness" | "actionability";
export type Decision = "pursue" | "review_carefully" | "skip";
export type HardWarningKey =
  | "repository_archived"
  | "repository_disabled"
  | "issue_closed"
  | "issue_low_actionability"
  | "stale_opportunity_uncertain_maintainers"
  | "active_competing_implementation"
  | "assigned_active_competing_implementation"
  | "competition_evidence_incomplete";

export type ScoreComponentInput = Readonly<{
  key: ComponentKey;
  score: number;
  confidence: Readonly<{ level: ConfidenceLevel; value: number }>;
  evidenceKeys: readonly string[];
  reason: string;
  warnings: readonly string[];
}>;

export type HardWarningInput = Readonly<{
  key: HardWarningKey;
  evidenceKeys: readonly string[];
  reason: string;
}>;

export type OpportunityScoreInput = Readonly<{
  components: readonly ScoreComponentInput[];
  hardWarnings?: readonly HardWarningInput[];
}>;

export type ScoreComponent = Readonly<{
  key: ComponentKey;
  rawScore: number;
  normalizedScore: number;
  weight: number;
  weightedPoints: number;
  evidenceKeys: readonly string[];
  reason: string;
  confidence: Readonly<{ level: ConfidenceLevel; value: number }>;
  warnings: readonly string[];
}>;

export type AppliedHardWarning = HardWarningInput & Readonly<{ scoreCap: number }>;

export type OpportunityScoreResult = Readonly<{
  version: typeof SCORE_VERSION;
  score: number;
  uncappedScore: number;
  decision: Decision;
  confidence: Readonly<{ level: ConfidenceLevel; value: number }>;
  components: readonly ScoreComponent[];
  warnings: readonly string[];
  hardWarningsApplied: readonly AppliedHardWarning[];
  decisionReason: string;
}>;

const ORDER: readonly ComponentKey[] = [
  "activity",
  "competition",
  "responsiveness",
  "actionability",
];
const WEIGHTS: Readonly<Record<ComponentKey, number>> = {
  activity: 0.25,
  competition: 0.2,
  responsiveness: 0.2,
  actionability: 0.35,
};
const HARD_WARNING_CAPS: Readonly<Record<HardWarningKey, number>> = {
  repository_archived: 0,
  repository_disabled: 0,
  issue_closed: 20,
  issue_low_actionability: 39,
  stale_opportunity_uncertain_maintainers: 69,
  active_competing_implementation: 49,
  assigned_active_competing_implementation: 39,
  competition_evidence_incomplete: 69,
};

function assertScore(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 100)
    throw new RangeError(`${name} must be an integer from 0 to 100.`);
}

function assertNonEmpty(values: readonly string[], name: string): void {
  if (values.length === 0 || values.some((value) => value.trim().length === 0))
    throw new TypeError(`${name} must contain non-empty values.`);
}

function confidence(value: number): Readonly<{ level: ConfidenceLevel; value: number }> {
  return { level: value >= 75 ? "high" : value >= 45 ? "medium" : "low", value };
}

function decision(score: number): Decision {
  return score >= 70 ? "pursue" : score >= 40 ? "review_carefully" : "skip";
}

function decisionReason(
  result: Readonly<{
    score: number;
    components: readonly ScoreComponent[];
    hardWarnings: readonly AppliedHardWarning[];
  }>,
): string {
  const priority = [
    "repository_archived",
    "repository_disabled",
    "issue_closed",
    "assigned_active_competing_implementation",
    "active_competing_implementation",
    "competition_evidence_incomplete",
    "issue_low_actionability",
    "stale_opportunity_uncertain_maintainers",
  ] as const;
  for (const key of priority) {
    const warning = result.hardWarnings.find((item) => item.key === key);
    if (warning) return warning.reason;
  }

  const actionability = result.components.find((component) => component.key === "actionability")!;
  const competition = result.components.find((component) => component.key === "competition")!;
  const activity = result.components.find((component) => component.key === "activity")!;
  const responsiveness = result.components.find((component) => component.key === "responsiveness")!;

  if (competition.rawScore >= 80)
    return "Active competing implementation work is visible; review it before investing effort.";
  if (result.score >= 70)
    return "The issue appears actionable, repository activity is healthy, and no strong active competition was detected.";
  if (actionability.rawScore < 70)
    return "The issue is not yet clearly contribution-ready; confirm scope and implementation direction first.";
  if (activity.rawScore < 50 && responsiveness.confidence.level === "low")
    return "The issue appears actionable, but repository activity is weak and maintainer-response evidence is limited.";
  if (activity.rawScore < 50)
    return "The issue appears actionable, but repository activity is weak or stale.";
  if (responsiveness.confidence.level === "low")
    return "The issue appears actionable, but maintainer-response evidence is too limited for a strong recommendation.";
  return "The available evidence supports caution before starting work.";
}

export function calculateOpportunityScore(input: OpportunityScoreInput): OpportunityScoreResult {
  if (input.components.length !== ORDER.length)
    throw new TypeError(
      "Exactly one activity, competition, responsiveness, and actionability component is required.",
    );

  const byKey = new Map<ComponentKey, ScoreComponentInput>();
  for (const component of input.components) {
    if (byKey.has(component.key)) throw new TypeError(`Duplicate component: ${component.key}.`);
    assertScore(component.score, `${component.key} score`);
    assertScore(component.confidence.value, `${component.key} confidence`);
    assertNonEmpty(component.evidenceKeys, `${component.key} evidenceKeys`);
    if (component.reason.trim().length === 0)
      throw new TypeError(`${component.key} reason must not be empty.`);
    byKey.set(component.key, component);
  }

  const components = ORDER.map((key): ScoreComponent => {
    const component = byKey.get(key);
    if (component === undefined) throw new TypeError(`Missing component: ${key}.`);
    const normalizedScore = key === "competition" ? 100 - component.score : component.score;
    const weight = WEIGHTS[key];
    return {
      key,
      rawScore: component.score,
      normalizedScore,
      weight,
      weightedPoints: Math.round(normalizedScore * weight * 10) / 10,
      evidenceKeys: [...component.evidenceKeys],
      reason: component.reason,
      confidence: { ...component.confidence },
      warnings: [...component.warnings],
    };
  });

  const uncappedScore = Math.round(
    components.reduce(
      (total, component) => total + component.normalizedScore * component.weight,
      0,
    ),
  );
  const overallConfidence = Math.round(
    components.reduce(
      (total, component) => total + component.confidence.value * component.weight,
      0,
    ),
  );

  const hardWarningsApplied = (input.hardWarnings ?? []).map((warning): AppliedHardWarning => {
    assertNonEmpty(warning.evidenceKeys, `${warning.key} evidenceKeys`);
    if (warning.reason.trim().length === 0)
      throw new TypeError(`${warning.key} reason must not be empty.`);
    return {
      ...warning,
      evidenceKeys: [...warning.evidenceKeys],
      scoreCap: HARD_WARNING_CAPS[warning.key],
    };
  });
  const scoreCap = hardWarningsApplied.reduce(
    (lowest, warning) => Math.min(lowest, warning.scoreCap),
    100,
  );
  const score = Math.min(uncappedScore, scoreCap);

  return {
    version: SCORE_VERSION,
    score,
    uncappedScore,
    decision: decision(score),
    confidence: confidence(overallConfidence),
    components,
    warnings: components.flatMap((component) => component.warnings),
    hardWarningsApplied,
    decisionReason: decisionReason({ score, components, hardWarnings: hardWarningsApplied }),
  };
}
