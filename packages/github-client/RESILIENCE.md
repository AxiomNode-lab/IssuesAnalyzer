# GitHub evidence resilience policy

Issue #16 introduces bounded primitives for shared public evidence caching, in-flight request deduplication, and caller throttling.

## Cache scopes

Public GitHub evidence may use the `public` scope because the MVP supports public repositories only. Personalized data must use an explicit `user:<internal-user-id>` scope. Never place account exports, saved opportunities, sessions, or other user-owned records in a public cache key.

Use `scopedCacheKey(scope, resource)` so identical resource names cannot collide across scopes.

## Recommended evidence TTLs

| Evidence | Fresh | Stale window |
| --- | ---: | ---: |
| Issue metadata | 2 min | 10 min |
| Issue comments/timeline | 2 min | 10 min |
| Repository metadata/community profile | 10 min | 60 min |
| Recent commits/releases/PR evidence | 5 min | 30 min |
| Completed deterministic analysis from the same evidence version | 5 min | 30 min |

A stale value may be returned when GitHub is temporarily unavailable or quota-limited, but the report must preserve its original evidence timestamp and visibly mark the result stale. Stale data must never be presented as freshly fetched.

## Deduplication

Use `InFlightDeduplicator` around an analysis/refresh key. Concurrent callers for the same public issue and evidence version share one promise; unrelated issues remain independent.

## Caller throttling

`FixedWindowRateLimiter` is a deterministic in-process primitive. Apply separate keys for authenticated users (`user:<id>`) and unauthenticated callers (`ip:<trusted-client-ip>`). Production multi-instance deployment must back equivalent counters with a shared store before horizontal scaling.

Suggested starting policy:

- authenticated analysis: 30 requests / 10 minutes / user;
- anonymous analysis: 10 requests / 10 minutes / IP;
- explicit refresh: 6 requests / 10 minutes / user or IP.

Return HTTP 429 with `Retry-After` derived from `retryAfterSeconds`.

## GitHub quota-aware degradation

The GitHub client already normalizes `x-ratelimit-*`, `Retry-After`, and rate-limit errors. Callers should:

1. prefer a fresh cache hit;
2. deduplicate a cache miss before calling GitHub;
3. when GitHub reports rate limiting, return eligible stale public evidence if available and mark it stale;
4. otherwise surface a retryable quota-limited state and the reset/retry time;
5. never retry 403/429 in a tight loop.

These controls reduce quota usage; they do not hide freshness or confidence degradation from the user.
