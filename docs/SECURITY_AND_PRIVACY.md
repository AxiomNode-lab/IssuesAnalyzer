# Security and Privacy

## Security objectives
Protect GitHub identities and tokens, prevent server-side request forgery, avoid supply-chain compromise, and ensure the application cannot modify user repositories in MVP.

## Threat model
| Threat | Primary control |
|---|---|
| OAuth/token theft | short-lived GitHub App tokens, encrypted server-side sessions, rotation |
| SSRF through pasted URLs | parse URL; allow only `github.com`; construct API URLs internally; GitHub API client rejects redirects |
| XSS from issue Markdown | React text rendering, no raw HTML, allowlisted external URLs, restrictive CSP |
| Injection | parameterized SQL, strict schemas, no shell construction |
| API abuse/cost exhaustion | quotas, rate limits, caching, bounded fan-out |
| GitHub webhook spoofing | HMAC signature verification and replay protection |
| Dependency compromise | lockfiles, Dependabot, provenance review, pinned CI actions |
| Data leakage in logs | central structured redaction helper and secret scanning |
| Broken access control | deny-by-default ownership checks on every user resource |

## Authentication
Use a GitHub App/OAuth flow with minimal read-only permissions. Do not request repository write, issue write, administration, or private-repository access in MVP. Tokens never reach browser JavaScript or analytics.

Sessions are signed server-side and stored in `HttpOnly`, `SameSite=Lax` cookies. Mutations additionally require a CSRF token from a `SameSite=Strict` cookie and same-origin request boundary.

## Implemented application controls
- Content-Security-Policy with self-only defaults, blocked object embedding, `frame-ancestors 'none'`, constrained connect/image origins, and no wildcard default source.
- HSTS is emitted only in production.
- Referrer-Policy, Permissions-Policy, `X-Content-Type-Options: nosniff`, and frame denial.
- CORS is deny-by-default for API routes; cross-origin requests and preflights are rejected.
- JSON request bodies are read through a bounded streaming parser and oversized requests are rejected with HTTP 413.
- GitHub issue URLs accept only canonical HTTPS `github.com` issue URLs; credentials, ports, queries, fragments, lookalike hosts, localhost, and private-address hosts are rejected before outbound requests are constructed.
- GitHub API requests are constructed from validated identifiers against a fixed `https://api.github.com` origin and use `redirect: error`.
- React renders user-controlled text as text. No `dangerouslySetInnerHTML` is used for untrusted content. External GitHub/avatar URLs are allowlisted by protocol and host before use.
- CSRF verification is required on authenticated mutations, alongside same-origin enforcement and SameSite cookies.
- Database reads/deletes/updates derive ownership from the authenticated server session; browser-provided user IDs are not trusted.
- Existing per-user/per-IP throttling from MVP-12 is reused at authenticated/account API boundaries rather than introducing a second limiter.
- `redactForLog` recursively redacts sensitive-key fields and representative bearer tokens, GitHub tokens, and PostgreSQL connection strings before structured logging.

## Trust boundaries and limitations
- `x-forwarded-for` / `x-real-ip` may only be trusted when the deployment platform overwrites these headers. Production infrastructure must not forward attacker-supplied values unchanged.
- The in-process rate limiter is suitable for a single process. Horizontal scaling requires a shared counter store, as documented in the resilience policy.
- CSP currently permits inline script/style because Next.js production rendering requires compatibility with its generated runtime. This is narrower than wildcard script execution but should later move to nonce/hash-based CSP when deployment middleware is available.
- The MVP currently renders plain text rather than accepting arbitrary Markdown HTML. If a Markdown renderer is added later, raw HTML must remain disabled and URL sanitization must stay in place.
- Central redaction is available for application logging; new logging call sites must explicitly pass structured payloads through it. Production observability work must preserve this boundary.
- Webhook controls are documented in the threat model but no webhook endpoint exists in this MVP.

## Secure development
- Branch protection and required reviews.
- CodeQL, dependency review, secret scanning, Dependabot.
- SAST is not a substitute for review or testing.
- Security regression tests cover authorization, URL parsing/SSRF bypasses, XSS URL handling, CSRF, CORS, body limits, security headers, and log redaction.
- Maintain an incident runbook and dependency inventory.

## Privacy
Collect only data required to generate and save reports. Do not sell profile or behavioral data. Analytics must be opt-in or privacy-preserving. Provide export and deletion. Publish retention periods before launch.

## Reporting
See repository `SECURITY.md`. Never disclose exploitable details in public issues before triage.
