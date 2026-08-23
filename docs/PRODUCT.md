# Product Definition

## Product identity

Project Brain is a persistent project-memory and AI context runtime for software development.

It has three primary product areas:

1. **Project** — project brief, project health, and project knowledge.
2. **Workflow** — task-centric work, memory, evidence, validation, and activity.
3. **AI** — AI handoff, prompt generation, connected agents, AI memories, and session history.

The product should feel simple at the navigation level while preserving advanced/manual capabilities underneath.

## Core loop

`Collect -> Interpret -> Understand -> Work -> Observe -> Verify -> Remember -> Reuse`

## Project

The Project area answers: **What does Project Brain know about this project?**

Primary surfaces:
- Project Brief
- Project Health Report
- Project Knowledge

Secondary/manual capabilities:
- Memory
- Decisions
- Requirements
- Risks
- Sources
- Missing/external context

## Workflow

The Workflow area answers: **What are we working on, and what is true about that work?**

The Board is the entry point.

Opening a task must show everything relevant to that task in one place:
- title, description, status, priority
- source and provenance
- requirements and next actions
- related memory and decisions
- claims and evidence
- validation status
- impact analysis
- AI-ready context
- activity history

Project-wide manual management for Memory, Claims, Evidence, Correlations, and Review remains available as secondary views.

## AI

The AI area answers: **How does an AI model or agent work on this project without losing context?**

Primary surfaces:
- Work with AI
- Connected Agents
- AI Memories
- History

### Work with AI

Two paths:
1. direct connected agent session
2. safe prompt/handoff fallback

### AI Memories

Manual flow:
1. User opens an external AI conversation.
2. User copies this extraction prompt:

> Give me, as structured bullet points, the important conclusions and decisions we reached. Clearly identify decisions that were canceled, superseded, or no longer valid, and state what replaced them. Include important discoveries, unresolved questions, and recommended next steps. Do not include secrets, credentials, raw logs, or irrelevant conversation text.

3. User pastes the structured answer into Project Brain.
4. Project Brain stores it as a safe AI Memory linked to the project and optionally a task.
5. Superseded decisions are retained as historical records rather than deleted.

Connected-agent flow:
- session outcome is captured automatically as bounded structured memory
- agent observations remain unverified until grounded by project data or human review

## Product rule

**Hide complexity from navigation, not from capability.**
