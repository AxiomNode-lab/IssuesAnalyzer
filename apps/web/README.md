# Web application

Accessible Next.js application for live, evidence-backed analysis of public GitHub issues.

## Analysis flow

The browser submits only a GitHub Issue URL to `POST /api/analyze`. The route validates the URL and
same-origin request, enforces body and abuse limits, and calls GitHub from the server through the
read-only client. Existing activity, competition, responsiveness, cache/deduplication, scoring,
security, and observability modules produce the report rendered by the homepage.

## Local setup

From the repository root:

```bash
corepack enable
corepack prepare pnpm@11.23.0 --activate
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

Open `http://localhost:3000` and analyze
`https://github.com/sympy/sympy/issues/27888`.

`GITHUB_TOKEN` is optional. Public unauthenticated requests work with GitHub's lower quota. A token
placed in `.env.local` raises that quota and is read only by the server. Do not expose it through a
`NEXT_PUBLIC_` variable. PostgreSQL is not required for anonymous analysis, but account routes and
database integration tests require the database configuration documented in the root project docs.

Browser code must never receive GitHub tokens, GitHub App private keys, session secrets, database
credentials, or raw untrusted HTML.
