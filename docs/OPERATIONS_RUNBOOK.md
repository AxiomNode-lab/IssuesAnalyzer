# Deployment and operations runbook

This document defines the MVP-15 deployment and observability foundation. It does **not** authorize or perform a production deployment.

## Environments

Staging and production must use separate configuration, databases, OAuth applications/secrets, session secrets, and origins. Templates live in:

- `deploy/staging.env.example`
- `deploy/production.env.example`

`APP_ENV` must be one of `development`, `test`, `staging`, or `production`. `APP_RELEASE` should be the deployed Git commit SHA so logs and health responses identify the exact release.

Never copy staging credentials into production or vice versa. Example values in this repository are placeholders only.

## Repeatable release procedure

1. Start from a commit that passed the required `Verify / Quality and security` check.
2. Build with the pinned Node and pnpm versions from the repository and install dependencies with `pnpm install --frozen-lockfile`.
3. Set the target environment variables from the appropriate environment template using the platform secret store; never commit real values.
4. Apply database migrations before routing traffic to application instances.
5. Start the application with the platform's standard Next.js production process (`pnpm --filter @opportunity-radar/web start`) after a successful build.
6. Check `/api/health/live` and `/api/health/ready`.
7. Run `scripts/smoke-test.sh <base-url>`.
8. Observe error rate, readiness, latency, GitHub quota, and cache behavior before promoting further.

Production deployment requires explicit human approval. CI must not auto-deploy production from a merge alone.

## Health probes

### Liveness

`GET /api/health/live`

Returns HTTP 200 when the web process can execute requests. It intentionally does not call external dependencies.

### Readiness

`GET /api/health/ready`

Runs a bounded PostgreSQL `SELECT 1` dependency check. It returns HTTP 200 with `status=ready` when the database is reachable and HTTP 503 with `status=not_ready` when the dependency is unavailable. The response contains service/environment/release identifiers but no credentials or internal database details.

## Structured logs and error monitoring

`apps/web/src/lib/observability.ts` emits JSON operational logs containing timestamp, level, event, service, environment, and release. Fields pass through the central redaction layer before output.

`reportOperationalError()` is the central error-reporting boundary for operational failures. The MVP writes redacted structured errors to the runtime log stream. A hosted error-monitoring provider can later consume this stream or be connected at this boundary; no external monitoring vendor is claimed as configured by this repository.

Do not log request cookies, OAuth tokens, session secrets, database URLs, authorization headers, or raw user account exports.

## Metrics foundation

The runtime metric registry currently supports:

- `request_latency_ms`
- `cache_hit`
- `cache_miss`
- `github_quota_remaining`

Use `recordMetric()` at the integration boundary when GitHub/cache operations run, and `observeLatency()` around operational work. The in-process registry is suitable for a single-instance MVP foundation. Horizontal scaling requires exporting the same measurements to a shared metrics backend; in-memory values must not be treated as globally aggregated production metrics.

## Backup procedure

Prerequisites: `pg_dump` and `pg_restore` from a compatible PostgreSQL client.

Run with a target path stored outside the application filesystem when possible:

```sh
DATABASE_URL='postgresql://...' BACKUP_PATH='/secure/location/backup.dump' sh scripts/backup-postgres.sh
```

The helper creates a custom-format dump with restrictive local permissions and verifies that `pg_restore --list` can read it. Store backups encrypted with retention/access controls appropriate to the deployment platform.

A backup is not considered operationally verified until a restore rehearsal succeeds in a non-production database.

## Restore rehearsal

Never use production as the first restore target.

```sh
TARGET_DATABASE_URL='postgresql://restore-rehearsal...' BACKUP_PATH='/secure/location/backup.dump' sh scripts/restore-postgres.sh
```

After restore:

1. Run database integration/migration checks.
2. Start the application against the restored database in an isolated environment.
3. Verify `/api/health/ready` returns 200.
4. Run the smoke test.
5. Record the backup timestamp, restore duration, result, and operator.

## Incident response

When readiness, error rate, GitHub quota, or latency materially degrades:

1. Stop further production promotion/deployment.
2. Identify the active `APP_RELEASE` from logs/health responses.
3. Check database availability before restarting application instances.
4. Check GitHub API quota/rate-limit signals and cache behavior before increasing traffic.
5. Preserve redacted logs and timestamps needed for diagnosis.
6. If the incident started after a release and rollback criteria are met, roll back to the last known-good release.
7. If database corruption/data loss is suspected, stop writes where practical and follow the verified restore procedure rather than improvising against production.
8. Document cause, impact, remediation, and follow-up actions.

## Rollback criteria

Rollback should be considered when a newly deployed release causes any of the following and the issue cannot be safely corrected immediately:

- readiness remains unavailable;
- a new sustained server-error spike appears;
- critical authentication/account-data operations regress;
- database migration compatibility is broken;
- latency increases enough to make the service unusable;
- security controls are unexpectedly weakened.

Rollback procedure:

1. Select the previous commit that passed required CI and was known healthy.
2. Confirm database schema compatibility before reverting application code. Do not blindly reverse destructive migrations.
3. Redeploy that release using the same environment configuration and secret store.
4. Verify liveness/readiness and run `scripts/smoke-test.sh`.
5. Monitor until the service stabilizes.

## Smoke test criteria

A release passes the minimal deployment smoke test only when both liveness and readiness endpoints return successful HTTP responses. Product-flow checks may be added as stable API endpoints become available.

## Production approval gate

This repository deliberately contains no automatic production deployment workflow. A production deployment requires explicit approval from the project owner/operator after staging verification, backup readiness, required CI success, and rollback readiness are confirmed.
