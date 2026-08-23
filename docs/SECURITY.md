# Security

## Principles

- local-first by default
- explicit project selection
- no unrestricted filesystem access from the UI
- no raw database access for agents
- secret-like data is rejected or redacted before AI boundaries
- raw AI transcripts, cookies, browser sessions, and credentials are not accepted as AI Memories
- external AI sending must be opt-in

## Safe scanner exclusions

At minimum exclude:
- `.git`
- `.env*`
- `node_modules`
- build/output/cache folders
- private keys and certificate files
- `.project-brain` internal state
- known credential/session paths

## Agent security

Agents receive bounded context packages rather than database handles or full repository dumps.

Every outbound item should carry provenance. Sensitive data must be filtered before MCP/adapter delivery.

Inbound agent discoveries are untrusted observations until grounded.

## Desktop boundary

When converting the current Vite shell to Electron:
- enable `contextIsolation`
- disable renderer `nodeIntegration`
- expose a minimal typed preload API
- keep filesystem/database/scanner/network agent bridge logic in the main process or trusted backend process
- validate every IPC argument

## SaaS future

A future cloud/team version must add tenant isolation, authn/authz, encrypted transport/storage, audit logs, project membership permissions, and explicit controls over what local project data can sync.
