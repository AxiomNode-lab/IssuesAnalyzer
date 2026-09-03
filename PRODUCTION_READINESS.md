# Production readiness

This repository is deployable as a Node.js 24.19+ / pnpm 11.23 application. This document is an
operator checklist, not deployment authorization. Production deployment remains a separate,
human-approved action.

## Configuration

Server-only secrets are `DATABASE_URL`, `REDIS_URL`, `GITHUB_TOKEN`,
`GITHUB_OAUTH_CLIENT_SECRET`, and `SESSION_SECRET`. Never prefix them with `NEXT_PUBLIC_` or expose
them to browser code/logs. `SESSION_SECRET` must contain at least 32 high-entropy characters.

Production-like environments require a canonical HTTPS `APP_ORIGIN`. OAuth additionally requires
`GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`, `SESSION_SECRET`, and `DATABASE_URL`.
`GITHUB_TOKEN` is optional for public analysis but strongly recommended for GitHub quota. The
application only performs read-only GitHub REST requests and requests OAuth scope `read:user`.

Optional tuning variables are documented in `.env.example`: database pool/connect/idle/lifetime/
statement limits, `REQUIRE_DATABASE`, service/release labels, Redis, and `TRUSTED_PROXY_COUNT`.
Set `TRUSTED_PROXY_COUNT` to the exact number of trusted reverse proxies that overwrite forwarding
headers. Leave it at zero when clients can reach the process directly.

## Database and lifecycle

PostgreSQL 17 is the CI target. Apply `packages/database/migrations/0001_initial.sql` through the
migration script before serving account traffic. The web process owns one lazy singleton pool,
bounded by `DATABASE_POOL_MAX`; queries receive server-side statement and idle-transaction
timeouts. Call the exported `closeDatabase()` from a platform shutdown hook when custom process
lifecycle wiring is used.

Anonymous public analysis does not require PostgreSQL. Readiness reports a missing/unavailable
database as optional degradation unless `REQUIRE_DATABASE=true`; use that flag where account
storage is a hard routing dependency.

## Abuse control and horizontal scaling

The analyzer layers strict canonical URL validation, a 4 KiB JSON body limit, burst and sustained
identity limits, public evidence caching, same-issue single-flight, bounded evidence pagination,
an upstream concurrency ceiling, deadlines, and limited retries.

With `REDIS_URL`, rate counters use atomic Redis `INCR`/expiry operations and work across web
instances. If Redis is absent or unavailable, a bounded instance-local limiter keeps local
development and degraded service available; it must not be treated as globally enforced.
Forwarding headers are ignored unless proxy trust is explicitly configured. Evidence cache and
single-flight are currently bounded and instance-local; horizontal deployments gain best cache
efficiency from sticky routing or a future shared public-evidence cache adapter. Session/user data
is never placed in the public evidence cache.

The public analysis cache holds at most 500 reports per process. Reports are fresh for five minutes
and stale-eligible for thirty minutes. Eligible stale reports return immediately while one
instance-local refresh runs; transient GitHub failures preserve stale evidence. A cold same-issue
burst performs one evidence tree per process, not one tree per request.

## GitHub resilience and graceful failure

GitHub requests use a fixed `https://api.github.com` origin, reject redirects, time out after eight
seconds, cap retries at one by default, and use exponential delay plus jitter for network/502/503/
504 failures. Permanent 4xx responses are not retried. GitHub 403 quota exhaustion and 429 are
classified separately and propagate safe 429/`Retry-After` responses. Evidence page/sample limits
are explicit; missing optional evidence reduces report confidence rather than being invented.

OAuth exchange and identity requests also reject redirects and use an eight-second deadline.
Sessions are signed, HttpOnly, SameSite=Lax, Secure in production, and expire after eight hours;
mutations additionally require same-origin requests and a CSRF token. Stateless sessions are
invalidated on logout in the browser but cannot be individually revoked server-side before expiry;
rotate `SESSION_SECRET` to invalidate all sessions after a compromise.

## Security and observability

Global CSP, frame denial, MIME sniffing protection, referrer/permissions policies, and production
HSTS are set in `next.config.ts`. Production intentionally excludes development-only
`unsafe-eval`. Inline Next.js runtime compatibility remains documented in the audit; migrate to a
tested nonce/SRI policy before removing allowances. Client rendering uses React text escaping and
safe new-tab link relations.

Analysis responses include `X-Request-Id`; structured logs cover starts, completions, cache state,
rate rejection, outbound GitHub latency/quota, retries, timeouts, and failures. Central redaction
removes sensitive keys, bearer/GitHub tokens, and database URLs. Export JSON logs/metrics to the
hosting platform; in-process metrics are not globally aggregated.

Liveness is `GET /api/health/live`. Readiness is `GET /api/health/ready`. Neither exposes secrets or
connection details.

## Verification and load testing

Run:

```text
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm audit --prod
pnpm verify
```

CI also validates shell scripts and the PostgreSQL migration/integration test. Run the safe local
load harness with `pnpm load:test`. It starts only a loopback stub, never calls GitHub, and reports
throughput, p50/p95/p99 latency, error rate, heap delta, and mocked outbound request count for 10,
50, and 100 unique concurrent analyses plus 100 same-issue requests. The same-issue scenario fails
unless single-flight reduces mocked outbound work to one.

## Backup, restore, deployment, and rollback

Use `scripts/backup-postgres.sh` to create and validate a restrictive-permission custom archive.
Exercise `scripts/restore-postgres.sh` only against an explicitly selected isolated rehearsal
database; it uses destructive clean restore semantics and requires
`CONFIRM_DESTRUCTIVE_RESTORE=I_UNDERSTAND_THIS_CLEANS_THE_TARGET`. Encrypt backups, restrict access, define
retention/RPO/RTO, and record restore rehearsals outside the repository.

Deploy only a commit that passed CI and staging smoke tests. Apply backward-compatible migrations,
start the new release, check health and `scripts/smoke-test.sh`, and monitor latency/error/quota
events before promotion. Roll back application code to the last verified release on sustained new
errors/readiness/latency regressions, but first verify database schema compatibility; never blindly
reverse a destructive migration. See `docs/OPERATIONS_RUNBOOK.md` for the detailed procedure.
