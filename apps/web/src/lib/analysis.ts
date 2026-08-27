import { analyzeRepositoryActivity } from "@opportunity-radar/activity-analyzer";
import type { RepositoryActivityResult } from "@opportunity-radar/activity-analyzer";
import { analyzeCompetition } from "@opportunity-radar/competition-analyzer";
import type { CompetitionResult } from "@opportunity-radar/competition-analyzer";
import { parseGitHubIssueUrl } from "@opportunity-radar/domain";
import type { GitHubIssueUrl } from "@opportunity-radar/domain";
import {
  EVIDENCE_CACHE_POLICIES,
  GitHubClient,
  GitHubClientError,
  StaleWhileRevalidateCache,
  scopedCacheKey,
} from "@opportunity-radar/github-client";
import type {
  GitHubIssue,
  GitHubIssueComment,
  GitHubIssueEvent,
  GitHubPullRequestEvidence,
  GitHubQuota,
  GitHubResponse,
} from "@opportunity-radar/github-client";
import { analyzeMaintainerResponsiveness } from "@opportunity-radar/responsiveness-analyzer";
import type { ResponsivenessResult } from "@opportunity-radar/responsiveness-analyzer";
import { calculateOpportunityScore } from "@opportunity-radar/scoring-engine";
import type { HardWarningInput } from "@opportunity-radar/scoring-engine";

import type {
  AnalysisReportModel,
  ReportComponent,
  ReportEvidence,
  ReportInference,
} from "../components/analysis-report";
import { recordMetric, structuredLog } from "./observability";

export class InvalidAnalysisInputError extends Error {
  constructor(readonly publicMessage: string) {
    super(publicMessage);
    this.name = "InvalidAnalysisInputError";
  }
}

type EvidenceClient = Pick<
  GitHubClient,
  | "getIssue"
  | "listIssueComments"
  | "getRepository"
  | "listRecentCommits"
  | "listRecentReleases"
  | "getCommunityProfile"
  | "listIssueTimeline"
  | "listRecentPullRequests"
>;

type AnalysisServiceOptions = Readonly<{
  client: EvidenceClient;
  cache?: StaleWhileRevalidateCache;
  now?: () => Date;
}>;

const MAINTAINER_ASSOCIATIONS = new Set(["COLLABORATOR", "MEMBER", "OWNER"]);

function observeQuota(quota: GitHubQuota): void {
  if (quota.remaining !== null) recordMetric("github_quota_remaining", quota.remaining);
}

async function optionalEvidence<T>(load: () => Promise<GitHubResponse<T>>): Promise<T | null> {
  try {
    const response = await load();
    observeQuota(response.quota);
    return response.data;
  } catch (error) {
    if (
      error instanceof GitHubClientError &&
      (error.kind === "not_found" || error.kind === "forbidden")
    ) {
      return null;
    }
    throw error;
  }
}

function valueLabel(value: string | number | boolean | null): string {
  if (value === null) return "Unavailable";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function factLabel(key: string): string {
  const labels: Readonly<Record<string, string>> = {
    "repository.archived": "Repository archived",
    "repository.disabled": "Repository disabled",
    "repository.createdAt": "Repository created",
    "repository.latestActivityAt": "Latest repository activity",
    "repository.readinessSignals": "Contribution-readiness signals",
    "issue.assigneeCount": "Issue assignees",
    "competition.linkedPullRequestCount": "Linked pull requests",
    "competition.claimCommentCount": "Visible claim comments",
    "competition.referenceEventCount": "Timeline references",
    "responsiveness.sampleSize": "Historical sample",
    "responsiveness.respondedThreads": "Threads with maintainer response",
    "responsiveness.responseCoveragePercent": "Response coverage percent",
    "responsiveness.observedMedianHours": "Observed median response hours",
  };
  return labels[key] ?? key;
}

function inferenceLabel(key: string): string {
  return key
    .split(".")
    .at(-1)!
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (character) => character.toUpperCase());
}

function activityComponent(result: RepositoryActivityResult): ReportComponent {
  return {
    key: "activity",
    label: "Repository activity",
    score: result.score,
    weight: 0.3,
    confidence: result.confidence.level,
    reason: `Repository activity is classified as ${result.status.replace("_", " ")}.`,
    facts: result.facts.map((fact): ReportEvidence => ({
      label: factLabel(fact.key),
      value: valueLabel(fact.value),
      sourceUrl: fact.sourceUrl,
      freshnessDays: fact.freshnessDays,
    })),
    warnings: result.warnings,
  };
}

