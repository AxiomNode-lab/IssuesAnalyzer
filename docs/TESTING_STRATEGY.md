# Testing Strategy

## Test pyramid
- Unit: scoring rules, URL parsing, confidence, redaction.
- Property tests: score bounds, monotonicity, parser invariants.
- Contract: sanitized GitHub REST/GraphQL fixtures and schema drift.
- Integration: database, cache, queue, authentication callbacks.
- E2E: anonymous analysis, sign-in, save, stale refresh, rate-limit state.
- Security: authorization matrix, SSRF payloads, XSS Markdown corpus, CSRF, webhook replay.
- Performance: cold/warm analysis and fan-out budgets.
- Accessibility: keyboard, focus, semantics, contrast, screen-reader labels.

## CI gates
- Formatting, lint, type checking.
- Unit and integration tests.
- Migration validation.
- Dependency review and CodeQL.
- Secret scan.
- Build and minimal E2E smoke test.
- Coverage is diagnostic; critical policies require explicit tests regardless of percentage.

## Test data
Never record real access tokens or private repository responses. Fixtures are minimized, sanitized, deterministic, and reviewed.
