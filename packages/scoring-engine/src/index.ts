export const SCORE_VERSION = "opportunity-score-v4" as const;

export type ConfidenceLevel = "high" | "medium" | "low";
export type ComponentKey = "activity" | "competition" | "responsiveness" | "actionability";
export type Decision = "pursue" | "review_carefully" | "skip";
export type HardWarningKey =
  | "repository_archived"
  | "repository_disabled"
  | "issue_closed"
  | "issue_low_actionability"
  | "automated_or_tracking_issue"
  | "stale_opportunity_uncertain_maintainers"
  | "active_competing_implementation"
  | "assigned_active_competing_implementation"
  | "competition_evidence_incomplete";

export type ScoreAdjustmentKey =
  | "unresolved_maintainer_decision"
  | "unresolved_dependency"
  | "research_or_architecture_required"
  | "migration_or_backfill"
  | "large_cross_cutting_scope"
  | "heavy_unresolved_discussion"
  | "trivial_low_value_contribution";

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
export type AppliedScoreAdjustment = Readonly<{
  key: ScoreAdjustmentKey;
  points: number;
  evidenceKeys: readonly string[];
  reason: string;
}>;

export type OpportunityScoreResult = Readonly<{
  version: typeof SCORE_VERSION;
  score: number;
  baseScore: number;
  calibratedScore: number;
  uncappedScore: number;
  decision: Decision;
  confidence: Readonly<{ level: ConfidenceLevel; value: number }>;
  components: readonly ScoreComponent[];
  warnings: readonly string[];
  hardWarningsApplied: readonly AppliedHardWarning[];
  adjustmentsApplied: readonly AppliedScoreAdjustment[];
  decisionReason: string;
}>;

const ORDER: readonly ComponentKey[] = [
  "activity",
  "competition",
  "responsiveness",
  "actionability",
];

// Positive opportunity score. Risk evidence is handled separately below so that
// a severe blocker cannot be hidden by healthy repository activity or optimistic labels.
export const SCORE_WEIGHTS: Readonly<Record<ComponentKey, number>> = {
  activity: 0.15,
  competition: 0.25,
  responsiveness: 0.1,
  actionability: 0.5,
};

const HARD_WARNING_CAPS: Readonly<Record<HardWarningKey, number>> = {
  repository_archived: 0,
  repository_disabled: 0,
  issue_closed: 0,
  issue_low_actionability: 35,
  automated_or_tracking_issue: 15,
  stale_opportunity_uncertain_maintainers: 69,
  active_competing_implementation: 20,
  assigned_active_competing_implementation: 15,
  competition_evidence_incomplete: 100,
};

const EVIDENCE_ADJUSTMENTS: readonly AppliedScoreAdjustment[] = [
  {
    key: "unresolved_maintainer_decision",
    points: -15,
    evidenceKeys: ["actionability.unresolvedMaintainerDecision"],
    reason: "Implementation direction still requires a maintainer decision.",
  },
  {
    key: "unresolved_dependency",
    points: -15,
    evidenceKeys: ["actionability.dependencyRisk"],
    reason: "The issue depends on prerequisite work that can block an independent contribution.",
  },
  {
    key: "research_or_architecture_required",
    points: -10,
    evidenceKeys: ["actionability.researchRisk"],
    reason: "Research, architecture, or unresolved design work is required before implementation.",
  },
  {
    key: "migration_or_backfill",
    points: -8,
    evidenceKeys: ["actionability.migrationRisk"],
    reason: "Migration or backfill work raises execution and validation risk.",
  },
  {
    key: "large_cross_cutting_scope",
    points: -10,
    evidenceKeys: ["actionability.largeScopeRisk"],
    reason: "The implementation spans a large or cross-cutting scope.",
  },
  {
    key: "heavy_unresolved_discussion",
    points: -12,
    evidenceKeys: ["competition.heavyDiscussion"],
    reason: "The thread has substantial unresolved discussion rather than a clean implementation path.",
  },
  {
    key: "trivial_low_value_contribution",
    points: -15,
    evidenceKeys: ["actionability.trivialContribution"],
    reason: "The task is unusually trivial or copy/paste-oriented, reducing contribution value.",
  },
];

function assertScore(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 100) {
    throw new RangeError(`${name} must be an integer from 0 to 100.`);
  }
}

function assertNonEmpty(values: readonly string[], name: string): void {
  if (values.length === 0 || values.some((value) => value.trim().length === 0)) {
    throw new TypeError(`${name} must contain non-empty values.`);
  }
}

function confidence(value: number): Readonly<{ level: ConfidenceLevel; value: number }> {
  return { level: value >= 75 ? "high" : value >= 45 ? "medium" : "low", value };
}

function decision(score: number): Decision {
  return score >= 70 ? "pursue" : score >= 40 ? "review_carefully" : "skip";
}

// v4 deliberately removes nonlinear tail inflation. The score is now an auditable
// weighted evidence total, followed by explicit risk adjustments and hard caps.
export function calibrateOpportunityScore(baseScore: number): number {
  if (!Number.isFinite(baseScore)) throw new RangeError("base score must be finite.");
  return Math.round(Math.min(100, Math.max(0, baseScore)));
}

