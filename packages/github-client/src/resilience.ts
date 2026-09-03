import { GitHubClientError } from "./errors";

export type CachePolicy = Readonly<{
  freshMs: number;
  staleMs: number;
}>;

export const EVIDENCE_CACHE_POLICIES = Object.freeze({
  issue: { freshMs: 2 * 60_000, staleMs: 10 * 60_000 },
  issueConversation: { freshMs: 2 * 60_000, staleMs: 10 * 60_000 },
  repository: { freshMs: 10 * 60_000, staleMs: 60 * 60_000 },
  repositoryActivity: { freshMs: 5 * 60_000, staleMs: 30 * 60_000 },
  analysis: { freshMs: 5 * 60_000, staleMs: 30 * 60_000 },
} satisfies Record<string, CachePolicy>);

export type CacheState = "miss" | "fresh" | "stale";

export type CacheResult<T> = Readonly<{
  value: T;
  state: CacheState;
}>;

type CacheEntry<T> = Readonly<{
  value: T;
  freshUntil: number;
  staleUntil: number;
}>;

export class MemoryStaleCache {
  readonly #entries = new Map<string, CacheEntry<unknown>>();

  constructor(readonly maxEntries = 500) {
    if (!Number.isInteger(maxEntries) || maxEntries < 1) {
      throw new Error("maxEntries must be a positive integer");
    }
  }

  get size(): number {
    return this.#entries.size;
  }

  get<T>(key: string, now = Date.now()): CacheResult<T> | null {
    const entry = this.#entries.get(key) as CacheEntry<T> | undefined;
    if (entry === undefined) return null;
    // Refresh insertion order so the capacity policy evicts the least recently used entry.
    this.#entries.delete(key);
    this.#entries.set(key, entry);
    if (now <= entry.freshUntil) return { value: entry.value, state: "fresh" };
    if (now <= entry.staleUntil) return { value: entry.value, state: "stale" };
    this.#entries.delete(key);
    return null;
  }

  set<T>(key: string, value: T, policy: CachePolicy, now = Date.now()): void {
    const freshMs = Math.max(0, policy.freshMs);
    const staleMs = Math.max(freshMs, policy.staleMs);
    this.#entries.delete(key);
    this.#entries.set(key, {
      value,
      freshUntil: now + freshMs,
      staleUntil: now + staleMs,
    });
    while (this.#entries.size > this.maxEntries) {
      const oldest = this.#entries.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.#entries.delete(oldest);
    }
  }

  delete(key: string): void {
    this.#entries.delete(key);
  }
}

export class InFlightDeduplicator {
  readonly #pending = new Map<string, Promise<unknown>>();

  run<T>(key: string, work: () => Promise<T>): Promise<T> {
    const existing = this.#pending.get(key) as Promise<T> | undefined;
    if (existing !== undefined) return existing;

    const pending = work().finally(() => {
      if (this.#pending.get(key) === pending) this.#pending.delete(key);
    });
    this.#pending.set(key, pending);
    return pending;
  }
}

export type RefreshResult = Readonly<{
  status: "refreshed" | "degraded";
  retryAfterSeconds: number | null;
}>;

export type ResilientCacheResult<T> = Readonly<{
  value: T;
  state: "fresh" | "stale";
  refresh: Promise<RefreshResult> | null;
}>;

function isRetryableGitHubError(error: unknown): error is GitHubClientError {
  return (
    error instanceof GitHubClientError &&
    ["rate_limited", "timeout", "network", "upstream"].includes(error.kind)
  );
}

export class StaleWhileRevalidateCache {
  constructor(
    readonly cache = new MemoryStaleCache(),
    readonly deduplicator = new InFlightDeduplicator(),
  ) {}

  async getOrRefresh<T>(input: {
    key: string;
    policy: CachePolicy;
    load: () => Promise<T>;
    now?: () => number;
  }): Promise<ResilientCacheResult<T>> {
    const now = input.now ?? Date.now;
    const cached = this.cache.get<T>(input.key, now());

    if (cached?.state === "fresh") {
      return { value: cached.value, state: "fresh", refresh: null };
    }

    if (cached?.state === "stale") {
      const refresh = this.deduplicator.run(`${input.key}:refresh`, async () => {
        try {
          const value = await input.load();
          this.cache.set(input.key, value, input.policy, now());
          return { status: "refreshed", retryAfterSeconds: null } as const;
        } catch (error) {
          if (isRetryableGitHubError(error)) {
            return {
              status: "degraded",
              retryAfterSeconds: error.retryAfterSeconds,
            } as const;
          }
          throw error;
        }
      });

      return { value: cached.value, state: "stale", refresh };
    }

    const value = await this.deduplicator.run(`${input.key}:refresh`, input.load);
    this.cache.set(input.key, value, input.policy, now());
    return { value, state: "fresh", refresh: null };
  }
}

export type RateLimitDecision = Readonly<{
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}>;

type Bucket = {
  count: number;
  resetAt: number;
};

export class FixedWindowRateLimiter {
  readonly #buckets = new Map<string, Bucket>();

  constructor(
    readonly limit: number,
    readonly windowMs: number,
    readonly maxBuckets = 10_000,
  ) {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error("limit must be a positive integer");
    }
    if (!Number.isFinite(windowMs) || windowMs < 1) {
      throw new Error("windowMs must be positive");
    }
    if (!Number.isInteger(maxBuckets) || maxBuckets < 1) {
      throw new Error("maxBuckets must be a positive integer");
    }
  }

  get size(): number {
    return this.#buckets.size;
  }

  consume(key: string, now = Date.now()): RateLimitDecision {
    let bucket = this.#buckets.get(key);
    if (bucket === undefined || now >= bucket.resetAt) {
      if (this.#buckets.size >= this.maxBuckets) {
        for (const [candidate, value] of this.#buckets) {
          if (now >= value.resetAt) this.#buckets.delete(candidate);
        }
      }
      while (this.#buckets.size >= this.maxBuckets) {
        const oldest = this.#buckets.keys().next().value as string | undefined;
        if (oldest === undefined) break;
        this.#buckets.delete(oldest);
      }
      bucket = { count: 0, resetAt: now + this.windowMs };
      this.#buckets.set(key, bucket);
    }

    if (bucket.count >= this.limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      };
    }

    bucket.count += 1;
    return {
      allowed: true,
      remaining: Math.max(0, this.limit - bucket.count),
      retryAfterSeconds: 0,
    };
  }
}

/** Bounds simultaneous upstream work while preserving safe parallelism. */
export class ConcurrencyLimiter {
  #active = 0;
  readonly #waiting: Array<() => void> = [];

  constructor(readonly limit: number) {
    if (!Number.isInteger(limit) || limit < 1) throw new Error("limit must be positive");
  }

  async run<T>(work: () => Promise<T>): Promise<T> {
    if (this.#active >= this.limit)
      await new Promise<void>((resolve) => this.#waiting.push(resolve));
    this.#active += 1;
    try {
      return await work();
    } finally {
      this.#active -= 1;
      this.#waiting.shift()?.();
    }
  }
}

export function scopedCacheKey(scope: string, resource: string): string {
  if (scope.length === 0) throw new Error("cache scope is required");
  return `${scope}:${resource}`;
}
