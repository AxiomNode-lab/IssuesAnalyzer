export { GitHubClient, type GitHubClientOptions } from "./client";
export { GitHubClientError, type GitHubClientErrorKind } from "./errors";
export {
  FixedWindowRateLimiter,
  InFlightDeduplicator,
  MemoryStaleCache,
  scopedCacheKey,
  type CachePolicy,
  type CacheResult,
  type CacheState,
  type RateLimitDecision,
} from "./resilience";
export type {
  GitHubActor,
  GitHubCommitEvidence,
  GitHubCommunityProfile,
  GitHubIssue,
  GitHubIssueComment,
  GitHubIssueEvent,
  GitHubPullRequestEvidence,
  GitHubQuota,
  GitHubReleaseEvidence,
  GitHubRepository,
  GitHubResponse,
} from "./types";
