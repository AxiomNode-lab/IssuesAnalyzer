# GitHub Opportunity Radar

Know whether a GitHub issue is worth your time before you start.

GitHub Opportunity Radar analyzes a public issue and produces an explainable pre-flight report covering repository activity, maintainer responsiveness, competition, issue clarity, contribution readiness, and personal skill fit.

> Status: product and engineering foundation. No production application has been released.

## Product principles
- Evidence before claims.
- Explainable scores, never guarantees.
- Read-only GitHub access in the MVP.
- Secure and private by default.
- Fast progressive results with graceful degradation.
- Accessibility and testing are release requirements.

## MVP
Paste a public GitHub issue URL and receive:
- a pursue/review/skip recommendation;
- component scores and confidence;
- linked facts and clearly marked inferences;
- warnings about inactivity, competition, or unclear scope;
- a suggested communication plan.

## Architecture
The planned system is a TypeScript modular monolith with a separately runnable worker, PostgreSQL, Redis-backed caching/jobs, and a GitHub App using minimal read-only permissions.

```text
apps/web       Web UI and server routes
apps/worker    Background evidence refresh
packages/*     Domain, GitHub adapter, scoring, database, config
docs/          Product and engineering source of truth
tests/         Contract and end-to-end suites
```

See [documentation index](docs/README.md), [product requirements](docs/PRODUCT_REQUIREMENTS.md), [architecture](docs/ARCHITECTURE.md), [security](docs/SECURITY_AND_PRIVACY.md), and [market research](docs/MARKET_RESEARCH.md).

## Development status
The implementation stack and contracts are documented before code is added. Development happens through feature branches and reviewed pull requests.

## Contributing
Read [CONTRIBUTING.md](CONTRIBUTING.md). Security reports must follow [SECURITY.md](SECURITY.md).

## License
No license has been selected yet. Until one is added, all rights are reserved; do not assume permission to copy, redistribute, or reuse the code.
