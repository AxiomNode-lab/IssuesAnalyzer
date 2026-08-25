# Repository activity analyzer

Deterministic, side-effect-free analysis of bounded GitHub repository evidence.

## Contract

- The caller supplies an explicit `asOf` timestamp; the analyzer never reads the system clock.
- Commit evidence is capped at 100 records and release evidence at 20 records.
- Facts include their source URL, observation time, and freshness.
- Missing optional evidence lowers confidence and is never converted silently into a zero.
- Archived or disabled repositories are classified as `archived` regardless of other signals.

The score is an activity/readiness signal, not a guarantee that a maintainer will respond or accept a contribution.
