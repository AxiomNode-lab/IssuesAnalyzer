export type ActionabilityStatus = "high" | "medium" | "low";
export type ConfidenceLevel = "high" | "medium" | "low";

export type ActionabilityInput = Readonly<{
  asOf: Date;
  issue: Readonly<{
    title: string;
    body: string | null;
    labels: readonly string[];
    canonicalUrl: string;
  }>;
}>;

export type ActionabilityFact = Readonly<{
  key: string;
  value: string | number | boolean | null;
  sourceUrl: string;
  observedAt: Date;
  freshnessDays: number;
}>;

export type ActionabilityInference = Readonly<{
  key: string;
  value: string | number | boolean;
  basisFactKeys: readonly string[];
  caution: string;
}>;

export type ActionabilityResult = Readonly<{
  version: "actionability-v1";
  status: ActionabilityStatus;
  score: number;
  confidence: Readonly<{ level: ConfidenceLevel; value: number }>;
  facts: readonly ActionabilityFact[];
  inferences: readonly ActionabilityInference[];
  warnings: readonly string[];
}>;

const POSITIVE_LABEL = /^(?:bug|enhancement|feature|good first issue|help wanted|easy to fix)$/i;
const DISCUSSION_LABEL = /^(?:meta|discuss|discussion|question|rfc|proposal|brainstorm)$/i;
const CONCRETE_REQUEST =
  /\b(?:fix|implement|add|remove|replace|support|refactor|prevent|ensure|must|should|expected behavior)\b/i;
const ACCEPTANCE_CRITERIA =
  /(?:^|\n)\s*[-*]\s*\[[ xX]\]|\b(?:acceptance criteria|expected (?:result|outcome|behavior)|definition of done)\b/i;
const REPRODUCTION =
  /\b(?:steps to reproduce|reproducer|minimal example|actual behavior|expected behavior|stack trace)\b/i;
