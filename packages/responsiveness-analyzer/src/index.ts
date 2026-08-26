export type ResponsivenessStatus = "responsive" | "mixed" | "slow" | "insufficient";
export type ConfidenceLevel = "high" | "medium" | "low";

export type InteractionEvidence = Readonly<{
  actorLogin: string;
  actorIsBot: boolean;
  actorIsMaintainer: boolean;
  createdAt: Date;
  sourceUrl: string;
}>;

export type ThreadEvidence = Readonly<{
  kind: "issue" | "pull_request";
  openedAt: Date;
  sourceUrl: string;
  interactions: readonly InteractionEvidence[];
}>;

export type ResponsivenessInput = Readonly<{
  asOf: Date;
  repositoryUrl: string;
  threads: readonly ThreadEvidence[] | null;
}>;

export type ResponsivenessFact = Readonly<{
  key: string;
  value: string | number | boolean | null;
  sourceUrl: string;
  observedAt: Date;
}>;

export type ResponsivenessInference = Readonly<{
  key: string;
  value: string | number | boolean;
  basisFactKeys: readonly string[];
  caution: string;
}>;

export type ResponsivenessResult = Readonly<{
  version: "responsiveness-v1";
  status: ResponsivenessStatus;
  score: number;
  confidence: Readonly<{ level: ConfidenceLevel; value: number }>;
  facts: readonly ResponsivenessFact[];
  inferences: readonly ResponsivenessInference[];
  warnings: readonly string[];
  sample: Readonly<{
    threadsUsed: number;
    respondedThreads: number;
    unansweredThreads: number;
    interactionsUsed: number;
  }>;
}>;

const HOUR = 3_600_000;
const MAX_THREADS = 50;
const MAX_INTERACTIONS_PER_THREAD = 100;
const MIN_CLASSIFICATION_SAMPLE = 3;

function validDate(value: Date, name: string): void {
  if (Number.isNaN(value.getTime())) throw new TypeError(`Invalid ${name} date.`);
}

function historicalDate(value: Date, asOf: Date, name: string): void {
  validDate(value, name);
  if (value > asOf) throw new RangeError(`${name} date cannot be after asOf.`);
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0
    ? ((ordered[middle - 1] ?? 0) + (ordered[middle] ?? 0)) / 2
    : (ordered[middle] ?? null);
}

function confidence(
  threadsUsed: number,
  respondedThreads: number,
): Readonly<{ level: ConfidenceLevel; value: number }> {
  if (threadsUsed === 0) return { level: "low", value: 0 };
  const sizeScore = Math.min(1, threadsUsed / 15);
  const coverage = respondedThreads / threadsUsed;
  const value = Math.round((sizeScore * 0.7 + coverage * 0.3) * 100);
  return { level: value >= 75 ? "high" : value >= 45 ? "medium" : "low", value };
}

