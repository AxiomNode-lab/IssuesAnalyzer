# Authentication and account data

## GitHub OAuth

The MVP uses the GitHub OAuth web flow only to identify a user. The authorization request asks for `read:user` and does not request `repo`, write, organization, workflow, or administration scopes. Private repositories remain unsupported.

Required server environment variables:

- `GITHUB_OAUTH_CLIENT_ID`
- `GITHUB_OAUTH_CLIENT_SECRET`
- `SESSION_SECRET` — at least 32 characters
- `DATABASE_URL`
- `APP_ORIGIN` — canonical HTTPS origin outside local development

Configure the GitHub OAuth callback URL as:

`<APP_ORIGIN>/api/auth/github/callback`

## Session and CSRF policy

- Session data is authenticated with HMAC-SHA256 and expires after eight hours.
- The session cookie is `HttpOnly`, `SameSite=Lax`, `Secure` in production, and scoped to `/`.
- OAuth `state` is random, short-lived, `HttpOnly`, and scoped to the OAuth route.
- Mutating authenticated routes use a double-submit CSRF token. The CSRF cookie is `SameSite=Strict`; clients submit the same value through `x-csrf-token`.
- GitHub access tokens are used only during the callback to read `/user`; they are not stored in the session or database.

## Saved opportunities and ownership

Saved opportunities are always selected, inserted, updated, and deleted using the authenticated internal `user_id`. The browser cannot select an owner. When a saved opportunity references a report, the server first verifies that the report belongs to the same user and GitHub issue.

Endpoints:

- `GET /api/saved` — list the current user's saved opportunities.
- `POST /api/saved` — save an existing public GitHub issue; requires CSRF.
- `DELETE /api/saved/:id` — delete only a row owned by the current user; requires CSRF.

The application does not use authentication to unlock private-repository analysis. Analysis input remains limited to public GitHub issue URLs.

## Account export and deletion

- `GET /api/account/export` returns the authenticated user's profile, owned reports, and saved opportunities as JSON with `Cache-Control: no-store`.
- `POST /api/account/delete` requires CSRF and deletes the `users` row.
- PostgreSQL cascades deletion to the profile and saved opportunities.
- Historical reports remain as evidence snapshots but their `user_id` becomes `NULL`, preventing retained report history from identifying the deleted account.
- An audit event is written immediately before deletion; its user references become `NULL` through the schema's `ON DELETE SET NULL` behavior.

Database integration tests verify saved-opportunity isolation and account deletion semantics.
