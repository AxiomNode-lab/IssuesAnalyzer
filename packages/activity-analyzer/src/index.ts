export type ActivityStatus = "active" | "quiet" | "new" | "archived" | "uncertain";
export type ConfidenceLevel = "high" | "medium" | "low";

export type TimestampEvidence = Readonly<{
  occurredAt: Date;
  sourceUrl: string;
}>;

export type ContributionReadiness = Readonly<{
  contributingGuide: boolean;
  codeOfConduct: boolean;
  issueTemplates: boolean;
  sourceUrl: string;
}>;

export type RepositoryActivityInput = Readonly<{
  asOf: Date;
  repository: Readonly<{
    htmlUrl: string;
    createdAt: Date;
    pushedAt: Date | null;
    archived: boolean;
    disabled: boolean;
  }>;
  commits: readonly TimestampEvidence[] | null;
  releases: readonly TimestampEvidence[] | null;
  readiness: ContributionReadiness | null;
}>;

export type ActivityFact = Readonly<{
  key: string;
  value: string | number | boolean | null;
  sourceUrl: string;
  observedAt: Date;
  freshnessDays: number;
}>;

export type RepositoryActivityResult = Readonly<{
  version: "activity-v1";
  status: ActivityStatus;
  score: number;
  confidence: Readonly<{ level: ConfidenceLevel; value: number }>;
  facts: readonly ActivityFact[];
  warnings: readonly string[];
  evidenceWindow: Readonly<{ commitsUsed: number; releasesUsed: number }>;
}>;

const DAY = 86_400_000;
const MAX_COMMITS = 100;
const MAX_RELEASES = 20;

function daysBetween(later: Date, earlier: Date): number {
  return Math.max(0, Math.floor((later.getTime() - earlier.getTime()) / DAY));
}

function validDate(date: Date, name: string): void {
  if (Number.isNaN(date.getTime())) throw new TypeError(`Invalid ${name} date.`);
}

function newest(items: readonly TimestampEvidence[]): TimestampEvidence | null {
  return items.reduce<TimestampEvidence | null>(
    (latest, item) => (latest === null || item.occurredAt > latest.occurredAt ? item : latest),
    null,
  );
}

function recencyScore(days: number): number {
  if (days <= 14) return 100;
  if (days <= 30) return 85;
  if (days <= 90) return 65;
  if (days <= 180) return 40;
  return 15;
}

function confidence(presentSignals: number): Readonly<{ level: ConfidenceLevel; value: number }> {
  const value = Math.round((presentSignals / 4) * 100);
  return { level: value >= 75 ? "high" : value >= 50 ? "medium" : "low", value };
}

export function analyzeRepositoryActivity(input: RepositoryActivityInput): RepositoryActivityResult {
  validDate(input.asOf, "asOf");
  validDate(input.repository.createdAt, "repository creation");
  if (input.repository.pushedAt !== null) validDate(input.repository.pushedAt, "repository push");

  const commits = input.commits?.slice(0, MAX_COMMITS) ?? [];
  const releases = input.releases?.slice(0, MAX_RELEASES) ?? [];
  for (const evidence of [...commits, ...releases]) validDate(evidence.occurredAt, "evidence");

  const latestCommit = newest(commits);
  const latestRelease = newest(releases);
  const candidates = [
    input.repository.pushedAt === null
      ? null
      : { occurredAt: input.repository.pushedAt, sourceUrl: input.repository.htmlUrl },
    latestCommit,
    latestRelease,
  ].filter((value): value is TimestampEvidence => value !== null);
  const latestActivity = newest(candidates);
  const facts: ActivityFact[] = [
    {
      key: "repository.archived",
      value: input.repository.archived,
      sourceUrl: input.repository.htmlUrl,
      observedAt: input.asOf,
      freshnessDays: 0,
    },
    {
      key: "repository.disabled",
      value: input.repository.disabled,
      sourceUrl: input.repository.htmlUrl,
      observedAt: input.asOf,
      freshnessDays: 0,
    },
    {
      key: "repository.createdAt",
      value: input.repository.createdAt.toISOString(),
      sourceUrl: input.repository.htmlUrl,
      observedAt: input.asOf,
      freshnessDays: daysBetween(input.asOf, input.repository.createdAt),
    },
  ];

  if (latestActivity !== null) {
    facts.push({
      key: "repository.latestActivityAt",
      value: latestActivity.occurredAt.toISOString(),
      sourceUrl: latestActivity.sourceUrl,
      observedAt: input.asOf,
      freshnessDays: daysBetween(input.asOf, latestActivity.occurredAt),
    });
  }
  if (input.readiness !== null) {
    facts.push({
      key: "repository.readinessSignals",
      value: [
        input.readiness.contributingGuide,
        input.readiness.codeOfConduct,
        input.readiness.issueTemplates,
      ].filter(Boolean).length,
      sourceUrl: input.readiness.sourceUrl,
      observedAt: input.asOf,
      freshnessDays: 0,
    });
  }

  const warnings: string[] = [];
  if (input.commits === null) warnings.push("Commit evidence is unavailable.");
  if (input.releases === null) warnings.push("Release evidence is unavailable.");
  if (input.readiness === null) warnings.push("Contribution-readiness evidence is unavailable.");
  if ((input.commits?.length ?? 0) > MAX_COMMITS) warnings.push("Commit evidence was bounded to 100 records.");
  if ((input.releases?.length ?? 0) > MAX_RELEASES) warnings.push("Release evidence was bounded to 20 records.");

  const evidenceConfidence = confidence(
    1 + Number(input.commits !== null) + Number(input.releases !== null) + Number(input.readiness !== null),
  );

  if (input.repository.archived || input.repository.disabled) {
    return {
      version: "activity-v1",
      status: "archived",
      score: 0,
      confidence: evidenceConfidence,
      facts,
      warnings,
      evidenceWindow: { commitsUsed: commits.length, releasesUsed: releases.length },
    };
  }

  const availableScores: number[] = [];
  if (latestActivity !== null) availableScores.push(recencyScore(daysBetween(input.asOf, latestActivity.occurredAt)));
  if (input.readiness !== null) {
    const readinessCount = [
      input.readiness.contributingGuide,
      input.readiness.codeOfConduct,
      input.readiness.issueTemplates,
    ].filter(Boolean).length;
    availableScores.push(Math.round((readinessCount / 3) * 100));
  }

  const score =
    availableScores.length === 0
      ? 50
      : Math.round(availableScores.reduce((sum, value) => sum + value, 0) / availableScores.length);
  const repositoryAgeDays = daysBetween(input.asOf, input.repository.createdAt);
  const status: ActivityStatus =
    repositoryAgeDays <= 45 && commits.length <= 1 && releases.length === 0
      ? "new"
      : latestActivity === null
        ? "uncertain"
        : score >= 65
          ? "active"
          : "quiet";

  return {
    version: "activity-v1",
    status,
    score,
    confidence: evidenceConfidence,
    facts,
    warnings,
    evidenceWindow: { commitsUsed: commits.length, releasesUsed: releases.length },
  };
}