function evidenceSet(components: readonly ScoreComponent[]): Set<string> {
  return new Set(components.flatMap((component) => component.evidenceKeys));
}

function automaticAdjustments(components: readonly ScoreComponent[]): AppliedScoreAdjustment[] {
  const evidence = evidenceSet(components);
  return EVIDENCE_ADJUSTMENTS.filter((adjustment) =>
    adjustment.evidenceKeys.every((key) => evidence.has(key)),
  ).map((adjustment) => ({ ...adjustment, evidenceKeys: [...adjustment.evidenceKeys] }));
}

function decisionReason(
  result: Readonly<{
    score: number;
    components: readonly ScoreComponent[];
    hardWarnings: readonly AppliedHardWarning[];
    adjustments: readonly AppliedScoreAdjustment[];
  }>,
): string {
  const priority = [
    "repository_archived",
    "repository_disabled",
    "issue_closed",
    "automated_or_tracking_issue",
    "assigned_active_competing_implementation",
    "active_competing_implementation",
    "issue_low_actionability",
    "stale_opportunity_uncertain_maintainers",
  ] as const;

  for (const key of priority) {
    const warning = result.hardWarnings.find((item) => item.key === key);
    if (warning) return warning.reason;
  }

  const strongestAdjustment = [...result.adjustments].sort((a, b) => a.points - b.points)[0];
  if (strongestAdjustment && result.score < 70) return strongestAdjustment.reason;

  const actionability = result.components.find((component) => component.key === "actionability")!;
  const competition = result.components.find((component) => component.key === "competition")!;
  const activity = result.components.find((component) => component.key === "activity")!;
  const responsiveness = result.components.find((component) => component.key === "responsiveness")!;

  if (competition.rawScore >= 65) {
    return "Visible competition materially reduces the value of starting a new implementation now.";
  }
  if (result.score >= 85) {
    return "The issue is highly actionable, appears available, and the repository signals support a strong contribution opportunity.";
  }
  if (result.score >= 70) {
    return "The issue appears actionable, available, and sufficiently valuable to pursue based on the observed evidence.";
  }
  if (actionability.rawScore < 70) {
    return "The issue is not yet clearly contribution-ready; confirm scope and implementation direction first.";
  }
  if (activity.rawScore < 50 && responsiveness.confidence.level === "low") {
    return "The issue appears actionable, but repository activity is weak and maintainer-response evidence is limited.";
  }
  if (activity.rawScore < 50) return "The issue appears actionable, but repository activity is weak or stale.";
  if (responsiveness.confidence.level === "low") {
    return "The issue appears actionable, but maintainer-response evidence is limited; treat the score with lower confidence.";
  }
  return "The available evidence supports caution before starting work.";
}

export function calculateOpportunityScore(input: OpportunityScoreInput): OpportunityScoreResult {
  if (input.components.length !== ORDER.length) {
    throw new TypeError(
      "Exactly one activity, competition, responsiveness, and actionability component is required.",
    );
  }

  const byKey = new Map<ComponentKey, ScoreComponentInput>();
  for (const component of input.components) {
    if (byKey.has(component.key)) throw new TypeError(`Duplicate component: ${component.key}.`);
    assertScore(component.score, `${component.key} score`);
    assertScore(component.confidence.value, `${component.key} confidence`);
    assertNonEmpty(component.evidenceKeys, `${component.key} evidenceKeys`);
    if (component.reason.trim().length === 0) {
      throw new TypeError(`${component.key} reason must not be empty.`);
    }
    byKey.set(component.key, component);
  }

  const components = ORDER.map((key): ScoreComponent => {
    const component = byKey.get(key);
    if (component === undefined) throw new TypeError(`Missing component: ${key}.`);
    const normalizedScore = key === "competition" ? 100 - component.score : component.score;
    const weight = SCORE_WEIGHTS[key];
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

  const baseScore = Math.round(
    components.reduce(
      (total, component) => total + component.normalizedScore * component.weight,
      0,
    ),
  );
  const calibratedScore = calibrateOpportunityScore(baseScore);
  const adjustmentsApplied = automaticAdjustments(components);
  const adjustedScore = Math.max(
    0,
    Math.min(
      100,
      calibratedScore + adjustmentsApplied.reduce((total, adjustment) => total + adjustment.points, 0),
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
    if (warning.reason.trim().length === 0) {
      throw new TypeError(`${warning.key} reason must not be empty.`);
    }
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
  const score = Math.min(adjustedScore, scoreCap);

  return {
    version: SCORE_VERSION,
    score,
    baseScore,
    calibratedScore,
    uncappedScore: adjustedScore,
    decision: decision(score),
    confidence: confidence(overallConfidence),
    components,
    warnings: [
      ...components.flatMap((component) => component.warnings),
      ...adjustmentsApplied.map((adjustment) => adjustment.reason),
    ],
    hardWarningsApplied,
    adjustmentsApplied,
    decisionReason: decisionReason({
      score,
      components,
      hardWarnings: hardWarningsApplied,
      adjustments: adjustmentsApplied,
    }),
  };
}
