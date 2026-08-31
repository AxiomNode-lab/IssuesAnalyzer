export type CompetitionStatus = "none_visible" | "possible" | "visible" | "uncertain";
export type ConfidenceLevel = "high" | "medium" | "low";
export type ActorEvidence = Readonly<{ login: string; profileUrl: string }>;
export type CommentEvidence = Readonly<{
  author: ActorEvidence;
  body: string | null;
  createdAt: Date;
  sourceUrl: string;
}>;
export type PullRequestEvidence = Readonly<{
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  draft: boolean;
  author: ActorEvidence;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
  mergedAt: Date | null;
  sourceUrl: string;
}>;
export type TimelineEvidence = Readonly<{
  event: string;
  actor: ActorEvidence | null;
  createdAt: Date;
  sourceUrl: string;
  referencedPullRequest?: PullRequestEvidence | null;
}>;
export type CompetitionInput = Readonly<{
  asOf: Date;
  issue: Readonly<{
    number: number;
    canonicalUrl: string;
    authorLogin: string;
    assignees: readonly ActorEvidence[];
  }>;
  comments: readonly CommentEvidence[] | null;
  timeline: readonly TimelineEvidence[] | null;
  pullRequests: readonly PullRequestEvidence[] | null;
  completeness?: Readonly<{ timeline: boolean; pullRequests: boolean }>;
}>;
export type CompetitionFact = Readonly<{
  key: string;
  value: string | number | boolean | null;
  sourceUrl: string;
  observedAt: Date;
  freshnessDays: number;
}>;
export type CompetitionInference = Readonly<{
  key: string;
  value: string | number | boolean;
  basisFactKeys: readonly string[];
  caution: string;
}>;
export type CompetitionResult = Readonly<{
  version: "competition-v2";
  status: CompetitionStatus;
  score: number;
  confidence: Readonly<{ level: ConfidenceLevel; value: number }>;
  facts: readonly CompetitionFact[];
  inferences: readonly CompetitionInference[];
  warnings: readonly string[];
  evidenceWindow: Readonly<{
    commentsUsed: number;
    timelineEventsUsed: number;
    pullRequestsUsed: number;
  }>;
}>;

const DAY = 86_400_000;
const MAX_COMMENTS = 500;
const MAX_TIMELINE_EVENTS = 300;
const MAX_PULL_REQUESTS = 100;

