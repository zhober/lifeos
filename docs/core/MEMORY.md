# Long-term memory contract

LifeOS retains original information in files for use over years and across models. Memory retention and context selection are separate: a fact can remain stored permanently without being loaded into every conversation.

Before retrieval or using an existing value, apply config/CONFIGURATION.md's Voluntary disclosure and privacy policy. Scope/field restrictions cover all domains, roles, synonyms and source forms; an old recorded value or a raw search hit does not authorize reconstructing information the user currently withholds. Retrieve only permitted relevant excerpts. Persistent disclosure choices remain in the one configured preference file rather than a second per-expert list. Refusing new input does not itself request deleting retained originals.

## Layers

1. Original evidence: journals, profile history, domain records, inbox originals, request messages, and complete expert artifacts.
2. Immutable memories: `memory/entries/YYYY/<id>.json`, one sourced fact, episode, constraint, preference, method, insight, or hypothesis per entry.
3. Working context: a retrieved view from `node tools/memory.mjs context`, plus the compact profile and relevant source excerpts. This view is reconstructible and is not the only copy of a fact.
4. Personal patterns: `memory/insights.md` and qualified insight entries. The fourteen-day rule applies to pattern evidence, not to storing single events.

Do not delete old entries automatically, remove resolved symptoms from history, or overwrite facts when circumstances change. Create a new entry with `supersedes` for a correction or update; use `related_to` for a documented relationship or explicitly labeled hypothesis. These links do not themselves establish causation.

## Memory entry input

Use `node tools/memory.mjs add <input.json>`. Input fields:

| Field | Meaning |
|---|---|
| operation_id | Stable identifier for this capture; reuse only for identical retries |
| kind | fact, event, constraint, preference, method, insight, or hypothesis |
| domain | A lowercase domain identifier such as health, fitness, study, or career |
| text | The retained statement, in its original or configured interaction language |
| evidence | reported, observed, verified, estimated, or inferred |
| sources | Existing vault-relative files, optionally with an exact source quotation |
| occurred_start / occurred_end | Actual occurrence date or range; null when unknown |
| date_precision | day, month, year, range, or unknown |
| temporal_class | enduring, temporary, or episode |
| valid_from / valid_to | Known applicability interval, independent of retention |
| state | ongoing, resolved, or unknown; do not guess resolution |
| tags / aliases | Retrieval cues and equivalent terms, not new clinical conclusions |
| entities / fact_key | Stable person, project, product, goal, or concept identifiers; an optional key for comparing versions of the same fact |
| supersedes / related_to | Existing memory IDs; originals remain readable |
| evidence_start / evidence_end | Required evidence interval for a personal insight |

Recording time is generated independently. If the user remembers only a month, use its date bounds with month precision, not an invented exact day. If nothing establishes occurrence time, leave it unknown. A symptom mentioned retrospectively is not recorded as having begun today.

## Queries

docs/domains/TRAVEL.md uses shared sourced travel facts/events/preferences with trip/person/place entities and actual occurrence/validity across years. Exact designs, user selection, reported booking, actual visits/cancellations and outcomes remain distinct. Recheck changing location/price/policy sources and privacy before retrieval; an unused itinerary is not a visited place, and a remembered quote is not a current offer. Selected travel memories reference task/source/action artifacts without a second per-expert profile.

```text
node tools/memory.mjs query <terms> --domain health --raw --limit 20
node tools/memory.mjs context --domain health --limit 20
node tools/memory.mjs context --domain health --at 2024-06-01
node tools/memory.mjs query <terms> --entity project:research-paper --raw
node tools/memory.mjs neighbors <memory-id> --depth 2
```

Queries search all retained years by default. Explicit `--from` and `--to` filter by occurrence range. Unknown-date entries are not included in a dated query, so also check an unfiltered query when dates are incomplete.

The output reports total hits, whether more pages exist, and the next offset. Use `--offset` for hit pages or context historical/upcoming events, unresolved hypotheses and expired constraints; use `--facts-offset` for current facts. The context's `--at` means applicability at that date, not the date the assistant first learned a fact. Query results preserve superseded records and flag them; current facts omit applicable superseded versions, expired constraints, episodes, estimates, and hypotheses.

`unresolved_hypotheses` and `expired_constraints` each use `--limit` (default 20, range 1–1000) and the shared `--offset` (nonnegative integer). Each category always reports `<category>_total`, `_count` (returned entries), `_offset`, `_limit`, `_has_more` and `next_<category>_offset`. To continue a category, pass its non-null next offset to `--offset`, keeping the same date, domain/entity filters and limit; accumulate that category's pages until its next offset is null. The shared offset also moves the other context categories except current facts. An empty page with a positive total does not mean records are absent. Paging does not change retained records.

Events after the selected date are listed separately as upcoming_events, not mixed into historical_events. This is a date-relative classification: when reconstructing a past date, an event that happened later may be upcoming relative to that date even if it is now in the past. Unknown occurrence dates remain explicitly unknown.

