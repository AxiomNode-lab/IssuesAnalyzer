# GitHub client

Server-side, read-only adapter for GitHub evidence collection.

## Guarantees

- fixed `https://api.github.com` origin;
- GET-only public operations;
- optional bearer token never returned or logged;
- bounded timeouts and retries;
- redirects rejected;
- GitHub API version and media type sent explicitly;
- 403, 404, 429, timeout, network, invalid-payload, and upstream failures classified;
- payloads parsed into normalized internal models;
- quota and request identifiers returned as metadata.

The client accepts identifiers produced by `@opportunity-radar/domain`. Browser components must
not import or instantiate it.

GraphQL operations will be added only as typed, query-only operations when an analyzer requires
data that REST cannot collect efficiently. A generic arbitrary-query or mutation surface is
intentionally not exposed.
