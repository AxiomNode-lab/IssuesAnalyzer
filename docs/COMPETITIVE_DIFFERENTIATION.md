# Competitive Differentiation

## Purpose

This document explains how GitHub Opportunity Radar differs from existing GitHub issue discovery, contribution matching, repository health, and bounty platforms.

## Market reality

The general idea of helping developers find open-source issues is not new. Existing products already provide:

- lists of `good first issue` and `help wanted` tasks;
- filtering by programming language or repository;
- beginner-friendly project directories;
- repository health scores;
- funded issue and bounty listings;
- contributor-to-project matching.

Therefore, the product must not claim to be the first GitHub issue finder. Its value must come from helping a developer make a better **pursue-or-skip decision** before investing time.

## User problem

Finding an open issue does not tell the developer:

- whether the repository is actively maintained;
- whether maintainers usually respond to outside contributors;
- whether another developer is already solving it;
- whether the issue description is sufficiently clear;
- whether the project is ready to accept contributions;
- whether the task matches the developer's skills and time;
- whether a listed reward is current or likely to be legitimate.

Reddit discussions provide qualitative evidence that contributors experience ignored pull requests and difficulty choosing responsive projects:

- [Most of my pull requests have been ignored](https://www.reddit.com/r/opensource/comments/15jjp7n/most_of_my_pull_requests_have_been_ignored_no/)
- [Choosing an open-source project to contribute to](https://www.reddit.com/r/opensource/comments/1q122dk/what_are_the_best_open_source_projects_to_start/)

These discussions support the problem hypothesis, but they do not prove product-market fit or willingness to pay.

## Proposed value

> Know whether a GitHub issue is worth your time before you start.

Instead of returning another list of issues, the product generates one evidence-backed pre-flight report combining:

- skill and experience fit;
- repository activity;
- historical maintainer responsiveness;
- visible competition and linked pull requests;
- issue clarity and scope;
- contribution readiness;
- time-risk warnings;
- confidence and data freshness;
- links to the evidence behind every important conclusion.

## Competitive comparison

| Capability | GitHub Search | Issue directories | Repo health tools | Bounty platforms | Opportunity Radar |
|---|:---:|:---:|:---:|:---:|:---:|
| Search open issues | Yes | Yes | Usually no | Funded only | Later phase |
| Filter by language/label | Yes | Yes | No | Sometimes | Yes |
| Analyze one specific issue | Manual | Limited | No | Limited | Core feature |
| Personal skill fit | Manual | Basic | No | Usually no | Yes |
| Repository activity analysis | Manual | Basic | Core feature | Limited | Yes |
| Maintainer responsiveness | Manual | Usually no | Sometimes repo-level | Usually no | Issue decision signal |
| Detect visible competition | Manual | Usually no | No | Claim status only | Yes |
| Evaluate issue clarity | Manual | No | No | No | Yes |
| Explain score with evidence | No score | Usually no | Varies | No | Required |
| Show confidence and freshness | Manual | Limited | Varies | Listing status | Required |
| Warn without guaranteeing outcome | Manual | Limited | Health only | Payment-focused | Required |

## Competitor categories

### Native GitHub discovery

[GitHub Issues](https://github.com/issues) provides powerful search qualifiers and should be treated as both a competitor and the primary upstream platform. It is excellent for finding results but leaves opportunity evaluation to the user.

### Issue directories and finders

- [Good First Issue](https://goodfirstissue.dev/)
- [CodeTriage](https://www.codetriage.com/)
- [Up For Grabs](https://up-for-grabs.net/)
- [For Good First Issue](https://github.com/github/forgoodfirstissue)
- [EddieHub Good First Issue Finder](https://github.com/EddieHubCommunity/good-first-issue-finder)
- [Fastify gh-issues-finder](https://github.com/fastify/gh-issues-finder)
- [Issue Finder](https://github.com/voscarmv/issue-finder)
- [First Issue Finder](https://github.com/grayad/first-issue-finder)

These tools validate demand for easier discovery. Most emphasize finding or curating issues rather than estimating the risk of working on one particular issue.

### Matching tools

- [IssueMatch](https://github.com/AvishkarPatil/IssueMatch)
- [GitIsMatch](https://medium.com/@samiratra95/matching-your-code-with-purpose-how-gitismatch-uses-ai-to-bridge-the-open-source-gap-0d8873dd2e46)

Matching overlaps with our skill-fit component. Skill matching alone is therefore not a defensible differentiator.

### Repository health tools

- [GitHub Health Analyzer](https://github.com/xedi1/GitHub-Health-Analayzer)
- [Statflare GitHub Repo Analyzer](https://www.statflare.in/github-repo-analyzer)

Repository health is an input to our report, not the complete product. A healthy repository can still contain an unclear, contested, or unsuitable issue.

### Bounty platforms

- [Opire](https://opire.dev/)
- [IssueHunt](https://oss.issuehunt.io/)

These focus on funding and claims. Our product may display verified external reward evidence later, but it must not guarantee payment or depend on unauthorized scraping.

## Defensible product principles

The differentiation must be maintained through product behavior:

1. **Evidence before recommendation** — every score component links to supporting facts.
2. **Facts separated from inference** — an unassigned issue is not automatically available.
3. **Confidence, not false certainty** — missing or stale evidence reduces confidence.
4. **Issue-level decision support** — repository health alone is insufficient.
5. **Personalization without opaque ranking** — the user can see and change the skills used.
6. **Outcome learning** — future calibration should use whether users received responses and had pull requests accepted.
7. **Time saved as the primary outcome** — success is fewer wasted hours, not more issue listings.

## What we must not claim

Do not claim that the product:

- guarantees a maintainer response;
- guarantees pull-request acceptance;
- guarantees bounty payment;
- knows the exact implementation time;
- proves an issue is unclaimed;
- is the first issue finder;
- uses AI as proof that a conclusion is correct.

## Positioning hypothesis

Primary:

> Know whether a GitHub issue is worth your time before you start.

Alternative:

> An evidence-backed pre-flight check for open-source contributions.

This positioning remains a hypothesis until validated through interviews, prototype usage, repeat analyses, and pursue-or-skip decision measurements.
