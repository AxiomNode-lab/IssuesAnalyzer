# Performance and Reliability

## Targets
- Static shell LCP target < 2.5 s at p75 on mobile.
- Warm report API p95 < 1.5 s.
- Cold analysis p95 < 8 s with progressive status.
- Monthly availability target 99.9% after public beta.
- Error budget and targets are reviewed from production measurements.

## Strategy
- Server-render the initial shell and stream report sections.
- Cache normalized public evidence, not personalized reports.
- Use field-specific TTLs and stale-while-revalidate.
- Batch GraphQL fields and bound all pagination.
- Apply upstream timeouts, jittered exponential backoff, and retry budgets.
- Queue refreshes and deduplicate by issue/evidence version.
- Serve partial reports with reduced confidence.
- Lazy-load noncritical charts; avoid heavy client libraries.
- Compress responses and use immutable asset caching.

## Reliability
- Idempotent jobs and mutation endpoints.
- Dead-letter queue with redacted diagnostics.
- Readiness excludes instances unable to reach required storage.
- Graceful degradation when GitHub rate limits are low.
- Backups, restore tests, and documented RPO/RTO before production.
