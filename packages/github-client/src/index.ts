export { GitHubClient, type GitHubClientOptions } from "./client";
export { GitHubClientError, type GitHubClientErrorKind } from "./errors";
export {
  EVIDENCE_CACHE_POLICIES,
  FixedWindowRateLimiter,
  InFlightDeduplicator,
  MemoryStaleCache,
  StaleWhileRevalidateCache,
  scopedCacheKey,
  type CachePolicy,
  type CacheResult,
  type CacheState,
  type RateLimitDecision,
  type RefreshResult,
  type ResilientCacheResult,
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
  GitHubReferencedPullRequest,
  GitHubReleaseEvidence,
  GitHubRepository,
  GitHubResponse,
} from "./types";