export function analyzeMaintainerResponsiveness(
  input: ResponsivenessInput,
): ResponsivenessResult {
  validDate(input.asOf, "asOf");

  if (input.threads === null) {
    return {
      version: "responsiveness-v1",
      status: "insufficient",
      score: 50,
      confidence: { level: "low", value: 0 },
      facts: [
        {
          key: "responsiveness.sampleSize",
          value: 0,
          sourceUrl: input.repositoryUrl,
          observedAt: input.asOf,
        },
      ],
      inferences: [],
      warnings: ["Historical responsiveness evidence is unavailable."],
      sample: {
        threadsUsed: 0,
        respondedThreads: 0,
        unansweredThreads: 0,
        interactionsUsed: 0,
      },
    };
  }

  for (const thread of input.threads) {
    historicalDate(thread.openedAt, input.asOf, "thread opening");
    for (const interaction of thread.interactions) {
      historicalDate(interaction.createdAt, input.asOf, "interaction");
      if (interaction.createdAt < thread.openedAt)
        throw new RangeError("Interaction date cannot be before thread opening.");
    }
  }

  const threads = [...input.threads]
    .sort((left, right) => {
      const difference = right.openedAt.getTime() - left.openedAt.getTime();
      return difference === 0 ? left.sourceUrl.localeCompare(right.sourceUrl) : difference;
    })
    .slice(0, MAX_THREADS);

  const responseHours: number[] = [];
  let interactionsUsed = 0;
  for (const thread of threads) {
    const interactions = [...thread.interactions]
      .sort((left, right) => {
        const difference = left.createdAt.getTime() - right.createdAt.getTime();
        return difference === 0 ? left.sourceUrl.localeCompare(right.sourceUrl) : difference;
      })
      .slice(0, MAX_INTERACTIONS_PER_THREAD);
    interactionsUsed += interactions.length;
    const firstMaintainerResponse = interactions.find(
      (interaction) => interaction.actorIsMaintainer && !interaction.actorIsBot,
    );
    if (firstMaintainerResponse !== undefined)
      responseHours.push(
        (firstMaintainerResponse.createdAt.getTime() - thread.openedAt.getTime()) / HOUR,
      );
  }

  const medianHours = median(responseHours);
  const respondedThreads = responseHours.length;
  const unansweredThreads = threads.length - respondedThreads;
  const responseCoverage =
    threads.length === 0 ? null : Math.round((respondedThreads / threads.length) * 100);
  const facts: ResponsivenessFact[] = [
    {
      key: "responsiveness.sampleSize",
      value: threads.length,
      sourceUrl: input.repositoryUrl,
      observedAt: input.asOf,
    },
    {
      key: "responsiveness.respondedThreads",
      value: respondedThreads,
      sourceUrl: input.repositoryUrl,
      observedAt: input.asOf,
    },
    {
      key: "responsiveness.responseCoveragePercent",
      value: responseCoverage,
      sourceUrl: input.repositoryUrl,
      observedAt: input.asOf,
    },
    {
      key: "responsiveness.observedMedianHours",
      value: medianHours === null ? null : Math.round(medianHours * 10) / 10,
      sourceUrl: input.repositoryUrl,
      observedAt: input.asOf,
    },
  ];

  const warnings: string[] = [];
  if (input.threads.length > MAX_THREADS)
    warnings.push("Historical thread evidence was bounded to 50 records.");
  if (input.threads.some((thread) => thread.interactions.length > MAX_INTERACTIONS_PER_THREAD))
    warnings.push("Interactions were bounded to 100 records per thread.");
  if (threads.length < MIN_CLASSIFICATION_SAMPLE)
    warnings.push("The historical sample is too small for a responsiveness classification.");
  if (respondedThreads < MIN_CLASSIFICATION_SAMPLE)
    warnings.push("Too few maintainer responses were observed for a reliable classification.");

  const status: ResponsivenessStatus =
    respondedThreads < MIN_CLASSIFICATION_SAMPLE || medianHours === null
      ? "insufficient"
      : medianHours <= 48
        ? "responsive"
        : medianHours <= 168
          ? "mixed"
          : "slow";
  const score =
    status === "insufficient"
      ? 50
      : status === "responsive"
        ? 85
        : status === "mixed"
          ? 60
          : 25;
  const inferences: ResponsivenessInference[] =
    status === "insufficient"
      ? []
      : [
          {
            key: "responsiveness.historicalPattern",
            value: status,
            basisFactKeys: [
              "responsiveness.sampleSize",
              "responsiveness.respondedThreads",
              "responsiveness.responseCoveragePercent",
              "responsiveness.observedMedianHours",
            ],
            caution:
              "Historical maintainer behavior does not predict an exact response time or guarantee a reply.",
          },
        ];

  return {
    version: "responsiveness-v1",
    status,
    score,
    confidence: confidence(threads.length, respondedThreads),
    facts,
    inferences,
    warnings,
    sample: {
      threadsUsed: threads.length,
      respondedThreads,
      unansweredThreads,
      interactionsUsed,
    },
  };
}
