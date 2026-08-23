# Test The Brain

> Greenfield Project Brain implementation: persistent project memory and AI context runtime.

This repository is a clean rebuild focused on three product areas:

- **Project** — Project Brief, Project Health, and project knowledge.
- **Workflow** — task-centric work with memory, claims, evidence, validation, and AI-ready context.
- **AI** — handoff/prompt generation, connected agents, AI Memories, and session history.

The product rule is simple: **hide complexity from navigation, not from capability**.

## Current status

This branch contains a runnable greenfield MVP shell plus the core domain and service contracts. The UI uses real core services, but repository scanning, SQLite persistence, Electron packaging, MCP, and a real agent connection are intentionally staged in the roadmap rather than faked.

## Run it

Requirements:

- Node.js 22.x
- pnpm 10.12.1
- Git

```bash
git clone https://github.com/alaamadii/test-the-brain.git
cd test-the-brain
git checkout feat/greenfield-project-brain
corepack enable
corepack prepare pnpm@10.12.1 --activate
pnpm install
pnpm dev
```

Open the URL printed by Vite, normally `http://localhost:5173`.

## Validate

```bash
pnpm typecheck
pnpm build
pnpm validate
```

## Repository structure

```text
apps/desktop       Runnable React/Vite product shell
packages/domain    Stable product/domain contracts
packages/core      Project, Workflow, AI Memory, and Context Runtime logic
docs               Product, architecture, data, security, agent integration, runbook, roadmap
```

## Product architecture

```text
Project sources
  -> deterministic collection
  -> project knowledge
  -> Project Brief / Project Health
  -> task-centric Workflow
  -> Context Runtime
  -> AI Handoff or connected Agent
  -> outcome / observations
  -> grounding / verification
  -> durable project memory
```

LLMs are semantic interpreters, not the primary source of truth. Agent observations are unverified until grounded.

## Documentation

- [`docs/PRODUCT.md`](docs/PRODUCT.md) — product identity and behavior
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — component boundaries and runtime design
- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) — core entities and invariants
- [`docs/AGENT_INTEGRATION.md`](docs/AGENT_INTEGRATION.md) — MCP/adapter integration design
- [`docs/SECURITY.md`](docs/SECURITY.md) — security boundaries
- [`docs/RUNBOOK.md`](docs/RUNBOOK.md) — setup and development commands
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — exact path from this MVP to a production-ready desktop/SaaS product

## AI Memory flow

For an external conversation, Project Brain gives the user a prompt asking the AI to return only the important conclusions, current decisions, superseded decisions and replacements, discoveries, unresolved questions, and next steps. The structured result is saved as an AI Memory. Raw transcripts, secrets, cookies, sessions, and credentials are not part of the intended storage model.

For connected agents, the same bounded outcome is captured automatically at session end and reused by later agents.

## Agent integration

The preferred integration is a local MCP server. Agents ask Project Brain for project/task context instead of reading the database directly. Non-MCP environments can use an `AgentAdapter` over a local bridge, CLI, editor extension, or provider SDK.

See `docs/AGENT_INTEGRATION.md` for the concrete tools and acceptance scenario.

## Branch policy

The repository was bootstrapped with one initial commit on `main` because GitHub cannot create a branch from an empty repository. All actual product implementation lives on `feat/greenfield-project-brain` and should be reviewed through a pull request before any merge.
