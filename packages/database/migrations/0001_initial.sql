BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  github_user_id bigint UNIQUE,
  github_login text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT users_github_identity_pair CHECK (
    (github_user_id IS NULL AND github_login IS NULL)
    OR (github_user_id IS NOT NULL AND github_login IS NOT NULL)
  )
);

CREATE UNIQUE INDEX users_github_login_unique_ci
  ON users (lower(github_login))
  WHERE github_login IS NOT NULL;

CREATE TABLE profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  timezone text NOT NULL DEFAULT 'UTC',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE github_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_owner text NOT NULL,
  repository_name text NOT NULL,
  issue_number integer NOT NULL CHECK (issue_number > 0),
  github_node_id text,
  issue_url text NOT NULL,
  title text NOT NULL,
  state text NOT NULL CHECK (state IN ('open', 'closed')),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (repository_owner, repository_name, issue_number),
  UNIQUE (issue_url)
);

CREATE TABLE evidence_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  github_issue_id uuid NOT NULL REFERENCES github_issues(id) ON DELETE CASCADE,
  evidence_version text NOT NULL,
  source text NOT NULL,
  payload jsonb NOT NULL,
  collected_at timestamptz NOT NULL,
  expires_at timestamptz,
  retention_until timestamptz,
  fingerprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (github_issue_id, evidence_version, fingerprint),
  CONSTRAINT evidence_expiry_order CHECK (expires_at IS NULL OR expires_at >= collected_at),
  CONSTRAINT evidence_retention_order CHECK (
    retention_until IS NULL OR retention_until >= collected_at
  )
);

CREATE INDEX evidence_snapshots_issue_collected_idx
  ON evidence_snapshots (github_issue_id, collected_at DESC);

CREATE TABLE reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  github_issue_id uuid NOT NULL REFERENCES github_issues(id) ON DELETE RESTRICT,
  evidence_snapshot_ids uuid[] NOT NULL DEFAULT '{}',
  score_model_version text NOT NULL,
  report_version text NOT NULL,
  score smallint NOT NULL CHECK (score BETWEEN 0 AND 100),
  verdict text NOT NULL CHECK (verdict IN ('pursue', 'review_carefully', 'skip')),
  confidence text NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  report_payload jsonb NOT NULL,
  idempotency_key text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  retention_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reports_retention_order CHECK (
    retention_until IS NULL OR retention_until >= generated_at
  )
);

CREATE UNIQUE INDEX reports_user_idempotency_unique
  ON reports (user_id, idempotency_key)
  WHERE user_id IS NOT NULL AND idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX reports_anonymous_idempotency_unique
  ON reports (github_issue_id, idempotency_key)
  WHERE user_id IS NULL AND idempotency_key IS NOT NULL;

CREATE INDEX reports_issue_generated_idx
  ON reports (github_issue_id, generated_at DESC);

CREATE TABLE saved_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  github_issue_id uuid NOT NULL REFERENCES github_issues(id) ON DELETE CASCADE,
  latest_report_id uuid REFERENCES reports(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'saved' CHECK (status IN ('saved', 'pursuing', 'done', 'dismissed')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, github_issue_id)
);

CREATE TABLE jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  github_issue_id uuid REFERENCES github_issues(id) ON DELETE CASCADE,
  kind text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  idempotency_key text NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts > 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT jobs_attempt_bounds CHECK (attempts <= max_attempts),
  CONSTRAINT jobs_finish_after_start CHECK (
    finished_at IS NULL OR started_at IS NULL OR finished_at >= started_at
  )
);

CREATE UNIQUE INDEX jobs_owner_idempotency_unique
  ON jobs (owner_user_id, kind, idempotency_key)
  WHERE owner_user_id IS NOT NULL;

CREATE UNIQUE INDEX jobs_anonymous_idempotency_unique
  ON jobs (kind, idempotency_key)
  WHERE owner_user_id IS NULL;

CREATE INDEX jobs_dispatch_idx ON jobs (status, available_at, created_at);

CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  subject_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  request_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  retention_until timestamptz,
  CONSTRAINT audit_retention_order CHECK (
    retention_until IS NULL OR retention_until >= occurred_at
  )
);

CREATE INDEX audit_events_actor_occurred_idx
  ON audit_events (actor_user_id, occurred_at DESC);
CREATE INDEX audit_events_subject_occurred_idx
  ON audit_events (subject_user_id, occurred_at DESC);
CREATE INDEX audit_events_request_idx
  ON audit_events (request_id)
  WHERE request_id IS NOT NULL;

COMMIT;
