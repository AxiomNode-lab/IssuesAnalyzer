# Operations

## Environments
Local, preview, staging, production. No production data is copied to lower environments.

## Observability
- Structured JSON logs with request/job correlation IDs.
- Metrics: latency, errors, cache hit rate, GitHub quota, queue age, partial-report rate.
- Traces across request, GitHub adapter, scoring, database, and jobs.
- Alerts based on user-visible symptoms and error-budget burn.

## Runbooks
1. GitHub rate-limit exhaustion: pause refreshes, serve stale evidence, inspect fan-out.
2. Authentication outage: disable login mutations while anonymous cached analysis remains available.
3. Queue backlog: stop nonessential refreshes, identify poison jobs, scale safely.
4. Suspected credential leak: revoke/rotate, invalidate sessions, audit access, notify appropriately.
5. Bad score release: roll back score version; historical reports remain reproducible.

## Delivery
- Preview for each PR.
- Migrations tested before deploy.
- Backward-compatible deploy order.
- Feature flags for risky scoring changes.
- Automated rollback criteria documented before public launch.
