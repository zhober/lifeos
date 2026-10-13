# Research effort routing

This is a high-priority shared operating rule for the main assistant, every current/future domain expert, the critic, and the system evolver. Follow it before allocating external research work. It controls depth and effort while preserving required accuracy, source attribution, freshness checks, and review. Shared default: project.json research.default_mode is lightweight. Explicit user instructions about depth or scope take precedence for that request.

## Default: the smallest sufficient lookup

Start with relevant retained records, reusable knowledge, previous source checks, and the user's actual question. Reuse valid evidence instead of researching the same issue again. When fresh external verification is required, use a focused query or open a suitable primary/official source and inspect the relevant passage. A simple current fact can require browsing without requiring a literature review.

| Mode | Use | Typical work |
|---|---|---|
| local | Existing records, stable calculations, or retained applicable information already answer the question | Read relevant files, check their applicability, and calculate through scripts |
| lightweight | A routine question or changing fact can be resolved with targeted reliable information | A few focused searches/direct pages, enough reading to verify the decisive statement, basic provenance/date/applicability checks |
| deep | A genuinely difficult unresolved question or material conflicting evidence cannot be settled with local/lightweight work; alternatively the user explicitly requests an in-depth scope | Focused literature/database research, detailed methods appraisal, original-study tracing, complex evidence synthesis, or coordinated specialist investigation |

Depth describes the amount of work rather than a source's identity. Reading one relevant paper or guideline passage can be lightweight. Searching multiple databases, chasing extensive citation trees, collecting many full texts, or preparing a systematic-style synthesis is deep work. A source catalog, a medical topic, a prestigious journal, a panel, a requested citation, or a source-confidence label does not by itself require deep mode.

## Escalation conditions

Escalate only for one of these concrete reasons:

1. hard_question: the authorized decision depends on an important unresolved claim that adequate local/targeted sources cannot answer. Complexity may involve uncommon circumstances, unclear applicability, technical methods, or a decisive evidence gap. A missing optional detail or curiosity is insufficient.
2. material_source_conflict: seemingly comparable credible sources disagree enough to change the conclusion, recommended action, applicability, or important risk, and focused reconciliation cannot settle it.
3. explicit_user_depth: the user specifically requests comprehensive literature research or an equivalent deeper deliverable. This is a request-level override; a request to search, provide a link, or name sources alone is not such an instruction.

A request for a longer explanation or more detailed answer does not by itself request new deep research. Use local/lightweight evidence to explain fully when it already suffices.

Before treating disagreement as material, check versions, units, terminology, target populations, outcomes, source quality, and whether reports use the same underlying evidence. Minor wording differences, old versus current guidance, or an unsupported media claim against directly applicable authoritative guidance may be resolved with a focused check. Do not manufacture a conflict to justify more searching.

If missing personal measurements, preferences, occurrence dates, report text, or product requirements are decisive, obtain that information or keep the conclusion qualified. Literature cannot supply unreported personal facts. An inaccessible site/tool or a transient service failure is not proof the subject requires deep research; try a reasonable equivalent primary source within the same scope and retain the limitation if verification remains unavailable.

When the question's consequences are important, ensure that the chosen evidence is adequate for the proposed conclusion. Importance alone does not trigger broad literature work. A directly applicable official source can support a routine answer; an unresolved important claim may meet hard_question. If adequate evidence is unavailable, narrow/defer the claim or identify necessary professional assessment instead of pretending certainty. Immediate concerns should not wait for lengthy research rounds.

## Stop and reuse

Stop when the authorized question has a sufficiently supported answer, the relevant freshness/applicability checks are satisfied, and no material unresolved contradiction affects it. Do not continue collecting sources for appearance, a larger citation count, a higher journal quartile, or an artificial confidence increase. Cross-source corroboration can use a small number of genuinely independent relevant sources; it is not an instruction to find every agreeing article.

In deep mode, define the precise unresolved question, scope, expected outcome, and stopping condition before expanding the search. Resolve that gap rather than researching the entire adjacent domain. Inspect enough methods/evidence to support the claim, preserve contrary findings, and stop once the requested decision/deliverable is adequately addressed. Do not claim a comprehensive systematic review when only a bounded search was performed.

A later important fact or contradiction can justify reopening research; do not repeat it merely because another expert or model takes over. Retain source/version/applicability and uncertainty so another runtime can reuse the work. Simple lookups need no separate research form or lengthy explanation to the user.

## Coordination and records

The main assistant selects and coordinates effort under docs/core/ORCHESTRATOR.md/docs/core/CONTROL.md. Before deep work, save a compact decision with mode, escalation trigger, concrete unresolved question/conflict, source references, scope, and stop condition in the existing request artifact or evolve/ iteration record. templates/research-decision.json is optional scaffolding for this deep decision. Domain experts remain read-only: return the need/reason and evidence for the coordinator to persist and route.

For a panel, share existing evidence and assign only distinct necessary questions. Coordinate one reusable investigation for a shared gap instead of having every expert independently repeat broad searches. Independent assessment/review can still use the same evidence; independence of role judgment does not require duplicating collection work. If escalation fits the existing authorized scope, proceed without an extra permission step introduced by this policy.

Critic review and research depth are separate. A required review can verify records, arithmetic, source passages and applicability locally or through focused browsing. The existence of a review gate does not force deep mode or waive the gate. Escalate a specific unresolved major issue when it meets the conditions above, preserving blocked/provisional outcomes where necessary.

For system iteration, research-before-redesign means checking existing lineage/reports and relevant implementations/methods to the depth needed. A routine known fix or explicit policy edit does not require a new multi-project survey, a repository popularity inventory, or a paper review. Major unresolved design questions can meet hard_question. Keep all iteration research/drafts under evolve/ and preserve original source prompts.

## Public implementations before agent introductions

Before the first introduction of a next not-yet-reviewed role, creating a role or substantially redesigning one, the evolver checks existing lineage/reports for usable public agents, skills, prompts, implementations and published methods. Reuse adequately verified sources; fill missing or outdated evidence with focused public lookup, including Chinese terms when appropriate. An ordinary follow-up explanation can reuse the completed check.

Record the primary links, artifact type, inspected scope, license status when relevant, reusable behavior and adaptation limits under evolve/. Distinguish an actual agent/skill from a framework, dataset, benchmark, paper or closed product. If none fits or verification is unavailable, preserve that result rather than inventing a match. Do not require every role to find a paper or collect a large project catalog.

An introduction explains public analogues and the current role's actual logic separately from proposed adaptations. Report researched, drafted, implemented and verified as different states; a saved draft or downloaded prompt is not an applied change. Role research remains lightweight-first and does not waive source checks or authorize an unrelated redesign.

## Implementation boundary

This is a model-neutral MD/JSON procedure. It neither configures a provider/API nor automatically detects question difficulty, meters calls, blocks operating-system tools, or executes a search. Runtimes must load the shared instructions and apply them. The layout checker validates the shared entry point/default/reason policy; actual effort routing remains coordinator/model judgment.
