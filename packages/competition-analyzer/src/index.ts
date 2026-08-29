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
  completeness?: Readonly<{
    timeline: boolean;
    pullRequests: boolean;
  }>;
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
  /\b(?:i(?:'|’)d|i would)\s+(?:like|love|glad|be happy)\s+to\s+(?:work on|take|tackle|handle|pick up|contribute to)\s+(?:this|the)\s+(?:issue|task|one)?\b/i,
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

function hasClaimLanguage(body: string): boolean {
  if (NON_CLAIM_PATTERNS.some((pattern) => pattern.test(body))) return false;
  return CLAIM_PATTERNS.some((pattern) => pattern.test(body));
}

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
    .sort((left, right) => {
      const difference = dateOf(right).getTime() - dateOf(left).getTime();
      return difference === 0 ? keyOf(left).localeCompare(keyOf(right)) : difference;
    })
    .slice(0, limit);
}

function isBot(login: string): boolean {
  return login.toLowerCase().endsWith("[bot]");
}

function referencesIssue(text: string, number: number, canonicalUrl: string): boolean {
  if (text.includes(canonicalUrl)) return true;
  return new RegExp(`(^|\\s)#${number}(?=\\s|$|[.,;:!?)}\\]])`).test(text);
}

function confidence(sources: number, incompleteSources: number) {
  const value = Math.max(0, Math.round((sources / 4) * 100) - incompleteSources * 30);
  return {
    level: value >= 75 ? ("high" as const) : value >= 50 ? ("medium" as const) : ("low" as const),
    value,
  };
}

function validatePullRequest(pullRequest: PullRequestEvidence, asOf: Date): void {
  historicalDate(pullRequest.createdAt, asOf, "pull request creation");
  historicalDate(pullRequest.updatedAt, asOf, "pull request update");
  if (pullRequest.closedAt !== null)
    historicalDate(pullRequest.closedAt, asOf, "pull request closure");
  if (pullRequest.mergedAt !== null)
    historicalDate(pullRequest.mergedAt, asOf, "pull request merge");
}

export function analyzeCompetition(input: CompetitionInput): CompetitionResult {
  validDate(input.asOf, "asOf");
  if (!Number.isSafeInteger(input.issue.number) || input.issue.number <= 0)
    throw new RangeError("Issue number must be a positive safe integer.");

  for (const comment of input.comments ?? [])
    historicalDate(comment.createdAt, input.asOf, "comment");
  for (const event of input.timeline ?? []) {
    historicalDate(event.createdAt, input.asOf, "timeline event");
    if (event.referencedPullRequest) validatePullRequest(event.referencedPullRequest, input.asOf);
  }
  for (const pullRequest of input.pullRequests ?? []) validatePullRequest(pullRequest, input.asOf);

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
  const explicitlyReferenced = pullRequests.filter((pullRequest) =>
    referencesIssue(
      `${pullRequest.title}\n${pullRequest.body ?? ""}`,
      input.issue.number,
      input.issue.canonicalUrl,
    ),
  );
  const timelinePullRequests = timeline.flatMap((event) =>
    event.referencedPullRequest ? [event.referencedPullRequest] : [],
  );
  const linkedByUrl = new Map<string, PullRequestEvidence>();
  for (const pullRequest of explicitlyReferenced)
    linkedByUrl.set(pullRequest.sourceUrl, pullRequest);
  for (const pullRequest of timelinePullRequests)
    linkedByUrl.set(pullRequest.sourceUrl, pullRequest);
  const linkedPullRequests = [...linkedByUrl.values()].sort(
    (left, right) => right.updatedAt.getTime() - left.updatedAt.getTime(),
  );
  const activePullRequests = linkedPullRequests.filter(
    (pullRequest) => pullRequest.state === "open",
  );
  const draftPullRequests = activePullRequests.filter((pullRequest) => pullRequest.draft);
  const mergedPullRequests = linkedPullRequests.filter(
    (pullRequest) => pullRequest.mergedAt !== null,
  );
  const closedPullRequests = linkedPullRequests.filter(
    (pullRequest) => pullRequest.state === "closed" && pullRequest.mergedAt === null,
  );
  const nonPullRequestReferences = timeline.filter(
    (event) =>
      ["cross-referenced", "connected", "referenced"].includes(event.event) &&
      !event.referencedPullRequest,
  );
  const freshestPullRequest = linkedPullRequests[0];
  const latestClaim = claimComments[0];
  const facts: CompetitionFact[] = [
    {
      key: "issue.assigneeCount",
      value: input.issue.assignees.length,
      sourceUrl: input.issue.canonicalUrl,
      observedAt: input.asOf,
      freshnessDays: 0,
    },
    {
      key: "competition.linkedPullRequestCount",
      value: linkedPullRequests.length,
      sourceUrl: freshestPullRequest?.sourceUrl ?? input.issue.canonicalUrl,
      observedAt: input.asOf,
      freshnessDays: freshestPullRequest
        ? daysBetween(input.asOf, freshestPullRequest.updatedAt)
        : 0,
    },
    {
      key: "competition.activePullRequestCount",
      value: activePullRequests.length,
      sourceUrl: activePullRequests[0]?.sourceUrl ?? input.issue.canonicalUrl,
      observedAt: input.asOf,
      freshnessDays: activePullRequests[0]
        ? daysBetween(input.asOf, activePullRequests[0].updatedAt)
        : 0,
    },
    {
      key: "competition.draftPullRequestCount",
      value: draftPullRequests.length,
      sourceUrl: draftPullRequests[0]?.sourceUrl ?? input.issue.canonicalUrl,
      observedAt: input.asOf,
      freshnessDays: draftPullRequests[0]
        ? daysBetween(input.asOf, draftPullRequests[0].updatedAt)
        : 0,
    },
    {
      key: "competition.mergedPullRequestCount",
      value: mergedPullRequests.length,
      sourceUrl: mergedPullRequests[0]?.sourceUrl ?? input.issue.canonicalUrl,
      observedAt: input.asOf,
      freshnessDays: mergedPullRequests[0]?.mergedAt
        ? daysBetween(input.asOf, mergedPullRequests[0].mergedAt)
        : 0,
    },
    {
      key: "competition.closedPullRequestCount",
      value: closedPullRequests.length,
      sourceUrl: closedPullRequests[0]?.sourceUrl ?? input.issue.canonicalUrl,
      observedAt: input.asOf,
      freshnessDays: closedPullRequests[0]?.closedAt
        ? daysBetween(input.asOf, closedPullRequests[0].closedAt)
        : 0,
    },
    {
      key: "competition.claimCommentCount",
      value: claimComments.length,
      sourceUrl: latestClaim?.sourceUrl ?? input.issue.canonicalUrl,
      observedAt: input.asOf,
      freshnessDays: latestClaim ? daysBetween(input.asOf, latestClaim.createdAt) : 0,
    },
    {
      key: "competition.nonPullRequestReferenceCount",
      value: nonPullRequestReferences.length,
      sourceUrl: input.issue.canonicalUrl,
      observedAt: input.asOf,
      freshnessDays: 0,
    },
  ];

  const inferences: CompetitionInference[] = [];
  if (input.issue.assignees.length > 0)
    inferences.push({
      key: "competition.assigned",
      value: true,
      basisFactKeys: ["issue.assigneeCount"],
      caution: "Assignment is visible evidence, but it does not prove work is still active.",
    });
  if (activePullRequests.length > 0)
    inferences.push({
      key: "competition.activeImplementation",
      value: true,
      basisFactKeys: ["competition.activePullRequestCount", "competition.draftPullRequestCount"],
      caution:
        "An open or draft linked pull request is active visible work, but it may still be abandoned.",
    });
  else if (mergedPullRequests.length + closedPullRequests.length > 0)
    inferences.push({
      key: "competition.historicalImplementation",
      value: true,
      basisFactKeys: ["competition.mergedPullRequestCount", "competition.closedPullRequestCount"],
      caution:
        "Closed or merged work is historical evidence and is weaker than an active implementation.",
    });
  if (claimComments.length > 0)
    inferences.push({
      key: "competition.claimLanguage",
      value: true,
      basisFactKeys: ["competition.claimCommentCount"],
      caution: "Claim language indicates intent only; it does not establish ownership or progress.",
    });
  if (
    input.issue.assignees.length === 0 &&
    activePullRequests.length === 0 &&
    claimComments.length === 0
  )
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
  const score = Math.max(
    activePullRequests.length >= 3
      ? 100
      : activePullRequests.length === 2
        ? 90
        : activePullRequests.length === 1
          ? 80
          : 0,
    input.issue.assignees.length > 0 ? 75 : 0,
    claimComments.length > 0 ? 50 : 0,
    mergedPullRequests.length > 0 ? 20 : 0,
    closedPullRequests.length > 0 ? 10 : 0,
  );
  const status: CompetitionStatus =
    activePullRequests.length > 0 || input.issue.assignees.length > 0
      ? "visible"
      : claimComments.length > 0 || mergedPullRequests.length + closedPullRequests.length > 0
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
