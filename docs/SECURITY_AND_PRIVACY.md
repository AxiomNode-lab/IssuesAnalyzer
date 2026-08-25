# Security and Privacy

## Security objectives
Protect GitHub identities and tokens, prevent server-side request forgery, avoid supply-chain compromise, and ensure the application cannot modify user repositories in MVP.

## Threat model
| Threat | Primary control |
|---|---|
| OAuth/token theft | short-lived GitHub App tokens, encrypted server-side sessions, rotation |
| SSRF through pasted URLs | parse URL; allow only `github.com`; construct API URLs internally |
| XSS from issue Markdown | trusted sanitizer, no raw HTML, restrictive CSP |
| Injection | parameterized SQL, strict schemas, no shell construction |
| API abuse/cost exhaustion | quotas, rate limits, caching, bounded fan-out |
| GitHub webhook spoofing | HMAC signature verification and replay protection |
| Dependency compromise | lockfiles, Dependabot, provenance review, pinned CI actions |
| Data leakage in logs | structured redaction and secret scanning |
| Broken access control | deny-by-default ownership checks on every user resource |

## Authentication
Use a GitHub App with minimal read-only permissions. Do not request repository write, issue write, administration, or private-repository access in MVP. Tokens never reach browser JavaScript or analytics.

## Application controls
- Secure, HttpOnly, SameSite cookies.
- CSRF protection for mutations.
- CSP, HSTS, Referrer-Policy, Permissions-Policy, and frame restrictions.
- CORS deny-by-default.
- Request body and decompression limits.
- Constant-time webhook signature comparison.
- Generic responses for inaccessible/private resources.
- MFA required for production and cloud administration.
- Separate production credentials and least-privilege service accounts.

## Secure development
- Branch protection and required reviews.
- CodeQL, dependency review, secret scanning, Dependabot.
- SAST is not a substitute for review or testing.
- Security regression tests for authorization, URL parsing, Markdown, rate limits, and webhooks.
- Maintain an incident runbook and dependency inventory.

## Privacy
Collect only data required to generate and save reports. Do not sell profile or behavioral data. Analytics must be opt-in or privacy-preserving. Provide export and deletion. Publish retention periods before launch.

## Reporting
See repository `SECURITY.md`. Never disclose exploitable details in public issues before triage.
