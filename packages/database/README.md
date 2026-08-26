# Database foundation

This package owns the PostgreSQL schema and forward migrations for the MVP.

## Local development

Requirements:

- PostgreSQL 15 or newer.
- `psql` available on `PATH`.
- A disposable local database for development/testing.

Apply the forward migration:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/opportunity_radar \
  pnpm --filter @opportunity-radar/database db:migrate
```

Run the isolated integration test against a disposable database:

```bash
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/opportunity_radar_test \
  pnpm --filter @opportunity-radar/database test:integration
```

The integration runner drops and recreates the `public` schema. Never point `TEST_DATABASE_URL` at a database containing data you need.

## Schema ownership

The initial migration creates:

- `users`
- `profiles`
- `github_issues`
- `evidence_snapshots`
- `reports`
- `saved_opportunities`
- `jobs`
- `audit_events`

All timestamps use PostgreSQL `timestamptz`. Report/evidence/job uniqueness constraints provide idempotency boundaries. User-owned saved opportunities are keyed by `(user_id, github_issue_id)` so the application layer can enforce ownership without ambiguous rows.

Migrations are append-only. Do not edit an already released migration; add a new numbered migration instead.
