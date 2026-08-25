# GitHub Integration

## API choice
Use GraphQL for bounded evidence aggregation and REST for endpoints that are simpler or unavailable in GraphQL. The adapter hides both behind internal interfaces.

## MVP data
- Issue state, labels, timestamps, comments, assignees.
- Repository archived status, default branch, releases, recent commits.
- Pull requests and references relevant to the issue.
- Community profile: README, license, CONTRIBUTING, templates, code of conduct.
- Authenticated user's public profile and repositories only when needed for skill inference.

## Constraints
- Authenticated GraphQL access is point-limited; REST search has a separate quota.
- Deep analysis must be limited to a small candidate set.
- GitHub issue endpoints can include pull requests; normalize explicitly.
- Webhooks only cover repositories where the app is installed; public global discovery requires periodic search.
- Organization policy can block app installation.
- Private repositories are out of MVP scope.

## Rate-limit strategy
- Inspect quota headers/cost after every request.
- Reserve capacity for interactive requests.
- Bound pagination and evidence samples.
- Cache shared public evidence.
- Deduplicate refreshes.
- Stop and retry after the documented reset; never hammer on 403/429.
- Prefer partial reports with lower confidence over total failure.

## Permissions
Request identity plus the minimum read-only metadata permissions. Exact permissions must be verified against the endpoints during implementation. Any permission expansion requires an ADR, security review, and user-facing explanation.

## References
- [REST rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)
- [GraphQL limits](https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api)
- [REST versus GraphQL](https://docs.github.com/en/rest/about-the-rest-api/comparing-githubs-rest-api-and-graphql-api)
- [GitHub Apps versus OAuth apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/differences-between-github-apps-and-oauth-apps)
- [Community metrics](https://docs.github.com/en/rest/metrics/community)
- [Webhook guidance](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/using-webhooks-with-github-apps)