function competitionComponent(result: CompetitionResult): ReportComponent {
  return {
    key: "competition",
    label: "Visible competition",
    score: result.score,
    weight: 0.4,
    confidence: result.confidence.level,
    reason: `Visible competition is classified as ${result.status.replace("_", " ")}.`,
    facts: result.facts.map((fact): ReportEvidence => ({
      label: factLabel(fact.key),
      value: valueLabel(fact.value),
      sourceUrl: fact.sourceUrl,
      freshnessDays: fact.freshnessDays,
    })),
    inferences: result.inferences.map((inference): ReportInference => ({
      label: inferenceLabel(inference.key),
      value: valueLabel(inference.value),
      caution: inference.caution,
    })),
    warnings: result.warnings,
  };
}

function responsivenessComponent(result: ResponsivenessResult): ReportComponent {
  return {
    key: "responsiveness",
    label: "Maintainer responsiveness",
    score: result.score,
    weight: 0.3,
    confidence: result.confidence.level,
    reason: `Historical maintainer responsiveness is classified as ${result.status}.`,
    facts: result.facts.map((fact): ReportEvidence => ({
      label: factLabel(fact.key),
      value: valueLabel(fact.value),
      sourceUrl: fact.sourceUrl,
      freshnessDays: 0,
    })),
    inferences: result.inferences.map((inference): ReportInference => ({
      label: inferenceLabel(inference.key),
      value: valueLabel(inference.value),
      caution: inference.caution,
    })),
    warnings: result.warnings,
  };
}

function commentsAsThread(issue: GitHubIssue, comments: readonly GitHubIssueComment[] | null) {
  if (comments === null) return null;
  return [
    {
      kind: "issue" as const,
      openedAt: issue.createdAt,
      sourceUrl: issue.htmlUrl,
      interactions: comments.map((comment) => ({
        actorLogin: comment.author.login,
        actorIsBot: comment.author.login.toLowerCase().endsWith("[bot]"),
        actorIsMaintainer: MAINTAINER_ASSOCIATIONS.has(comment.authorAssociation),
        createdAt: comment.createdAt,
        sourceUrl: comment.htmlUrl,
      })),
    },
  ];
}

function nextAction(decision: "pursue" | "review_carefully" | "skip"): string {
  if (decision === "pursue")
    return "Review the contribution guide and confirm availability with maintainers.";
  if (decision === "skip") return "Choose another issue unless the highlighted blockers change.";
  return "Review the risks and confirm the issue is still available before investing effort.";
}

function hardWarnings(
  issue: GitHubIssue,
  repository: { archived: boolean; disabled: boolean },
): HardWarningInput[] {
  const warnings: HardWarningInput[] = [];
  if (repository.archived)
    warnings.push({
      key: "repository_archived",
      evidenceKeys: ["repository.archived"],
      reason: "The repository is archived.",
    });
  if (repository.disabled)
    warnings.push({
      key: "repository_disabled",
      evidenceKeys: ["repository.disabled"],
      reason: "The repository is disabled.",
    });
  if (issue.state === "closed")
    warnings.push({
      key: "issue_closed",
      evidenceKeys: ["issue.state"],
      reason: "The issue is closed.",
    });
  return warnings;
}

