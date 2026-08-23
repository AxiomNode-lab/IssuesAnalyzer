# Data Model

## Core entities

### Project
- id
- name
- rootPath
- createdAt
- updatedAt
- lastScannedAt

### ProjectKnowledge
- id
- projectId
- type: decision | requirement | risk | fact | note | external_context | ai_memory
- title
- summary
- state: known | verified | inferred | missing | external | user_provided | unverified
- confidence
- sourceIds[]
- supersedesId?
- createdAt
- updatedAt

### Task
- id
- projectId
- title
- description
- status: todo | in_progress | done | archived
- priority
- sourceId?
- createdAt
- updatedAt

### Claim
- id
- projectId
- taskId?
- statement
- status
- sourceId?

### Evidence
- id
- projectId
- taskId?
- claimId?
- type: source | implementation | validation | manual_qa | runtime | document
- reference
- summary
- confidence
- createdAt

### Correlation
- id
- projectId
- claimId
- evidenceId
- relationship: supports | contradicts | relates
- confidence

### ValidationRun
- id
- projectId
- taskId?
- command
- status
- summary
- startedAt
- finishedAt

### AIConversationMemory
- id
- projectId
- taskId?
- sourceAgent
- title
- summary
- activeDecisions[]
- supersededDecisions[]
- discoveries[]
- unresolvedQuestions[]
- nextSteps[]
- createdAt
- updatedAt

### AgentSession
- id
- projectId
- taskId?
- adapterId
- mode
- objective
- status
- suppliedContextIds[]
- startedAt
- completedAt?

### AgentObservation
- id
- sessionId
- projectId
- taskId?
- statement
- sourceIds[]
- state: unverified | grounded | rejected
- createdAt

## Important invariants

- No record from an LLM or agent becomes `verified` without grounding.
- Superseded decisions are retained; they are not deleted.
- Task details are projections over linked records, not duplicated copies of every record.
- Raw AI transcripts are not persisted by the MVP.
- Secret-like values are redacted or rejected at boundaries.
