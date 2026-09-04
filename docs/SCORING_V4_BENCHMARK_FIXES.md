# Scoring v4 benchmark gap fixes

This follow-up addresses evidence failures found during live benchmark testing after v4 landed:

- active PR linkage can be inferred from concrete PR references in resolution comments when the referenced PR is present in collected repository PR evidence;
- assigned issues expose a conditional blocker fact and are capped independently of active PRs;
- six or more fresh contributor claims are treated as crowded competition and capped;
- claim risk now rises materially with multiple independent claims;
- security subject matter alone is no longer treated as implementation complexity;
- dependency wording is recognized more broadly, while migration/backfill remains a separate risk.

The scoring engine derives caps from conditional evidence keys as a defense-in-depth measure, so orchestration cannot accidentally omit a blocker that an analyzer already proved.