const SPECIFIC_TARGET =
  /`[^`\n]{2,80}`|\b(?:function|method|class|module|file|handler|api|test)\s+[A-Za-z0-9_.\/-]+/i;
const UNRESOLVED_DIRECTION =
  /\b(?:which (?:option|approach)|what do you think|thoughts\?|open to (?:ideas|suggestions)|happy to hear other approaches|alternatively|possible approaches?|approaches worth considering|one option|another option|we could either)\b/i;
const ACCEPTED_DIRECTION =
  /\b(?:we (?:have )?(?:decided|agreed)|accepted approach|consensus is|approved approach|please implement|ready for implementation|implementation direction is)\b/i;
const TRACKING_ISSUE =
  /\b(?:tracking issue|umbrella issue|meta issue|collect(?:ing)? sub-issues|many issues bundled together)\b/i;
const NUMBERED_ALTERNATIVE = /^\s*\d+[.)]\s+/gm;
const HEADING_ALTERNATIVE = /^\s*#{1,6}\s+(?:option\s+)?\d+[.:)]?\s+/gim;
const ALTERNATIVE_CONTEXT =
  /\b(?:possible approaches?|approaches worth considering|options? include)\b/i;

function confidence(signalCount: number, bodyAvailable: boolean) {
  const value = !bodyAvailable ? 25 : signalCount >= 3 ? 85 : signalCount >= 1 ? 65 : 35;
  return {
    level: value >= 75 ? ("high" as const) : value >= 45 ? ("medium" as const) : ("low" as const),
    value,
  };
}

export function analyzeIssueActionability(input: ActionabilityInput): ActionabilityResult {
  if (Number.isNaN(input.asOf.getTime())) throw new TypeError("Invalid asOf date.");
  if (input.issue.title.trim().length === 0) throw new TypeError("Issue title must not be empty.");

  const labels = input.issue.labels.map((label) => label.trim()).filter(Boolean);
  const body = input.issue.body ?? "";
  const text = `${input.issue.title}\n${body}`;
  const positiveLabels = labels.filter((label) => POSITIVE_LABEL.test(label));
  const discussionLabels = labels.filter((label) => DISCUSSION_LABEL.test(label));
  const concreteRequest = CONCRETE_REQUEST.test(text);
  const acceptanceCriteria = ACCEPTANCE_CRITERIA.test(body);
  const reproduction = REPRODUCTION.test(body);
  const specificTarget = SPECIFIC_TARGET.test(text);
  const acceptedDirection = ACCEPTED_DIRECTION.test(text);
  const unresolvedDirection = !acceptedDirection && UNRESOLVED_DIRECTION.test(text);
  const trackingIssue = TRACKING_ISSUE.test(text);
  const headingAlternativeCount = [...body.matchAll(HEADING_ALTERNATIVE)].length;
  const numberedAlternativeCount = ALTERNATIVE_CONTEXT.test(body)
    ? [...body.matchAll(NUMBERED_ALTERNATIVE)].length
    : 0;
  const alternativeCount = acceptedDirection
    ? 0
    : Math.max(headingAlternativeCount, numberedAlternativeCount);
  const multipleAlternatives = alternativeCount >= 2;

  let score = 50;
  score += Math.min(15, positiveLabels.length * 15);
  score -= Math.min(30, discussionLabels.length * 15);
  if (concreteRequest) score += 10;
  if (acceptanceCriteria) score += 15;
  if (reproduction) score += 10;
  if (specificTarget) score += 10;
  if (acceptedDirection) score += 30;
  if (unresolvedDirection) score -= 15;
  if (multipleAlternatives) score -= 20;
  if (trackingIssue) score -= 20;
  score = Math.min(100, Math.max(0, score));

  const facts: ActionabilityFact[] = [
    {
      key: "actionability.labels",
      value: labels.length === 0 ? "None" : labels.join(", "),
      sourceUrl: input.issue.canonicalUrl,
      observedAt: input.asOf,
      freshnessDays: 0,
    },
    {
      key: "actionability.discussionLabelCount",
      value: discussionLabels.length,
      sourceUrl: input.issue.canonicalUrl,
      observedAt: input.asOf,
      freshnessDays: 0,
    },
    {
      key: "actionability.alternativeCount",
      value: alternativeCount,
      sourceUrl: input.issue.canonicalUrl,
      observedAt: input.asOf,
      freshnessDays: 0,
    },
    {
      key: "actionability.acceptedDirection",
      value: acceptedDirection,
      sourceUrl: input.issue.canonicalUrl,
      observedAt: input.asOf,
      freshnessDays: 0,
    },
    {
      key: "actionability.acceptanceCriteria",
      value: acceptanceCriteria,
      sourceUrl: input.issue.canonicalUrl,
      observedAt: input.asOf,
      freshnessDays: 0,
    },
    {
      key: "actionability.concreteRequest",
      value: concreteRequest,
      sourceUrl: input.issue.canonicalUrl,
      observedAt: input.asOf,
      freshnessDays: 0,
    },
    {
      key: "actionability.trackingIssue",
      value: trackingIssue,
      sourceUrl: input.issue.canonicalUrl,
      observedAt: input.asOf,
      freshnessDays: 0,
    },
  ];
  const basisFactKeys = facts.map((fact) => fact.key);
  const status: ActionabilityStatus = score >= 70 ? "high" : score >= 40 ? "medium" : "low";
  const signalCount = [
    positiveLabels.length > 0,
    discussionLabels.length > 0,
    concreteRequest,
    acceptanceCriteria,
    reproduction,
    specificTarget,
    acceptedDirection,
    unresolvedDirection,
    multipleAlternatives,
    trackingIssue,
  ].filter(Boolean).length;
  const warnings: string[] = [];
  if (input.issue.body === null || body.trim().length === 0)
    warnings.push("Issue description is unavailable, so actionability is uncertain.");
  if (signalCount === 0)
    warnings.push("No strong contribution-readiness or discussion signals were detected.");

  return {
    version: "actionability-v1",
    status,
    score,
    confidence: confidence(signalCount, input.issue.body !== null && body.trim().length > 0),
    facts,
    inferences: [
      {
        key: "actionability.classification",
        value: status,
        basisFactKeys,
        caution:
          "Observable issue text and labels indicate readiness, but maintainers can clarify or change direction later.",
      },
    ],
    warnings,
  };
}
