# Domain

Framework-independent entities, policies, and use cases. This package owns business
terminology and must not import UI, GitHub SDK, or database implementation code.

## GitHub issue URL policy

`parseGitHubIssueUrl(input)` accepts only canonicalizable public issue URLs shaped as:

```text
https://github.com/owner/repository/issues/123
```

It returns canonical identifiers or a stable error code and performs no network request.

The policy rejects non-HTTPS destinations, lookalike hosts, IP addresses, credentials, explicit
ports, query strings, fragments, encoded or ambiguous paths, pull request URLs, and malformed
identifiers.

This is the allowlist boundary before the future GitHub adapter. It does not prove that an issue
exists or is public; the read-only GitHub client will establish that later.

## Verification

From the repository root:

```bash
pnpm test
pnpm typecheck
```
