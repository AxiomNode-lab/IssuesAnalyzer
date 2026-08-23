# Architecture

## Goals

- local-first by default
- deterministic collection before semantic interpretation
- explicit provenance for important knowledge
- incomplete repositories are represented honestly
- agent integrations are provider-neutral
- renderer never receives unrestricted database or filesystem access
- direct agent sessions and prompt handoff share the same context-building rules

## High-level components

```text
Desktop UI
  -> Application API
  -> Project Service
     -> Safe Scanner
     -> Project Knowledge Store
     -> Workflow Service
     -> Verification Service
     -> Context Runtime
     -> AI Memory Service
     -> Agent Runtime
          -> Agent Adapter / MCP Bridge
          -> External or local agent
     -> Semantic Service
          -> LLM Provider Adapter
```

## Product boundaries

### Project Service
Builds project brief, health, knowledge, and coverage from persisted records.

### Workflow Service
Owns tasks and task-centric projections. A task is an aggregate view over task metadata plus linked memory, evidence, validation, activity, and AI context.

### Context Runtime
Builds minimum-sufficient context for a specific project/task/objective. It applies relevance filtering, security filtering, provenance attachment, and budget limits.

### Semantic Service
Receives deterministic facts and asks a configured LLM to interpret/rank them. Output is always a candidate, never automatic truth.

### Agent Runtime
Provides bidirectional sessions with compatible agents. The preferred external protocol is MCP where supported; adapters may also target local HTTP/CLI/plugin bridges.

### AI Memory Service
Stores safe structured summaries of AI conversations and connected-agent session outcomes. Raw transcripts, browser sessions, cookies, credentials, and secrets are rejected.

## Repository incompleteness

The selected repository is a source, not the whole project.

Knowledge state:
- known
- verified
- inferred
- missing
- external
- user_provided
- unverified

Project Health reports coverage across repository, architecture, documentation, runtime, decisions, tasks, validation, and external dependencies.

## Agent integration

Preferred model:

```text
Agent
  <-> MCP / Agent Adapter
  <-> Project Brain Agent Runtime
  <-> Context Runtime
  <-> Project Knowledge
```

Core tools exposed conceptually to an agent:
- `get_project_context`
- `get_task_context`
- `get_relevant_files`
- `get_decisions`
- `get_memory`
- `report_discovery`
- `report_work_result`
- `report_validation`
- `end_session`

Agents never receive raw DB access.

## Session lifecycle

```text
Start session
 -> select project/task/objective
 -> build bounded context
 -> send context to agent
 -> agent works
 -> observations/results return
 -> rescan/validate
 -> create unverified/grounded knowledge candidates
 -> save safe session outcome
 -> next session can reuse that outcome
```

## Persistence

Use SQLite for the desktop MVP. Keep service interfaces storage-agnostic enough to support a future cloud/team backend.

## Suggested package layout

```text
apps/desktop
packages/domain
packages/database
packages/core
packages/scanner
packages/semantic
packages/agent-runtime
packages/shared
```
