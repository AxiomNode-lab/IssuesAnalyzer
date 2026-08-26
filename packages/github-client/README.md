# GitHub client

Server-side, read-only adapter for GitHub evidence collection.

## Guarantees

- fixed `https://api.github.com` origin;
- GET-only public operations;
- optional bearer token never returned or logged;
- bounded timeouts, retries, page size, and page count;
- redirects rejected;
- GitHub API version and media type sent explicitly;
- 403, 404, 429, timeout, network, invalid-payload, and upstream failures classified;
- payloads parsed into normalized internal models;
- quota and request identifiers returned as metadata;
- a failed page rejects the operation instead of returning silent partial evidence.

The client accepts identifiers produced by `@opportunity-radar/domain`. Browser components must
not import or instantiate it.

## Evidence endpoints and hard limits

| Evidence | REST endpoint | Hard limit |
| --- | --- | ---: |
| Repository | `GET /repos/{owner}/{repo}` | 1 |
| Issue | `GET /repos/{owner}/{repo}/issues/{issue_number}` | 1 |
| Issue comments | `GET /repos/{owner}/{repo}/issues/{issue_number}/comments` | 5 pages × 100 |
| Recent commits | `GET /repos/{owner}/{repo}/commits` | 100 |
| Recent releases | `GET /repos/{owner}/{repo}/releases` | 20 |
| Community profile | `GET /repos/{owner}/{repo}/community/profile` | 1 |
| Issue timeline | `GET /repos/{owner}/{repo}/issues/{issue_number}/timeline` | 3 pages × 100 |
| Recent pull requests | `GET /repos/{owner}/{repo}/pulls` | 100 |

The limits are enforced by the client even when callers request larger values. Every successful
response includes GitHub quota metadata. Callers should cache evidence and stop new analysis when
the remaining quota is insufficient; the client never guesses or fabricates missing evidence.

Timeline events retain only actor, event type, timestamp, and the canonical issue source URL.
Pull-request evidence retains only analyzer-required identity, state, author, timestamps, and URL.
Issue-to-PR relationships are derived later from normalized evidence; this client does not execute
search queries or follow arbitrary URLs.

GraphQL is intentionally deferred until an analyzer requires data that REST cannot collect
efficiently. It will be added only as typed, query-only operations with explicit payload parsers. A
generic arbitrary-query or mutation surface is prohibited.
