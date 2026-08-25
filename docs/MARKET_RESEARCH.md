# Market and Competitor Research

Research date: 2026-08-25. This is a landscape scan, not proof of product-market fit.

## Finding
The broad idea is not new. Issue discovery and repository-health scoring exist separately. The defensible opportunity is an evidence-backed, personalized **issue pre-flight report** that combines skill fit, issue readiness, competition, and historical maintainer responsiveness.

## Direct and adjacent products
| Product/project | What it does | Gap relative to our thesis |
|---|---|---|
| [GitHub issue search](https://github.com/issues) | Powerful native filters | Requires manual judgment; no personalized risk report |
| [Good First Issue](https://goodfirstissue.dev/) | Curated beginner issues by language | Primarily discovery and curation |
| [CodeTriage](https://www.codetriage.com/) | Sends open-source issues to contributors | Does not center an explainable pursue/skip analysis |
| [Up For Grabs](https://up-for-grabs.net/) | Curated projects with contributor tasks | Project directory rather than opportunity-risk analysis |
| [For Good First Issue](https://github.com/github/forgoodfirstissue) | Social-impact project curation | Narrow mission and label-based discovery |
| [voscarmv/issue-finder](https://github.com/voscarmv/issue-finder) | Beginner-friendly issue search | Search engine; limited readiness/response analysis |
| [grayad/first-issue-finder](https://github.com/grayad/first-issue-finder) | GitHub API good-first-issue browser | Label-based finder |
| [GitIsMatch](https://medium.com/@samiratra95/matching-your-code-with-purpose-how-gitismatch-uses-ai-to-bridge-the-open-source-gap-0d8873dd2e46) | AI matching of contributors and projects | Matching is close; differentiation must be evidence and time-risk |
| [Statflare Repo Analyzer](https://www.statflare.in/github-repo-analyzer) | Repository health score | Repository-level analysis, not issue/user decision |
| [GitHub Health Analyzer](https://github.com/xedi1/GitHub-Health-Analayzer) | CLI repository health score | Adjacent building block, not full contributor workflow |
| [Opire](https://opire.dev/) | GitHub-linked rewards | Bounty workflow, not general opportunity-quality analysis |
| [IssueHunt](https://oss.issuehunt.io/) | Funded open-source issues | Some listings appear old; payment marketplace focus |

## Demand signals
Reddit discussions repeatedly mention ignored pull requests and advise contributors to inspect recent maintainer response and PR activity before starting. This supports the problem hypothesis, but anecdotes are not market validation:
- [Ignored pull requests discussion](https://www.reddit.com/r/opensource/comments/15jjp7n/most_of_my_pull_requests_have_been_ignored_no/)
- [Choosing first projects discussion](https://www.reddit.com/r/opensource/comments/1q122dk/what_are_the_best_open_source_projects_to_start/)
- [Maintainer overload discussion](https://www.reddit.com/r/opensource/comments/1pn9qpl/solo_maintainer_suddenly_drowning_in_prsissues_i/)

## Positioning
Do not claim “the first GitHub issue finder.” Proposed positioning:

> Know whether a GitHub issue is worth your time before you start.

## Validation risks
- Users may accept manual GitHub search as good enough.
- Beginners may want mentorship more than ranking.
- Historical response time may poorly predict future response.
- GitHub API limits constrain broad, deep scans.
- Users may not pay; communities or bootcamps may be better customers.

## Next research
Interview contributors who had PRs ignored, run a clickable report test, compare decisions with and without the report, and measure repeat usage. Search should expand periodically because this market changes quickly.
