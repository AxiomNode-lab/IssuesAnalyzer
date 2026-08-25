# Contributing

## Workflow
1. Open or reference an issue.
2. Create a focused branch from `main`.
3. Keep changes small and documented.
4. Add or update tests.
5. Run all local checks.
6. Open a pull request using the template.
7. Address reviews; squash merge is preferred.

## Engineering rules
- Never commit secrets or real user data.
- Public API and scoring changes require documentation.
- Security-sensitive changes require threat-focused tests.
- Architecture changes require an ADR.
- New dependencies require justification and lockfile review.
- User-visible scores must remain explainable.

## Commits
Use clear imperative messages. Conventional Commits are encouraged: `feat:`, `fix:`, `docs:`, `test:`, `chore:`.

## Definition of done
Code, tests, docs, accessibility, observability, security implications, migration/rollback plan, and CI must be addressed where applicable.
