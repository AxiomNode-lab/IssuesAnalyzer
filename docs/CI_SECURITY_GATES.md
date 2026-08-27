# CI quality and security gates

This document defines the pull-request gates for MVP v0.1 and distinguishes controls implemented in the repository from GitHub-native controls that depend on repository/account settings.

## Implemented in the repository

### Verify / Quality and security

`.github/workflows/verify.yml` runs on pull requests targeting `main`, pushes to `main`, and manual dispatch.

The job uses `permissions: contents: read`, a 15-minute timeout, and per-PR concurrency that cancels obsolete runs without cancelling unrelated pull requests.

A clean checkout performs:

1. Node.js `24.19.0` and pnpm `11.23.0` setup.
2. `pnpm install --frozen-lockfile`.
3. `pnpm verify`, which covers formatting, ESLint, TypeScript, all Vitest tests (including the application-security regressions), and the Next.js production build.
4. PostgreSQL 17 service-container integration checks using only the non-production test database `opportunity_radar_test` and local CI credentials.
5. `pnpm audit --prod`.

No production database, OAuth, GitHub, or session secret is required by this workflow.

### Immutable action pins

Third-party actions in the required Verify workflow are pinned to verified upstream commit revisions rather than floating tags:

- `actions/checkout` — v5 — `fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09`.
- `pnpm/action-setup` — v6 — `0977fd99725f1db4007ccb2928dbb4e90d06cc86`.
- `actions/setup-node` — v5 — `a0853c24544627f65ddf259abe73b1d18a591444`.

Dependabot is configured weekly for both the npm and GitHub Actions ecosystems so proposed upgrades can be reviewed through normal pull requests.

## GitHub-native controls requiring repository support

The repository is currently private. GitHub's repository metadata available to this project does not expose an enabled Advanced Security/security-and-analysis configuration, and there is currently no repository ruleset. These controls must not be reported as active until GitHub confirms they are enabled.

### Dependency Review

Status: **requires supported GitHub repository settings**.

When supported/enabled, add the official `actions/dependency-review-action` to pull requests and require its successful check. The currently verified v5.0.0 revision is `a1d282b36b6f3519aa1f3fc636f609c47dddb294`.

Until then, the required Verify job retains frozen-lockfile installation plus `pnpm audit --prod`; this is not equivalent to GitHub Dependency Review and is not described as such.

### CodeQL

Status: **requires GitHub code-scanning support to be enabled for this private repository**.

The repository language is TypeScript, so the intended CodeQL language is JavaScript/TypeScript only. Once code scanning is available, configure CodeQL for pull requests, pushes to `main`, and a reasonable scheduled scan, with `security-events: write` limited to that workflow. Do not require a CodeQL check until the repository can actually run it successfully.

### Secret scanning / push protection

Status: **requires repository/account support and explicit GitHub configuration**.

Do not place long-lived production secrets in CI. GitHub secret scanning and push protection should be enabled in repository Security settings when available, and their status should be verified in GitHub before being described as active.

## Required branch protection / ruleset

There is currently no repository ruleset. Configure a ruleset for `main` with these minimum requirements:

- require changes through a pull request;
- require the `Verify / Quality and security` status check;
- require the branch to be up to date before merge when that does not create excessive churn;
- block force pushes to `main`;
- block deletion of `main`;
- keep administrators subject to the rule unless an emergency process explicitly requires bypass;
- add Dependency Review and CodeQL as required checks only after those GitHub-native features are confirmed operational.

The repository should continue to prefer squash merges for focused MVP feature branches.

## CI secret policy

CI may use ephemeral service-container credentials such as the local PostgreSQL test password. It must not use or print production credentials, production OAuth secrets, production session keys, personal access tokens, or external production database URLs. GitHub's short-lived workflow token should receive only permissions required by each workflow.

## Failure policy

A failing required gate is fixed at its root cause. Required checks must not be hidden with `continue-on-error`, `|| true`, relaxed TypeScript/lint rules, unfrozen dependency installation, skipped security tests, or mocked replacements for the PostgreSQL integration contract.
