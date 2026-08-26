export type CompetitionStatus = "none_visible" | "possible" | "visible" | "uncertain";
export type ConfidenceLevel = "high" | "medium" | "low";

export type ActorEvidence = Readonly<{ login: string; profileUrl: string }>;
export type CommentEvidence = Readonly<{
  author: ActorEvidence;
  body: string | null;
  createdAt: Date;
  sourceUrl: string;
}>;
export type TimelineEvidence = Readonly<{
  event: string;
  actor: ActorEvidence | null;
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
  version: "competition-v1";
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
const CLAIM_PATTERN =
  /\b(?:i(?:'|’)d like to work on|i(?:'|’)ll work on|i am working on|i(?:'|’)m working on|working on this|let me work on|claim(?:ing)? this|can i work on)\b/i;
const REFERENCE_EVENTS = new Set(["cross-referenced", "connected", "referenced"]);

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

function evidenceConfidence(sources: number): Readonly<{ level: ConfidenceLevel; value: number }> {
  const value = Math.round((sources / 4) * 100);
  return { level: value >= 75 ? "high" : value >= 50 ? "medium" : "low", value };
}

function referencesIssue(text: string, number: number, canonicalUrl: string): boolean {
  if (text.includes(canonicalUrl)) return true;
  return new RegExp(`(^|\\s)#${number}(?=\\s|$|[.,;:!?)}\\]])`).test(text);
}

export function analyzeCompetition(input: CompetitionInput): CompetitionResult {
  validDate(input.asOf, "asOf");
  if (!Number.isSafeInteger(input.issue.number) || input.issue.number <= 0)
    throw new RangeError("Issue number must be a positive safe integer.");

  for (const comment of input.comments ?? [])
    historicalDate(comment.createdAt, input.asOf, "comment");
  for (const event of input.timeline ?? [])
    historicalDate(event.createdAt, input.asOf, "timeline event");
  for (const pullRequest of input.pullRequests ?? []) {
    historicalDate(pullRequest.createdAt, input.asOf, "pull request creation");
    historicalDate(pullRequest.updatedAt, input.asOf, "pull request update");
    if (pullRequest.closedAt !== null)
      historicalDate(pullRequest.closedAt, input.asOf, "pull request closure");
    if (pullRequest.mergedAt !== null)
      historicalDate(pullRequest.mergedAt, input.asOf, "pull request merge");
  }

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
    (item) => `${item.event}:${item.sourceUrl}`,
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
      CLAIM_PATTERN.test(comment.body),
  );
  const linkedPullRequests = pullRequests.filter((pullRequest) =>
    referencesIssue(
      `${pullRequest.title}\n${pullRequest.body ?? ""}`,
      input.issue.number,
      input.issue.canonicalUrl,
    ),
  );
  const referenceEvents = timeline.filter((event) => REFERENCE_EVENTS.has(event.event));

  const latestLinked = linkedPullRequests[0];
  const latestClaim = claimComments[0];
  const latestReference = referenceEvents[0];
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
      sourceUrl: latestLinked?.sourceUrl ?? input.issue.canonicalUrl,
      observedAt: input.asOf,
      freshnessDays:
        latestLinked === undefined ? 0 : daysBetween(input.asOf, latestLinked.updatedAt),
    },
    {
      key: "competition.claimCommentCount",
      value: claimComments.length,
      sourceUrl: latestClaim?.sourceUrl ?? input.issue.canonicalUrl,
      observedAt: input.asOf,
      freshnessDays: latestClaim === undefined ? 0 : daysBetween(input.asOf, latestClaim.createdAt),
    },
    {
      key: "competition.referenceEventCount",
      value: referenceEvents.length,
      sourceUrl: latestReference?.sourceUrl ?? input.issue.canonicalUrl,
      observedAt: input.asOf,
      freshnessDays:
        latestReference === undefined ? 0 : daysBetween(input.asOf, latestReference.createdAt),
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
  if (linkedPullRequests.length > 0)
    inferences.push({
      key: "competition.linkedPullRequest",
      value: true,
      basisFactKeys: ["competition.linkedPullRequestCount"],
      caution: "A linked pull request may be incomplete, abandoned, or incorrect.",
    });
  if (claimComments.length > 0)
    inferences.push({
      key: "competition.claimLanguage",
      value: true,
      basisFactKeys: ["competition.claimCommentCount"],
      caution: "Claim language indicates intent only; it does not establish ownership or progress.",
    });
  if (referenceEvents.length > 0)
    inferences.push({
      key: "competition.referencedActivity",
      value: true,
      basisFactKeys: ["competition.referenceEventCount"],
      caution: "A timeline reference can indicate related activity without proving competing work.",
    });
  if (
    input.issue.assignees.length === 0 &&
    linkedPullRequests.length === 0 &&
    claimComments.length === 0 &&
    referenceEvents.length === 0
  )
    inferences.push({
      key: "competition.noneVisible",
      value: true,
      basisFactKeys: [
        "issue.assigneeCount",
        "competition.linkedPullRequestCount",
        "competition.claimCommentCount",
        "competition.referenceEventCount",
      ],
      caution: "No visible signal does not guarantee nobody else is working on the issue.",
    });

  const warnings: string[] = [];
  if (input.comments === null) warnings.push("Comment evidence is unavailable.");
  if (input.timeline === null) warnings.push("Timeline evidence is unavailable.");
  if (input.pullRequests === null) warnings.push("Pull request evidence is unavailable.");
  if ((input.comments?.length ?? 0) > MAX_COMMENTS)
    warnings.push("Comment evidence was bounded to 500 records.");
  if ((input.timeline?.length ?? 0) > MAX_TIMELINE_EVENTS)
    warnings.push("Timeline evidence was bounded to 300 records.");
  if ((input.pullRequests?.length ?? 0) > MAX_PULL_REQUESTS)
    warnings.push("Pull request evidence was bounded to 100 records.");

  const confidence = evidenceConfidence(
    1 +
      Number(input.comments !== null) +
      Number(input.timeline !== null) +
      Number(input.pullRequests !== null),
  );
  const score = Math.max(
    linkedPullRequests.length > 0 ? 90 : 0,
    input.issue.assignees.length > 0 ? 75 : 0,
    claimComments.length > 0 ? 50 : 0,
    referenceEvents.length > 0 ? 35 : 0,
  );
  const status: CompetitionStatus =
    linkedPullRequests.length > 0 || input.issue.assignees.length > 0
      ? "visible"
      : claimComments.length > 0 || referenceEvents.length > 0
        ? "possible"
        : input.comments === null && input.timeline === null && input.pullRequests === null
          ? "uncertain"
          : "none_visible";

  return {
    version: "competition-v1",
    status,
    score,
    confidence,
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