const CLAIM_PATTERNS = [
  /\b(?:i(?:'|’)d|i would)\s+(?:like|love|glad|be happy)\s+to\s+(?:work on|take|tackle|handle|pick up|contribute to)\s+(?:this|the)(?:\s+(?:issue|task|one))?\b/i,
  /\b(?:i(?:'|’)ll|i will|i can|i could|i(?:'|’)m going to|i am going to)\s+(?:work on|take|tackle|handle|pick up)\s+(?:this|the)(?:\s+(?:issue|task|one))?\b/i,
  /\b(?:can|could|may)\s+i\s+(?:work on|take|tackle|handle|pick up)\s+(?:this|the)(?:\s+(?:issue|task|one))?\b/i,
  /\b(?:please\s+)?assign\s+(?:this\s+(?:issue|task)\s+to\s+me|me(?:\s+to\s+(?:this|the)(?:\s+(?:issue|task))?)?)\b/i,
  /\b(?:could|can|would)\s+you\s+(?:please\s+)?assign\s+(?:this\s+(?:issue|task)\s+to\s+)?me\b/i,
  /\b(?:i(?:'|’)m|i am|currently|already)\s+(?:actively\s+)?working on\s+(?:this|the)(?:\s+(?:issue|task|one))?\b/i,
  /\b(?:started|starting|began|beginning)\s+(?:to\s+work|working)\s+on\s+(?:this|the)(?:\s+(?:issue|task|one))?\b/i,
  /\b(?:working on|taking|tackling|handling|picking up)\s+(?:this|the)\s+(?:issue|task|one)\b/i,
  /\blet\s+me\s+(?:work on|take|tackle|handle|pick up)\s+(?:this|the)(?:\s+(?:issue|task|one))?\b/i,
  /\bclaim(?:ing)?\s+(?:this|the)\s+(?:issue|task|one)\b/i,
  /\b(?:i(?:'|’)d|i would|i(?:'|’)ll|i will|i can)\s+(?:love|like|be happy|be glad)?\s*(?:to\s+)?take\s+(?:this|the)\s+one\s+on\b/i,
  /\b(?:has|have|had|i(?:'|’)ve|i have)\s+applied\s+to\s+work\s+on\s+(?:this|the)\s+(?:issue|task)\b/i,
  /\bapplied\s+for\s+(?:this|the)\s+(?:issue|task)\b/i,
  /\bapplication\s+to\s+work\s+on\s+(?:this|the)\s+(?:issue|task)\b/i,
  /\b(?:ready|available)\s+to\s+(?:start|get started|work)\s+on\s+(?:this|the)\s+(?:issue|task)\b/i,
  /\b(?:i(?:'|’)m|i am)\s+(?:ready|available)\s+to\s+get\s+started\s+(?:on\s+(?:this|the)\s+(?:issue|task))?\b/i,
  /\b(?:i(?:'|’)ll|i will)\s+(?:get started|start working)\s+(?:on\s+)?(?:this|the)\s+(?:issue|task)\b/i,
  /\b(?:i(?:'|’)d|i would)\s+like\s+to\s+contribute\s+(?:to|on)\s+(?:this|the)\s+(?:issue|task)\b/i,
];
const NON_CLAIM_PATTERNS = [
  /\b(?:i(?:'|’)m not|i am not|not)\s+working on\s+(?:this|the)(?:\s+(?:issue|task|one))?\b/i,
  /\b(?:i can(?:'|’)t|i cannot|i won(?:'|’)t|i will not)\s+(?:work on|take|tackle|handle)\s+(?:this|the)(?:\s+(?:issue|task|one))?\b/i,
  /\b(?:no longer|stopped|stop|dropping|drop|giving up|gave up)\s+(?:working on|work on|this|the)\b/i,
  /\b(?:please\s+)?unassign\s+me\b/i,
];
const hasClaimLanguage = (body: string) =>
  !NON_CLAIM_PATTERNS.some((pattern) => pattern.test(body)) &&
  CLAIM_PATTERNS.some((pattern) => pattern.test(body));

function validDate(value: Date, name: string): void {
  if (Number.isNaN(value.getTime())) throw new TypeError(`Invalid ${name} date.`);
}
function historicalDate(value: Date, asOf: Date, name: string): void {
  validDate(value, name);
  if (value > asOf) throw new RangeError(`${name} date cannot be after asOf.`);
}
function daysBetween(later: Date, earlier: Date): number {
  return Math.max(0, Math.floor((later.getTime() - earlier.getTime()) / DAY));
}
function newestBounded<T>(
  items: readonly T[],
  limit: number,
  dateOf: (item: T) => Date,
  keyOf: (item: T) => string,
): T[] {
  return [...items]
    .sort(
      (left, right) =>
        dateOf(right).getTime() - dateOf(left).getTime() || keyOf(left).localeCompare(keyOf(right)),
    )
    .slice(0, limit);
}
const isBot = (login: string) => login.toLowerCase().endsWith("[bot]");
function referencesIssue(text: string, number: number, url: string): boolean {
  if (text.includes(url)) return true;
  const shortReference = `#${number}`;
  const index = text.indexOf(shortReference);
  if (index === -1) return false;
  const before = index === 0 ? " " : (text[index - 1] ?? " ");
  const after = text[index + shortReference.length] ?? " ";
  return /\s/.test(before) && /[\s.,;:!?)}\]]/.test(after);
}
function confidence(sources: number, incomplete: number) {
  const value = Math.max(0, Math.round((sources / 4) * 100) - incomplete * 30);
  return {
    level: value >= 75 ? ("high" as const) : value >= 50 ? ("medium" as const) : ("low" as const),
    value,
  };
}
function validatePullRequest(pr: PullRequestEvidence, asOf: Date): void {
  historicalDate(pr.createdAt, asOf, "pull request creation");
  historicalDate(pr.updatedAt, asOf, "pull request update");
  if (pr.closedAt) historicalDate(pr.closedAt, asOf, "pull request closure");
  if (pr.mergedAt) historicalDate(pr.mergedAt, asOf, "pull request merge");
}
function claimRisk(count: number, freshnessDays: number): number {
  if (count === 0) return 0;
  const base = count >= 8 ? 45 : count >= 4 ? 35 : count >= 2 ? 25 : 15;
  const freshness = freshnessDays <= 14 ? 5 : freshnessDays <= 45 ? 0 : -5;
  return Math.max(10, Math.min(50, base + freshness));
}

export function analyzeCompetition(input: CompetitionInput): CompetitionResult {
  validDate(input.asOf, "asOf");
  if (!Number.isSafeInteger(input.issue.number) || input.issue.number <= 0) {
    throw new RangeError("Issue number must be a positive safe integer.");
  }

  for (const item of input.comments ?? []) historicalDate(item.createdAt, input.asOf, "comment");
  for (const item of input.timeline ?? []) {
    historicalDate(item.createdAt, input.asOf, "timeline event");
    if (item.referencedPullRequest) validatePullRequest(item.referencedPullRequest, input.asOf);
  }
  for (const item of input.pullRequests ?? []) validatePullRequest(item, input.asOf);

  const comments = newestBounded(
    input.comments ?? [],
    MAX_COMMENTS,
    (item) => item.createdAt,
    (item) => item.sourceUrl,
  );
  const timeline = newestBounded(
    input.timeline ?? [],
    MAX_TIMELINE_EVENTS,
    (item) => item.createdAt,
    (item) => `${item.event}:${item.sourceUrl}:${item.referencedPullRequest?.sourceUrl ?? ""}`,
  );
  const pullRequests = newestBounded(
    input.pullRequests ?? [],
    MAX_PULL_REQUESTS,
    (item) => item.updatedAt,
    (item) => item.sourceUrl,
  );

  const claimComments = comments.filter(
    (comment) =>
      comment.body !== null &&
      comment.author.login.toLowerCase() !== input.issue.authorLogin.toLowerCase() &&
      !isBot(comment.author.login) &&
      hasClaimLanguage(comment.body),
  );

  const explicitlyReferenced = pullRequests.filter((pr) =>
    referencesIssue(`${pr.title}\n${pr.body ?? ""}`, input.issue.number, input.issue.canonicalUrl),
  );
  const timelinePullRequests = timeline.flatMap((event) =>
    event.referencedPullRequest ? [event.referencedPullRequest] : [],
  );
  const byUrl = new Map<string, PullRequestEvidence>();
  for (const pr of explicitlyReferenced) byUrl.set(pr.sourceUrl, pr);
  for (const pr of timelinePullRequests) byUrl.set(pr.sourceUrl, pr);
  const linked = [...byUrl.values()].sort(
    (left, right) => right.updatedAt.getTime() - left.updatedAt.getTime(),
  );
  const active = linked.filter((pr) => pr.state === "open");
  const draft = active.filter((pr) => pr.draft);
  const merged = linked.filter((pr) => pr.mergedAt !== null);
  const closed = linked.filter((pr) => pr.state === "closed" && pr.mergedAt === null);
  const nonPr = timeline.filter(
    (event) =>
      ["cross-referenced", "connected", "referenced"].includes(event.event) &&
      !event.referencedPullRequest,
  );
  const freshest = linked[0];
  const latestClaim = claimComments[0];

  const fact = (
    key: string,
    value: string | number | boolean | null,
    url: string,
    freshnessDays: number,
  ): CompetitionFact => ({ key, value, sourceUrl: url, observedAt: input.asOf, freshnessDays });

  const facts = [
    fact("issue.assigneeCount", input.issue.assignees.length, input.issue.canonicalUrl, 0),
    fact(
      "competition.linkedPullRequestCount",
      linked.length,
      freshest?.sourceUrl ?? input.issue.canonicalUrl,
      freshest ? daysBetween(input.asOf, freshest.updatedAt) : 0,
    ),
    fact(
      "competition.activePullRequestCount",
      active.length,
      active[0]?.sourceUrl ?? input.issue.canonicalUrl,
      active[0] ? daysBetween(input.asOf, active[0].updatedAt) : 0,
    ),
    fact(
      "competition.draftPullRequestCount",
      draft.length,
      draft[0]?.sourceUrl ?? input.issue.canonicalUrl,
      draft[0] ? daysBetween(input.asOf, draft[0].updatedAt) : 0,
    ),
    fact(
      "competition.mergedPullRequestCount",
      merged.length,
      merged[0]?.sourceUrl ?? input.issue.canonicalUrl,
      merged[0]?.mergedAt ? daysBetween(input.asOf, merged[0].mergedAt) : 0,
    ),
    fact(
      "competition.closedPullRequestCount",
      closed.length,
      closed[0]?.sourceUrl ?? input.issue.canonicalUrl,
      closed[0]?.closedAt ? daysBetween(input.asOf, closed[0].closedAt) : 0,
    ),
    fact(
      "competition.claimCommentCount",
      claimComments.length,
      latestClaim?.sourceUrl ?? input.issue.canonicalUrl,
      latestClaim ? daysBetween(input.asOf, latestClaim.createdAt) : 0,
    ),
    fact("competition.nonPullRequestReferenceCount", nonPr.length, input.issue.canonicalUrl, 0),
  ];

  const inferences: CompetitionInference[] = [];
  if (input.issue.assignees.length) {
    inferences.push({
      key: "competition.assigned",
      value: true,
      basisFactKeys: ["issue.assigneeCount"],
      caution: "Assignment is visible evidence, but it does not prove work is still active.",
    });
  }
  if (active.length) {
    inferences.push({
      key: "competition.activeImplementation",
      value: true,
      basisFactKeys: ["competition.activePullRequestCount", "competition.draftPullRequestCount"],
      caution:
        "An open or draft linked pull request is active visible work, but it may still be abandoned.",
    });
  } else if (merged.length + closed.length) {
    inferences.push({
      key: "competition.historicalImplementation",
      value: true,
      basisFactKeys: ["competition.mergedPullRequestCount", "competition.closedPullRequestCount"],
      caution:
        "Closed or merged work is historical evidence and is weaker than an active implementation.",
    });
  }
  if (claimComments.length) {
    inferences.push({
      key: "competition.claimLanguage",
      value: true,
      basisFactKeys: ["competition.claimCommentCount"],
      caution:
        "Claim language indicates intent only; it is weighted below assignment or an active pull request.",
    });
  }
  if (!input.issue.assignees.length && !active.length && !claimComments.length) {
    inferences.push({
      key: "competition.noneActiveVisible",
      value: true,
      basisFactKeys: [
        "issue.assigneeCount",
        "competition.activePullRequestCount",
        "competition.claimCommentCount",
      ],
      caution: "No active visible signal does not guarantee nobody is working privately.",
    });
  }

  const completeness = input.completeness ?? { timeline: true, pullRequests: true };
  const warnings: string[] = [];
  if (input.comments === null) warnings.push("Comment evidence is unavailable.");
  if (input.timeline === null) warnings.push("Timeline evidence is unavailable.");
  if (input.pullRequests === null) warnings.push("Pull request evidence is unavailable.");
  if (!completeness.timeline)
    warnings.push(
      "Timeline evidence reached its collection bound; additional linked work may exist.",
    );
  if (!completeness.pullRequests)
    warnings.push("Repository pull request evidence reached its collection bound.");
  if ((input.comments?.length ?? 0) > MAX_COMMENTS)
    warnings.push("Comment evidence was bounded to 500 records.");
  if ((input.timeline?.length ?? 0) > MAX_TIMELINE_EVENTS)
    warnings.push("Timeline evidence was bounded to 300 records.");
  if ((input.pullRequests?.length ?? 0) > MAX_PULL_REQUESTS)
    warnings.push("Pull request evidence was bounded to 100 records.");

  const evidenceConfidence = confidence(
    1 +
      Number(input.comments !== null) +
      Number(input.timeline !== null) +
      Number(input.pullRequests !== null),
    Number(input.timeline !== null && !completeness.timeline) +
      Number(input.pullRequests !== null && !completeness.pullRequests),
  );
  const latestClaimDays = latestClaim ? daysBetween(input.asOf, latestClaim.createdAt) : 0;
  const score = Math.max(
    active.length >= 3 ? 100 : active.length === 2 ? 90 : active.length === 1 ? 80 : 0,
    input.issue.assignees.length ? 75 : 0,
    claimRisk(claimComments.length, latestClaimDays),
    merged.length ? 20 : 0,
    closed.length ? 10 : 0,
  );
  const status: CompetitionStatus =
    active.length || input.issue.assignees.length
      ? "visible"
      : claimComments.length || merged.length + closed.length
        ? "possible"
        : input.comments === null && input.timeline === null && input.pullRequests === null
          ? "uncertain"
          : "none_visible";

  return {
    version: "competition-v2",
    status,
    score,
    confidence: evidenceConfidence,
    facts,
    inferences,
    warnings,
    evidenceWindow: {
      commentsUsed: comments.length,
      timelineEventsUsed: timeline.length,
      pullRequestsUsed: pullRequests.length,
    },
  };
}
