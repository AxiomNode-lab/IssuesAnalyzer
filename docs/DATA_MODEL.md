# Data Model

## Core entities
- **User**: GitHub identity reference; no access token stored in user tables.
- **ContributorProfile**: declared languages, skills, level, goals, time budget.
- **Repository**: GitHub node/id, owner/name, visibility, archived state.
- **Issue**: GitHub id/number, state, labels, timestamps, assignees.
- **EvidenceSnapshot**: immutable normalized facts and source timestamps.
- **AnalysisReport**: component scores, confidence, verdict, score version.
- **SavedOpportunity**: user/report relation.
- **RefreshJob**: state, attempts, deadline, failure category.
- **AuditEvent**: security-relevant application actions without secrets.

## Requirements
- Use stable GitHub IDs as upstream identifiers; names may change.
- Store UTC timestamps.
- Soft-delete user-owned records; support account erasure.
- Encrypt tokens using a managed key service or avoid persistence where possible.
- Apply unique constraints for idempotency.
- Store raw GitHub payloads only when required, redacted, compressed, and short-lived.
- Evidence snapshots are append-only; reports reference the exact snapshot.
- Schema migrations are forward-only and reviewed.

## Retention defaults
- Sessions: provider-defined lifetime.
- Cached public metadata: 15 minutes to 24 hours by field volatility.
- Sanitized raw responses: maximum 7 days if needed for debugging.
- Audit events: 90 days.
- Deleted user data: purge job within 30 days.
