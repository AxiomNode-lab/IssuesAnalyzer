# Agent Integration

## Goal

Project Brain should be a context library/runtime for AI agents, not just a prompt exporter.

The agent asks Project Brain for the context it needs, works on the project, and reports discoveries/results back. Project Brain verifies and remembers those outcomes so another agent can continue later.

## Preferred integration: MCP

Use Model Context Protocol where the target agent supports MCP.

Project Brain should expose an MCP server locally with tools such as:

- `brain_get_project_context(projectId, objective, maxItems)`
- `brain_get_task_context(projectId, taskId, objective, maxItems)`
- `brain_get_decisions(projectId, taskId?)`
- `brain_get_memory(projectId, taskId?)`
- `brain_get_relevant_files(projectId, taskId, objective)`
- `brain_start_session(projectId, taskId?, agentId, mode, objective)`
- `brain_report_discovery(sessionId, statement, sourceRefs[])`
- `brain_report_work_result(sessionId, summary, changedFiles[])`
- `brain_report_validation(sessionId, command, status, summary)`
- `brain_end_session(sessionId, outcome)`

MCP resources can expose read-only project summaries and task projections. Sensitive or unrestricted repository content should not be exposed as a resource by default.

## Adapter fallback

For agents that do not support MCP, implement an `AgentAdapter`:

```ts
interface AgentAdapter {
  id: string;
  connect(): Promise<void>;
  startSession(input: AgentSessionStart): Promise<string>;
  sendContext(sessionId: string, context: AgentContextPackage): Promise<void>;
  receiveEvents(sessionId: string): AsyncIterable<AgentEvent>;
  cancelSession(sessionId: string): Promise<void>;
}
```

Adapters may target:
- local HTTP bridge
- editor extension
- CLI runner
- provider SDK/API when appropriate

Vendor-specific behavior must remain inside the adapter.

## Security boundary

The agent never receives direct SQLite access.

Outbound flow:

`project records -> context selector -> sensitive-data filter -> context budget -> adapter/MCP`

Inbound observations are always `unverified` until:
- deterministic rescan confirms them;
- a validator confirms them;
- linked evidence supports them; or
- a user explicitly reviews them.

## Session outcome schema

Every connected session should end with a bounded summary:

```json
{
  "summary": "...",
  "decisions": ["..."],
  "supersededDecisions": [
    { "previous": "...", "replacement": "..." }
  ],
  "discoveries": ["..."],
  "unresolvedQuestions": ["..."],
  "nextSteps": ["..."],
  "changedFiles": ["..."],
  "validation": ["..."]
}
```

This outcome is persisted as safe session history / AI memory. It is not equivalent to verification.

## Implementation phases

### Phase 1
- Context Runtime exists.
- Handoff preview works.
- Manual AI Memories work.

### Phase 2
- Add local MCP server package.
- Implement session store.
- Implement session tools listed above.
- Connect one real MCP-capable coding agent as the reference integration.

### Phase 3
- Add adapters for non-MCP environments.
- Add automatic post-session rescan and validator execution.
- Add semantic interpretation of grounded session deltas.

## Acceptance test

A successful integration proves this scenario:

1. Open Task A in Project Brain.
2. Start Agent 1.
3. Agent 1 receives only Task A's relevant context.
4. Agent 1 reports an implementation result and a new decision.
5. Project Brain rescans/verifies the result and stores the decision as grounded or pending review.
6. Start Agent 2 later.
7. Agent 2 receives the previous safe outcome and continues without the user re-explaining the project.
