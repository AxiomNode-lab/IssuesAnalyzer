# Product Requirements

## Product
Working name: **GitHub Opportunity Radar**.

## Problem
Developers can find thousands of open issues, but cannot quickly determine whether an issue is suitable, active, already contested, clearly specified, or likely to receive maintainer attention. Existing discovery lists emphasize labels and language; repository-health tools analyze repositories rather than the specific opportunity.

## Target users
1. New contributors seeking a first credible contribution.
2. Intermediate developers building public proof of work.
3. Developers searching for funded issues, with explicit payment-risk warnings.
4. Educators and communities curating contribution opportunities.

## Core job
Given a public GitHub issue URL, produce an evidence-backed pre-flight report answering:
- Is the repository active and contribution-ready?
- Is the issue clear and apparently unclaimed?
- How responsive have maintainers been historically?
- Does it match the user's declared skills and available time?
- What evidence supports each conclusion?

## MVP scope
- GitHub sign-in with minimal permissions.
- Analyze one public issue URL.
- Repository activity, community-health, competition, clarity, and skill-fit signals.
- Explainable score, confidence, warnings, and source links.
- Save reports and re-check stale reports.
- Draft a communication message; user posts it manually.
- Accessibility, responsive UI, and exportable Markdown report.

## Non-goals for MVP
- Guaranteeing acceptance, response, payment, or task duration.
- Posting comments, opening PRs, or modifying repositories.
- Private repository access.
- Scraping third-party bounty platforms.
- Autonomous code generation or solving issues.
- Global continuous indexing of GitHub.

## Functional requirements
- Validate and normalize GitHub issue URLs.
- Reject unsupported hosts and non-issue URLs.
- Distinguish issues from pull requests.
- Fetch only required public metadata.
- Show data freshness and analysis timestamp.
- Display score components and raw evidence.
- Mark inferred claims separately from facts.
- Let users correct their skill profile.
- Handle deleted/private/rate-limited resources gracefully.

## Success metrics
- Report completion rate >= 95% for valid public issues.
- Median warm report latency < 1.5 seconds; cold report target < 6 seconds.
- At least 60% of testers say the report changed a pursue/skip decision.
- At least 30% of testers return to analyze a second issue.
- Zero write permissions requested from GitHub in MVP.

## Acceptance principles
A feature is complete only when it has tests, observability, documentation, accessible states, secure defaults, and explicit failure behavior.
