# Visible competition analyzer

Pure, deterministic analysis of competition visible on a public GitHub issue.

## Linked and related pull requests

A pull request counts only when either:

- GitHub exposes it as the source of a timeline cross-reference; or
- its title/body explicitly references the canonical issue URL or same-repository issue number.

Typed timeline evidence preserves PR number, URL, state, draft state, timestamps, and merge state.
Open and draft PRs are active competing implementations and have the strongest effect. Merged and
closed-unmerged PRs remain visible historical evidence but have a much smaller effect. Duplicate PRs
seen through both sources are deduplicated by canonical URL.

Generic references to issues, commits, documentation, or other repository objects do not count as
competing PRs. Claim comments and assignees remain cautious separate signals.

## Confidence and limits

Confidence describes evidence completeness, not certainty that nobody is working. Missing sources
and collection bounds lower confidence. In particular, zero detected PRs from a truncated timeline
or bounded repository PR list is not treated as high-confidence absence.

| Evidence | Maximum analyzed |
| --- | ---: |
| Comments | 500 |
| Timeline events | 300 |
| Repository pull requests | 100 |

The system cannot see private forks, unpushed work, private intent, or references beyond collected
bounds. An unassigned issue with no detected active PR is never described as guaranteed available.
