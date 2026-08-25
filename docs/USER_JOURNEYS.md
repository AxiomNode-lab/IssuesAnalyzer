# User Journeys

## Analyze an issue
1. User pastes a GitHub issue URL.
2. System validates the host, owner, repository, and issue number.
3. Cached evidence is loaded; stale fields are refreshed.
4. Deterministic scoring runs.
5. User receives verdict, confidence, evidence, risks, and suggested next actions.

## Personalize
1. User signs in with GitHub.
2. User confirms inferred languages and adds skills, level, and time budget.
3. Skill-fit is recalculated without changing repository-health evidence.

## Save and revisit
1. Authenticated user saves a report.
2. System stores the issue identifier, user preferences, score version, and evidence snapshot.
3. On revisit, the UI shows what changed since the prior analysis.

## Failure journeys
- Rate limited: serve cached evidence, show freshness, schedule retry.
- Deleted/private issue: show a neutral unavailable state without revealing private-resource existence.
- Partial upstream failure: calculate only supported components and lower confidence.
- Unsupported URL: reject before any outbound request.
