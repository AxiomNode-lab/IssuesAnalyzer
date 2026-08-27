# Issue actionability analyzer

Pure, deterministic analysis of whether an issue currently describes a contribution-ready
implementation task. It uses the issue title, body, and labels; it has no network, LLM, environment,
or system-clock dependency.

Positive observable signals include implementation-oriented labels, a concrete requested change,
reproduction information, expected outcomes or checklists, specific code targets, and explicit
accepted implementation direction. Negative signals include discussion-oriented labels, unresolved
alternative approaches, open-ended requests for direction, and tracking/umbrella language.

Labels are evidence, never absolute rules. `meta` or `discuss` lowers the score but does not force it
to zero. Explicit consensus or an accepted implementation direction can outweigh earlier discussion
signals. Missing issue text lowers confidence instead of inventing clarity.

Facts record the detected labels and text structures with the issue as provenance. The classification
is a separate inference with a caution that maintainers can clarify or change direction later. The
analyzer does not infer private intent or guarantee that a task will be accepted.
