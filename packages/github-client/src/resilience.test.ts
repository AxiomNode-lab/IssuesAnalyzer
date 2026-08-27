import { describe, expect, it, vi } from "vitest";

import { GitHubClientError } from "./errors";
import {
  EVIDENCE_CACHE_POLICIES,
  FixedWindowRateLimiter,
  InFlightDeduplicator,
  MemoryStaleCache,
  StaleWhileRevalidateCache,
  scopedCacheKey,
} from "./resilience";

describe("MemoryStaleCache", () => {
  it("distinguishes fresh, stale, and expired entries", () => {
    const cache = new MemoryStaleCache();
    cache.set("public:repo", { ok: true }, { freshMs: 100, staleMs: 300 }, 1_000);

    expect(cache.get("public:repo", 1_050)?.state).toBe("fresh");
    expect(cache.get("public:repo", 1_200)?.state).toBe("stale");
    expect(cache.get("public:repo", 1_301)).toBeNull();
  });

  it("keeps personalized scopes separate", () => {
    expect(scopedCacheKey("user:1", "issue:42")).not.toBe(
      scopedCacheKey("user:2", "issue:42"),
    );
  });

  it("defines bounded field-specific evidence policies", () => {
    expect(EVIDENCE_CACHE_POLICIES.issue.freshMs).toBeLessThan(
      EVIDENCE_CACHE_POLICIES.repository.freshMs,
    );
    expect(EVIDENCE_CACHE_POLICIES.repository.staleMs).toBeGreaterThan(
      EVIDENCE_CACHE_POLICIES.repository.freshMs,
    );
  });
});

describe("InFlightDeduplicator", () => {
  it("runs concurrent work for the same key once", async () => {
    const dedupe = new InFlightDeduplicator();
    const work = vi.fn(async () => "done");

    const [first, second] = await Promise.all([
      dedupe.run("analysis:1", work),
      dedupe.run("analysis:1", work),
    ]);

    expect(first).toBe("done");
    expect(second).toBe("done");
    expect(work).toHaveBeenCalledTimes(1);
  });
});

describe("StaleWhileRevalidateCache", () => {
  it("returns a fresh hit without calling the loader", async () => {
    const cache = new MemoryStaleCache();
    cache.set("public:issue:1", "cached", { freshMs: 100, staleMs: 300 }, 1_000);
    const resilience = new StaleWhileRevalidateCache(cache);
    const load = vi.fn(async () => "new");

    const result = await resilience.getOrRefresh({
      key: "public:issue:1",
      policy: { freshMs: 100, staleMs: 300 },
      load,
      now: () => 1_050,
    });

    expect(result).toEqual({ value: "cached", state: "fresh", refresh: null });
    expect(load).not.toHaveBeenCalled();
  });

  it("serves stale data immediately and revalidates it", async () => {
    const cache = new MemoryStaleCache();
    cache.set("public:issue:1", "cached", { freshMs: 100, staleMs: 300 }, 1_000);
    const resilience = new StaleWhileRevalidateCache(cache);
    const load = vi.fn(async () => "new");

    const result = await resilience.getOrRefresh({
      key: "public:issue:1",
      policy: { freshMs: 100, staleMs: 300 },
      load,
      now: () => 1_200,
    });

    expect(result.value).toBe("cached");
    expect(result.state).toBe("stale");
    expect(await result.refresh).toEqual({ status: "refreshed", retryAfterSeconds: null });
    expect(cache.get<string>("public:issue:1", 1_200)?.value).toBe("new");
  });

  it("deduplicates concurrent cache misses", async () => {
    const resilience = new StaleWhileRevalidateCache();
    const load = vi.fn(async () => "loaded");

    const [first, second] = await Promise.all([
      resilience.getOrRefresh({
        key: "public:analysis:1",
        policy: { freshMs: 100, staleMs: 300 },
        load,
        now: () => 1_000,
      }),
      resilience.getOrRefresh({
        key: "public:analysis:1",
        policy: { freshMs: 100, staleMs: 300 },
        load,
        now: () => 1_000,
      }),
    ]);

    expect(first.value).toBe("loaded");
    expect(second.value).toBe("loaded");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("keeps eligible stale data when GitHub is rate limited", async () => {
    const cache = new MemoryStaleCache();
    cache.set("public:issue:1", "cached", { freshMs: 100, staleMs: 300 }, 1_000);
    const resilience = new StaleWhileRevalidateCache(cache);
    const load = vi.fn(async () => {
      throw new GitHubClientError("rate_limited", "quota exhausted", {
        status: 429,
        retryAfterSeconds: 45,
      });
    });

    const result = await resilience.getOrRefresh({
      key: "public:issue:1",
      policy: { freshMs: 100, staleMs: 300 },
      load,
      now: () => 1_200,
    });

    expect(result.value).toBe("cached");
    expect(await result.refresh).toEqual({ status: "degraded", retryAfterSeconds: 45 });
  });
});

describe("FixedWindowRateLimiter", () => {
  it("throttles each identity independently and exposes retry timing", () => {
    const limiter = new FixedWindowRateLimiter(2, 10_000);

    expect(limiter.consume("user:1", 1_000).allowed).toBe(true);
    expect(limiter.consume("user:1", 1_001).allowed).toBe(true);
    const blocked = limiter.consume("user:1", 1_002);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(10);
    expect(limiter.consume("ip:203.0.113.5", 1_002).allowed).toBe(true);
    expect(limiter.consume("user:1", 11_000).allowed).toBe(true);
  });
});
