# Development Runbook

## Requirements

- Node.js 22.x
- pnpm 10.12.1
- Git

## Clone and run

```bash
git clone https://github.com/alaamadii/test-the-brain.git
cd test-the-brain
git checkout feat/greenfield-project-brain
corepack enable
corepack prepare pnpm@10.12.1 --activate
pnpm install
pnpm dev
```

Open the Vite URL printed in the terminal, normally `http://localhost:5173`.

## Validate

```bash
pnpm typecheck
pnpm build
pnpm validate
```

## What works in the greenfield MVP

- Project section with Project Brief and Project Health.
- Workflow section with board and task-centric details.
- Task-linked claims, evidence, validation, memory projection, and AI-ready context.
- AI section with Work with AI, Agents, AI Memories, and History surfaces.
- Manual AI Memory extraction prompt and safe structured summary entry.
- Minimum-sufficient context runtime in the core package.
- Domain contracts and product architecture documented independently of the UI.

## What is intentionally not complete yet

- repository scanning
- SQLite persistence
- Electron packaging
- real MCP server
- real agent adapter connection
- LLM semantic provider
- automatic post-session grounding/verification
- cloud sync/team collaboration

These are not hidden limitations. Implement them in the sequence described in `ROADMAP.md`.

## Development rules

1. Do not make LLM output authoritative truth.
2. Do not duplicate linked knowledge into task records; build task projections.
3. Keep provider/agent specifics behind adapters.
4. Keep raw transcripts and secrets out of AI Memories.
5. Keep Project / Workflow / AI as the primary product model.
6. Add docs for any new cross-cutting architecture or security boundary.
