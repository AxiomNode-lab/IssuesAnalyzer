# GitHub evidence resilience policy

Issue #16 introduces bounded resilience controls for public GitHub evidence: field-specific cache windows, stale-while-revalidate behavior, in-flight deduplication, and caller throttling.

## Cache scopes

Public GitHub evidence may use the `public` scope because the MVP supports public repositories only. Personalized data must use an explicit `user:<internal-user-id>` scope. Never place account exports, saved opportunities, sessions, or other user-owned records in a public cache key.

Use `scopedCacheKey(scope, resource)` so identical resource names cannot collide across scopes.

## Evidence TTLs

`EVIDENCE_CACHE_POLICIES` defines the bounded defaults used by the resilience layer.

| Evidence                                                      | Fresh  | Stale window |
| ------------------------------------------------------------- | -----: | -----------: |
| Issue metadata                                                |  2 min |       10 min |
| Issue comments/timeline                                       |  2 min |       10 min |
| Repository metadata/community profile                         | 10 min |       60 min |
| Recent commits/releases/PR evidence                            |  5 min |       30 min |
| Completed deterministic analysis from the same evidence version |  5 min |       30 min |

`StaleWhileRevalidateCache` returns a fresh hit without contacting GitHub. A stale hit is returned immediately while one deduplicated refresh starts in the background. A cache miss waits for the single deduplicated load and then stores the result.

The report layer must preserve the original evidence timestamp and expose stale state to the user. Stale evidence must never be presented as freshly collected.

## Shared persistence

The in-process cache is the fast runtime layer. The existing `evidence_snapshots` PostgreSQL table is the persistent shared evidence boundary: `expires_at` represents freshness and `retention_until` can bound stale eligibility. A horizontally scaled deployment must use that shared persistence, or an equivalent shared cache adapter, rather than relying on process memory alone.

Personalized account data is not part of the public evidence cache.

## Deduplication

`InFlightDeduplicator` wraps analysis and refresh keys. Concurrent callers for the same public issue/evidence version share one promise; unrelated resources remain independent.

## Caller throttling

`FixedWindowRateLimiter` applies separate identities for authenticated users (`user:<id>`) and unauthenticated callers (`ip:<trusted-client-ip>`).

Suggested starting policy:

- authenticated analysis: 30 requests / 10 minutes / user;
- anonymous analysis: 10 requests / 10 minutes / IP;
- explicit refresh: 6 requests / 10 minutes / user or IP.

Return HTTP 429 with `Retry-After` derived from `retryAfterSeconds`. A multi-instance deployment must back equivalent counters with a shared store before horizontal scaling.

## GitHub quota-aware degradation

The GitHub client already normalizes `x-ratelimit-*`, `Retry-After`, and rate-limit failures. During stale revalidation, `StaleWhileRevalidateCache` keeps eligible stale evidence when GitHub returns a retryable `rate_limited`, `timeout`, `network`, or upstream failure. The refresh result preserves `retryAfterSeconds` when GitHub provides it.

A cache miss does not invent evidence: if GitHub cannot provide the resource and no eligible stale value exists, the upstream error is surfaced to the caller. There is no tight-loop retry of 403/429 responses.
