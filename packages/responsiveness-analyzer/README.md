# Maintainer responsiveness analyzer

Pure, deterministic analysis of observed historical maintainer interactions.

## Guarantees

- reports historical observations, never an exact response-time prediction or reply guarantee;
- uses a median so a small number of extreme delays cannot dominate the result;
- ignores bot and non-maintainer interactions;
- handles unanswered, sparse, and missing samples explicitly;
- analyzes at most 50 threads and 100 interactions per thread;
- uses an explicit `asOf` timestamp with no system-clock, network, or database access;
- returns sample size, response coverage, confidence, facts, inferences, and warnings.

## Input contract

The orchestration layer supplies public issue and pull-request samples with normalized interactions.
Maintainer identity is evidence supplied with each interaction; this package does not infer repository
permissions or fetch membership data.
