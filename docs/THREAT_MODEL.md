# Threat Model

## Assets
GitHub credentials, sessions, user profiles, saved opportunities, evidence integrity, service availability, and reputation of the scoring output.

## Trust boundaries
Browser to application; application to GitHub; web process to worker; application to database/cache; CI to deployment platform; webhook sender to receiver.

## Principal abuse cases
1. Malicious URL attempts internal-network access.
2. Crafted Markdown executes script or loads tracking content.
3. User accesses another user's saved report.
4. Attacker exhausts GitHub quota or paid compute.
5. Forged/replayed webhook changes evidence.
6. Dependency or CI action steals credentials.
7. Logs expose tokens or private content.
8. Poisoned issue text manipulates future AI summaries.
9. Score is presented as certainty and causes misleading decisions.

## Required controls
- Strict GitHub-host URL parser; build API requests from validated identifiers.
- Sanitized plain/Markdown rendering with restrictive CSP.
- Server-side authorization on each user-owned object.
- Layered throttling, quotas, caching, deadlines, and bounded pagination.
- Webhook signature, timestamp/replay handling, and idempotency.
- Pin and review dependencies/actions; least-privilege CI permissions.
- Central redaction and log-field allowlists.
- Treat repository content as untrusted data, never instructions.
- Separate facts, inferences, confidence, and guarantees in UI.

## Verification
Each control maps to an automated test or operational check before public beta. Revisit this model for every new provider, write permission, private repository, AI feature, or payment feature.
