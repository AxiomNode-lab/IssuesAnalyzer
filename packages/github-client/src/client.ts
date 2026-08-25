import type { GitHubIssueUrl } from "@opportunity-radar/domain";

import { GitHubClientError } from "./errors";
import { parseIssue, parseRepository } from "./parse";
import type { GitHubIssue, GitHubQuota, GitHubRepository, GitHubResponse } from "./types";

const API_ORIGIN = "https://api.github.com";
const API_VERSION = "2026-03-10";
const RETRYABLE_STATUS = new Set([502, 503, 504]);

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
    return this.#get(
      `/repos/${encodeURIComponent(reference.owner)}/${encodeURIComponent(reference.repository)}/issues/${reference.issueNumber}`,
      parseIssue,
    );
  }

  async getRepository(
    reference: Pick<GitHubIssueUrl, "owner" | "repository">,
  ): Promise<GitHubResponse<GitHubRepository>> {
    return this.#get(
      `/repos/${encodeURIComponent(reference.owner)}/${encodeURIComponent(reference.repository)}`,
      parseRepository,
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
