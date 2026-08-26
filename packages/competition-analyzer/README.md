# Competition analyzer

Pure, deterministic analysis of competition that is publicly visible on a GitHub issue.

## Guarantees

- no network, database, environment, or system-clock access;
- explicit `asOf` timestamp;
- bounded comments, timeline events, and pull requests;
- facts and inferences are separate;
- missing evidence lowers confidence instead of becoming zero competition;
- an unassigned issue is never described as guaranteed available;
- claim-language matches are cautious inferences, not confirmed ownership;
- bot comments and comments by the issue author do not create claim signals.

## Evidence limits

| Evidence | Maximum analyzed |
| --- | ---: |
| Comments | 500 |
| Timeline events | 300 |
| Pull requests | 100 |

A pull request is considered linked only when its title or body explicitly references the issue
number or canonical issue URL. Repository-wide pull requests without that reference are ignored.
