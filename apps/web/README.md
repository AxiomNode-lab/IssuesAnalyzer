# Web application

Accessible Next.js application shell for GitHub Opportunity Radar.

## MVP-02 scope

The interface deliberately uses one route: `/`. The page moves between input, validation,
loading-preview, and backend-unavailable states without creating a multi-page product.

Included:

- semantic, responsive landing and report-preview shell;
- local GitHub Issue URL format feedback;
- light and dark color tokens;
- keyboard focus, skip link, form error association, and live status;
- restrained Roman archive styling with GitHub-like developer-tool clarity.

Not included:

- GitHub API requests or credentials;
- real issue analysis, scoring, authentication, persistence, or payments;
- fake analysis results.

## Commands

From the repository root:

```bash
pnpm dev
pnpm verify
```

Browser code must never receive GitHub App private keys, upstream access tokens, database
credentials, or raw untrusted HTML.
