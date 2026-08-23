# Roadmap to a Production-Ready App

## Phase 0 — Greenfield product shell

Status: implemented on this branch.

- Project / Workflow / AI primary model
- domain contracts
- Project Brief and Health service
- task-centric Workflow projection
- minimum-sufficient Context Runtime
- manual AI Memories flow
- architecture/security/data docs

## Phase 1 — Real local project memory

Goal: replace demo seed data with real local project state.

Build:
- `packages/scanner`
- `packages/database`
- safe repository scanner
- SQLite schema + migrations
- project open/select flow
- deterministic extraction for files/docs/tasks/decisions
- persistent ProjectKnowledge, Task, Claim, Evidence, ValidationRun, AIConversationMemory
- project rescans and incremental updates

Acceptance:
- select a real repository
- restart the app
- project brief, tasks, and memories survive restart
- no secret path is indexed

## Phase 2 — Desktop boundary

Goal: turn the Vite shell into a secure desktop product.

Build:
- Electron main process
- preload typed API
- renderer remains React
- scanner/database stay outside renderer
- local filesystem project picker
- file open/navigation commands

Acceptance:
- packaged dev Electron app opens a repository without renderer Node access
- IPC validation passes

## Phase 3 — Grounded semantic layer

Goal: use an LLM after deterministic collection.

Build:
- `LLMProvider` interface
- one reference provider
- semantic candidate schema
- interpretation/ranking service
- provenance validation
- candidate review queue
- incremental/delta analysis

Acceptance:
- LLM cannot cite unknown sources
- no LLM candidate can become `verified` directly
- relevant task context improves without full-project prompt dumps

## Phase 4 — Real AI agent integration

Goal: make Project Brain a reusable memory/context server for agents.

Build:
- local MCP server
- session store
- Project Brain MCP tools documented in `AGENT_INTEGRATION.md`
- one real MCP-capable coding-agent integration
- post-session outcome capture
- observation grounding pipeline

Acceptance:
- Agent 1 works on a task and reports an outcome
- Brain stores a safe session memory
- Agent 2 later receives that outcome and continues with no manual re-explanation

## Phase 5 — Workflow verification

Build:
- validation runner
- correlations
- deterministic verification service
- manual QA evidence
- impact analysis
- readiness report

Acceptance:
- task `done` and task `verified` remain separate concepts
- failed validation visibly blocks verified readiness

## Phase 6 — SaaS/team preparation

Only after the local product is reliable:
- storage abstraction for remote backend
- authentication
- projects/workspaces/organizations
- team roles
- sync policy
- audit log
- billing boundaries
- cloud data policy

Do not put cloud complexity into the local core before the product loop is proven.