async function buildReport(
  reference: GitHubIssueUrl,
  client: EvidenceClient,
  asOf: Date,
): Promise<AnalysisReportModel> {
  const [issueResponse, repositoryResponse] = await Promise.all([
    client.getIssue(reference),
    client.getRepository(reference),
  ]);
  observeQuota(issueResponse.quota);
  observeQuota(repositoryResponse.quota);
  const issue = issueResponse.data;
  const repository = repositoryResponse.data;

  const [comments, commits, releases, readiness, timeline, pullRequests] = await Promise.all([
    optionalEvidence(() => client.listIssueComments(reference)),
    optionalEvidence(() => client.listRecentCommits(reference)),
    optionalEvidence(() => client.listRecentReleases(reference)),
    optionalEvidence(() => client.getCommunityProfile(reference)),
    optionalEvidence(() => client.listIssueTimeline(reference)),
    optionalEvidence(() => client.listRecentPullRequests(reference)),
  ]);

  const activity = analyzeRepositoryActivity({
    asOf,
    repository,
    commits:
      commits?.map((commit) => ({ occurredAt: commit.committedAt, sourceUrl: commit.htmlUrl })) ??
      null,
    releases:
      releases?.map((release) => ({
        occurredAt: release.publishedAt,
        sourceUrl: release.htmlUrl,
      })) ?? null,
    readiness:
      readiness === null
        ? null
        : {
            contributingGuide: readiness.contributingGuide,
            codeOfConduct: readiness.codeOfConduct,
            issueTemplates: readiness.issueTemplate,
            sourceUrl: readiness.sourceUrl,
          },
  });
  const competition = analyzeCompetition({
    asOf,
    issue: {
      number: issue.number,
      canonicalUrl: reference.canonicalUrl,
      authorLogin: issue.author.login,
      assignees: issue.assignees,
    },
    comments:
      comments?.map((comment) => ({
        author: comment.author,
        body: comment.body,
        createdAt: comment.createdAt,
        sourceUrl: comment.htmlUrl,
      })) ?? null,
    timeline:
      timeline?.map((event: GitHubIssueEvent) => ({
        event: event.event,
        actor: event.actor,
        createdAt: event.createdAt,
        sourceUrl: event.sourceUrl,
      })) ?? null,
    pullRequests:
      pullRequests?.map((pullRequest: GitHubPullRequestEvidence) => ({
        ...pullRequest,
        sourceUrl: pullRequest.htmlUrl,
      })) ?? null,
  });
  const responsiveness = analyzeMaintainerResponsiveness({
    asOf,
    repositoryUrl: repository.htmlUrl,
    threads: commentsAsThread(issue, comments),
  });
  const score = calculateOpportunityScore({
    components: [
      {
        key: "activity",
        score: activity.score,
        confidence: activity.confidence,
        evidenceKeys: activity.facts.map((fact) => fact.key),
        reason: `Repository activity is ${activity.status}.`,
        warnings: activity.warnings,
      },
      {
        key: "competition",
        score: competition.score,
        confidence: competition.confidence,
        evidenceKeys: competition.facts.map((fact) => fact.key),
        reason: `Visible competition is ${competition.status}.`,
        warnings: competition.warnings,
      },
      {
        key: "responsiveness",
        score: responsiveness.score,
        confidence: responsiveness.confidence,
        evidenceKeys: responsiveness.facts.map((fact) => fact.key),
        reason: `Maintainer responsiveness is ${responsiveness.status}.`,
        warnings: responsiveness.warnings,
      },
    ],
    hardWarnings: hardWarnings(issue, repository),
  });
  const components = [
    activityComponent(activity),
    competitionComponent(competition),
    responsivenessComponent(responsiveness),
  ];
  const risks = [...score.warnings, ...score.hardWarningsApplied.map((warning) => warning.reason)];

  return {
    repository: repository.fullName,
    issueNumber: issue.number,
    issueTitle: issue.title,
    issueUrl: issue.htmlUrl,
    score: score.score,
    scoreVersion: score.version,
    verdict: score.decision,
    confidence: score.confidence.level,
    generatedAt: asOf.toISOString(),
    partial: components.some((component) => (component.warnings?.length ?? 0) > 0),
    stale: false,
    nextAction: nextAction(score.decision),
    components,
    risks: [...new Set(risks)],
  };
}

export function createAnalysisService(options: AnalysisServiceOptions) {
  const cache = options.cache ?? new StaleWhileRevalidateCache();
  const now = options.now ?? (() => new Date());

  return async (input: string): Promise<AnalysisReportModel> => {
    const parsed = parseGitHubIssueUrl(input);
    if (!parsed.ok) throw new InvalidAnalysisInputError(parsed.error.message);
    const key = scopedCacheKey(
      "public",
      `analysis:${parsed.value.owner.toLowerCase()}/${parsed.value.repository.toLowerCase()}#${parsed.value.issueNumber}`,
    );
    const cachedBeforeRequest = cache.cache.get<AnalysisReportModel>(key);
    const result = await cache.getOrRefresh({
      key,
      policy: EVIDENCE_CACHE_POLICIES.analysis,
      load: () => buildReport(parsed.value, options.client, now()),
    });
    recordMetric(cachedBeforeRequest === null ? "cache_miss" : "cache_hit", 1);
    structuredLog("info", "analysis_cache", { state: result.state, resource: key });
    return result.state === "stale" ? { ...result.value, stale: true } : result.value;
  };
}

const token = process.env.GITHUB_TOKEN?.trim();
const client = new GitHubClient(token ? { token } : {});
export const analyzeIssue = createAnalysisService({ client });