Raw fallback searches text-readable profile, journal, domain, inbox, advice, review, and legacy-insight files. It also searches original task requests, saved conversation messages, and text response artifacts, including those retained after a cancellation. Derived retrieval packets and internal task control records are excluded to avoid treating repeated tool metadata as new evidence. Raw hits are unclassified pointers, not verified structured facts; task artifacts may contain questions, hypothetical examples, or model assessments. Read the source. Binary PDF and image contents need text extraction or a sourced memory entry before keyword search can find their contents.

This implementation uses local keyword segmentation and aliases, not embeddings or a model API. Expand queries with synonyms, inspect the domain timeline, and follow source references. A missing lexical match cannot establish absence of a symptom or relationship. Optional semantic indexes may be added later as disposable views without replacing these files.

## Domain-independent retrieval

Health versions under records/health/entries/ and exchanges under records/cases/ are original domain/process data. Use health-record:<id> and case:<id> entities in selected memories, preserving source paths and supersession. Follow docs/domains/HEALTH.md/docs/core/COLLABORATION.md. Experts reference one authoritative fact; a supported case hypothesis stays inferred. Closing a case does not resolve a symptom or obsolete a constraint. Do not create parallel per-expert personal memory stores.

Fitness observations/plans under records/fitness/ are original domain data under docs/domains/FITNESS.md. Use fitness-record:<id> and case:<id> entities for selected sourced memories, and supersede affected memories when factual corrections matter. Proposed/adopted plans, actual sessions and recovery outcomes remain distinct. A performance delta or subjective proxy does not establish a causal or medical fact.

Apply the same mechanism to every expert and future domain. Domain identifies a subject area; entities identify the particular project, person, product, goal, or concept. Explicit links connect decisions, attempts, outcomes, and corrections. Neighbor traversal follows those recorded links in either direction without inventing relationships.

Shopping versions under records/shopping/entries/ follow docs/domains/SHOPPING.md. Selected memory uses shopping-record:<id>, product/ownership entities, source/time/correction references. Distinguish market observations, community claims, personal experience, recommendations, purchase/use/refund/repair and inferred explanations. A target price or requested refund is not actual savings/payment. Shared files hold channel preferences; do not create marketplace- or model-specific personal stores.

docs/domains/CAREER.md records are original work/project/career evidence. Selected memories use career-record:<id>, project/skill/opportunity entities and source/version links. Keep proposed/accepted design, actual effort, submission, acceptance and outcome distinct; requirement snapshots are not personal abilities. Corrections preserve history and supersede affected selected memories. Do not add another per-expert profile.

Use stable logical domain names; a role identifier is not necessarily a memory domain. Broaden retrieval across domains when a question involves shared facts or when a narrow filter may have missed relevant history. Use the original files and entity links to check the broader results.

docs/domains/FINANCE.md worksheets/originals are sourced financial evidence. Selected permitted entries use finance-record:<id>, person/goal entities, occurrence/validity and exact source/version pointers. Keep economic income/spending, actual cash effect, balances, accepted plans and projections distinct; a calculation or hypothetical sheet cannot become a verified personal payment/asset. Saved disclosure limits apply before retrieval across years. Corrections supersede affected selected memories without deleting originals or creating a per-expert financial profile.

docs/domains/PSYCH.md uses existing original task/journal artifacts and shared memory for emotional episodes, communication preferences, concrete gifts/exchanges, sourced agreements and actual outcomes. Logical psych/relationships domains and stable person/project entities help retrieval; search broader domains when needed. Preserve each person's subject, occurrence, provenance and current validity. Proposed arrangements, simulated messages and guessed motives are not real actions or factual personality profiles. This adds no separate contacts or per-expert personal store.

Examples include a past project decision relevant to today's research, a purchase defect relevant to a future recommendation, an unsuccessful learning method, changing food or communication preferences, and a remote physical symptom. These examples do not restrict the memory schema or retention policy to health.

Multiple applicable assertions sharing a fact_key are reported for comparison rather than silently resolved. Mark old preferences or restrictions with their actual dates; do not erase the earlier state.

## Health as one application

Keep mild, brief, resolved, and remote symptoms as historical episodes. Retrieve old episodes, applicable allergies and restrictions, medications and user-reported clinical findings, relevant examinations, and previous related questions. State occurrence dates, precision, source, whether the observation was reported or inferred, and known resolution.

Use this material as evidence for the existing expert workflow. Do not convert a possible relationship between an old symptom and a present condition into a confirmed diagnosis or causal fact. Hypotheses remain separate and cannot supersede reported or observed facts.

## Portability and ownership

Memory, tasks, action histories, and write snapshots are personal data. Deployment initializes directories but never copies test entries or overwrites existing personal records. All records are readable without the current model; the scripts are convenience tools for retrieval, validation, and safe writes.
