# Local development

This document is the source of truth for setting up the development workspace.

## Prerequisites

- Node.js 24.19.0 (LTS)
- pnpm 11.23.0 through Corepack
- Git

Versions are pinned intentionally so local development and CI use the same toolchain.

## Setup

```bash
nvm use
corepack enable
corepack prepare pnpm@11.23.0 --activate
pnpm install
pnpm verify
```

Do not commit secrets. Copy `.env.example` when local application configuration is needed; never commit a populated `.env` file.

## Workspace layout

- `apps/web`: Next.js web application and server routes.
- `apps/worker`: separately runnable background worker.
- `packages/domain`: framework-independent domain types and rules.
- `packages/github-client`: read-only GitHub API adapter.
- `packages/scoring`: versioned scoring and confidence calculation.
- `packages/database`: database schema and repository adapters.
- `packages/config`: validated runtime configuration.
- `tests/contract`: GitHub API contract fixtures.
- `tests/e2e`: browser-level acceptance tests.

The web application and analysis packages are part of the current main branch. External services such as PostgreSQL and Redis are configured only when the corresponding features are used.

## Root commands

| Command             | Purpose                                                  |
| ------------------- | -------------------------------------------------------- |
| `pnpm dev`          | Run the web application locally.                         |
| `pnpm format`       | Apply deterministic formatting.                          |
| `pnpm format:check` | Verify formatting without writing files.                 |
| `pnpm lint`         | Run static lint checks.                                  |
| `pnpm typecheck`    | Type-check all workspaces that define the command.       |
| `pnpm test`         | Run the unit and application test suites.                |
| `pnpm build`        | Build all workspaces that define the command.            |
| `pnpm verify`       | Run every required local quality check.                  |

## Dependency rules

- Use exact dependency versions; do not use `^` or `~`.
- Change dependencies in a dedicated, reviewable commit.
- Commit the generated `pnpm-lock.yaml`.
- Review packages that request install scripts before adding them to `onlyBuiltDependencies`.
- Never bypass failed security or quality checks to merge a change.

## Pull request workflow

1. Branch from `main`.
2. Keep one backlog issue per pull request.
3. Run `pnpm verify`.
4. Explain security, performance, and testing impact in the PR.
5. Merge only after required checks pass.
