import type { GitHubIssueUrl } from "@opportunity-radar/domain";

import { GitHubClientError } from "./errors";
import {
  parseCommitPage,
  parseCommunityProfile,
  parseIssue,
  parseIssueCommentPage,
  parseIssueEventPage,
  parseIssuePage,
  parsePullRequestPage,
  parseReleasePage,
  parseRepository,
} from "./parse";
import type {
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

const API_ORIGIN = "https://api.github.com";
const API_VERSION = "2026-03-10";
const RETRYABLE_STATUS = new Set([502, 503, 504]);

type RepositoryReference = Pick<GitHubIssueUrl, "owner" | "repository">;

export type GitHubClientOptions = Readonly<{
  token?: string;
  timeoutMs?: number;
  maxRetries?: number;
  fetch?: typeof globalThis.fetch;
}>;

function boundedInteger(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function clamp(value: number | undefined, fallback: number, maximum: number): number {
  return Math.min(Math.max(value ?? fallback, 1), maximum);
}

function repositoryPath(reference: RepositoryReference): string {
  return `/repos/${encodeURIComponent(reference.owner)}/${encodeURIComponent(reference.repository)}`;
}

function quota(headers: Headers): GitHubQuota {
  const reset = boundedInteger(headers.get("x-ratelimit-reset"));
  return {
    limit: boundedInteger(headers.get("x-ratelimit-limit")),
    remaining: boundedInteger(headers.get("x-ratelimit-remaining")),
    used: boundedInteger(headers.get("x-ratelimit-used")),
    resetAt: reset === null ? null : new Date(reset * 1000),
  };
}

function retryAfter(headers: Headers): number | null {
  return boundedInteger(headers.get("retry-after"));
}

export class GitHubClient {
  readonly #token: string | undefined;
  readonly #timeoutMs: number;
  readonly #maxRetries: number;
  readonly #fetch: typeof globalThis.fetch;

  constructor(options: GitHubClientOptions = {}) {
    this.#token = options.token;
    this.#timeoutMs = Math.min(Math.max(options.timeoutMs ?? 8_000, 100), 30_000);
    this.#maxRetries = Math.min(Math.max(options.maxRetries ?? 1, 0), 2);
    this.#fetch = options.fetch ?? globalThis.fetch;
  }

  async getIssue(reference: GitHubIssueUrl): Promise<GitHubResponse<GitHubIssue>> {
    return this.#get(`${repositoryPath(reference)}/issues/${reference.issueNumber}`, parseIssue);
  }

  async listIssueComments(
    reference: GitHubIssueUrl,
    options: Readonly<{ perPage?: number; maxPages?: number }> = {},
  ): Promise<GitHubResponse<readonly GitHubIssueComment[]>> {
    return this.listIssueCommentsByNumber(reference, reference.issueNumber, options);
  }

  async listIssueCommentsByNumber(
    reference: RepositoryReference,
    issueNumber: number,
    options: Readonly<{ perPage?: number; maxPages?: number }> = {},
  ): Promise<GitHubResponse<readonly GitHubIssueComment[]>> {
    if (!Number.isSafeInteger(issueNumber) || issueNumber < 1)
      throw new RangeError("issueNumber must be a positive integer.");
    const perPage = clamp(options.perPage, 100, 100);
    const maxPages = clamp(options.maxPages, 1, 5);
    const comments: GitHubIssueComment[] = [];
    let lastMetadata: Pick<GitHubResponse<unknown>, "quota" | "requestId"> | null = null;

    for (let page = 1; page <= maxPages; page += 1) {
      const response = await this.#get(
        `${repositoryPath(reference)}/issues/${issueNumber}/comments?per_page=${perPage}&page=${page}`,
        parseIssueCommentPage,
      );
      comments.push(...response.data);
      lastMetadata = response;
      if (response.data.length < perPage) break;
    }

    return {
      data: comments,
      quota: lastMetadata?.quota ?? { limit: null, remaining: null, used: null, resetAt: null },
      requestId: lastMetadata?.requestId ?? null,
    };
  }

  async listRecentIssues(
    reference: RepositoryReference,
    options: Readonly<{ limit?: number }> = {},
  ): Promise<GitHubResponse<readonly GitHubIssue[]>> {
    const limit = clamp(options.limit, 15, 20);
    return this.#get(
      `${repositoryPath(reference)}/issues?state=all&sort=updated&direction=desc&per_page=${limit}`,
      parseIssuePage,
    );
  }

  async getRepository(reference: RepositoryReference): Promise<GitHubResponse<GitHubRepository>> {
    return this.#get(repositoryPath(reference), parseRepository);
  }

  async listRecentCommits(
    reference: RepositoryReference,
    options: Readonly<{ limit?: number }> = {},
  ): Promise<GitHubResponse<readonly GitHubCommitEvidence[]>> {
    const limit = clamp(options.limit, 100, 100);
    return this.#get(`${repositoryPath(reference)}/commits?per_page=${limit}`, parseCommitPage);
  }

  async listRecentReleases(
    reference: RepositoryReference,
    options: Readonly<{ limit?: number }> = {},
  ): Promise<GitHubResponse<readonly GitHubReleaseEvidence[]>> {
    const limit = clamp(options.limit, 20, 20);
    return this.#get(`${repositoryPath(reference)}/releases?per_page=${limit}`, parseReleasePage);
  }

  async getCommunityProfile(
    reference: RepositoryReference,
  ): Promise<GitHubResponse<GitHubCommunityProfile>> {
    const sourceUrl = `https://github.com/${reference.owner}/${reference.repository}/community`;
    return this.#get(`${repositoryPath(reference)}/community/profile`, (payload) =>
      parseCommunityProfile(payload, sourceUrl),
    );
  }

  async listIssueTimeline(
    reference: GitHubIssueUrl,
    options: Readonly<{ perPage?: number; maxPages?: number }> = {},
  ): Promise<GitHubResponse<readonly GitHubIssueEvent[]>> {
    const perPage = clamp(options.perPage, 100, 100);
    const maxPages = clamp(options.maxPages, 2, 3);
    const events: GitHubIssueEvent[] = [];
    const sourceUrl = reference.canonicalUrl;
    let lastMetadata: Pick<GitHubResponse<unknown>, "quota" | "requestId"> | null = null;

    for (let page = 1; page <= maxPages; page += 1) {
      const response = await this.#get(
        `${repositoryPath(reference)}/issues/${reference.issueNumber}/timeline?per_page=${perPage}&page=${page}`,
        (payload) => parseIssueEventPage(payload, sourceUrl),
      );
      events.push(...response.data);
      lastMetadata = response;
      if (response.data.length < perPage) break;
    }

    return {
      data: events,
      quota: lastMetadata?.quota ?? { limit: null, remaining: null, used: null, resetAt: null },
      requestId: lastMetadata?.requestId ?? null,
    };
  }

  async listRecentPullRequests(
    reference: RepositoryReference,
    options: Readonly<{ limit?: number }> = {},
  ): Promise<GitHubResponse<readonly GitHubPullRequestEvidence[]>> {
    const limit = clamp(options.limit, 100, 100);
    return this.#get(
      `${repositoryPath(reference)}/pulls?state=all&sort=updated&direction=desc&per_page=${limit}`,
      parsePullRequestPage,
    );
  }

  async #get<T>(path: string, parse: (value: unknown) => T): Promise<GitHubResponse<T>> {
    const headers = new Headers({
      Accept: "application/vnd.github+json",
      "User-Agent": "github-opportunity-radar",
      "X-GitHub-Api-Version": API_VERSION,
    });
    if (this.#token !== undefined) headers.set("Authorization", `Bearer ${this.#token}`);

    for (let attempt = 0; attempt <= this.#maxRetries; attempt += 1) {
      try {
        const response = await this.#fetch(`${API_ORIGIN}${path}`, {
          method: "GET",
          headers,
          signal: AbortSignal.timeout(this.#timeoutMs),
          redirect: "error",
        });

        const requestId = response.headers.get("x-github-request-id");
        if (!response.ok) {
          if (RETRYABLE_STATUS.has(response.status) && attempt < this.#maxRetries) continue;
          throw this.#httpError(response, requestId);
        }

        let payload: unknown;
        try {
          payload = await response.json();
        } catch (cause) {
          throw new GitHubClientError("invalid_payload", "GitHub returned invalid JSON.", {
            status: response.status,
            requestId: requestId ?? undefined,
            cause,
          });
        }

        return { data: parse(payload), quota: quota(response.headers), requestId };
      } catch (error) {
        if (error instanceof GitHubClientError) throw error;
        if (error instanceof DOMException && error.name === "TimeoutError") {
          throw new GitHubClientError("timeout", "GitHub did not respond before the deadline.", {
            cause: error,
          });
        }
        if (attempt < this.#maxRetries) continue;
        throw new GitHubClientError("network", "GitHub could not be reached.", { cause: error });
      }
    }

    throw new GitHubClientError("network", "GitHub could not be reached.");
  }

  #httpError(response: Response, requestId: string | null): GitHubClientError {
    const context = {
      status: response.status,
      retryAfterSeconds: retryAfter(response.headers) ?? undefined,
      requestId: requestId ?? undefined,
    };

    if (response.status === 404)
      return new GitHubClientError("not_found", "GitHub resource was not found.", context);
    if (
      response.status === 429 ||
      (response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0")
    ) {
      return new GitHubClientError("rate_limited", "GitHub rate limit was reached.", context);
    }
    if (response.status === 403)
      return new GitHubClientError("forbidden", "GitHub denied access to the resource.", context);
    return new GitHubClientError("upstream", "GitHub returned an unexpected response.", context);
  }
}
