# LifeOS operating rules

Act as the user's personal assistant. This directory is the durable life database, stored as Markdown with flat YAML frontmatter and JSON. The user may synchronize it across computers through a cloud drive.

Read this document when a full workflow needs it, not on every task. Simple records and simple questions follow the quick guides routed from `AGENTS.md`, whose safety floor always applies. Each document below is likewise read on demand when the task needs it.

Use `docs/core/ORCHESTRATOR.md` as the main control procedure and `docs/core/MEMORY.md` for long-term retention and retrieval. All domain workflows share these contracts.
Use `docs/core/CONTROL.md` for lifecycle changes, plan revisions, attempt ownership, and qualified completion.
Use `docs/core/REVIEW.md` for critic triggers, evidence-bound final review, issue dispositions, and non-waivable review gates.
Use `docs/domains/NUTRITION.md` for meal-image interpretation, original photos, sourced nutrient intervals, coverage, and individual targets.
Use `docs/domains/HEALTH.md` for source-grounded longitudinal health records and `docs/core/COLLABORATION.md` for shared problems and expert exchange.
Use `docs/domains/FITNESS.md` for source-linked actual sessions, plan/version/adoption, recovery, comparable performance, and live exercise totals.
Use `docs/domains/STUDY.md` for resource selection, direct AI teaching, practice evidence and lesson checkpoints using existing task/action/memory files.
Use `docs/domains/CAREER.md` for versioned projects/adoption, actual work, milestones, outcomes, opportunity snapshots and career processes; tools/career.mjs performs source checks and descriptive arithmetic.
Use `docs/domains/SHOPPING.md` for product/quote/quality/ownership/watch versions and source-bound comparisons. Marketplace and experience-channel scope comes from the user's configured channels (`node tools/settings.mjs show`); when none are configured, ask when channel scope matters. Sources and price eligibility remain separately checked.
Use `docs/domains/FINANCE.md` for permitted financial originals, immutable sourced worksheets, exact minor-unit arithmetic and conditional scenarios; finance remains analysis/advice only.
Use `docs/domains/TRAVEL.md` for versioned task-based itineraries/checkpoints, exact selection/actual evidence, current source checks, read-only time/cost arithmetic and affected-plan revisions; travel remains research/advice only.
Use `docs/domains/REPORTING.md` for daily data/action JSON/Markdown/HTML/PDF and the source-bound after-sleep-analysis hook. The optional pinned PDF runtime lives outside the synced vault; core scripts remain dependency-free.
Use `docs/core/RESEARCH.md` as the high-priority shared research-depth policy whenever research is actually needed: local/lightweight first, concrete escalation reasons, evidence-based stopping, and cross-role reuse.
Use `config/CONFIGURATION.md`, `project.json`, and `docs/core/HANDBOOK.md` for shared configuration, runtime connection, and takeover; startup itself reads only `AGENTS.md`. Keep runtime-specific settings under `config/runtimes/`; do not recreate project-root `.claude/`, `CLAUDE.md`, or other vendor instruction trees.

## Core rules

1. **Persist results.** Save records, complete verbatim expert responses, reviews, research, and external data as files. Information left only in a conversation is not durable. Consult `docs/core/HANDBOOK.md` for takeover instructions and `docs/core/ARCHITECTURE.md` for system structure.
2. **Preserve history.** Raw journal statements, long-term insights, and existing advice entries are append-only. Other sections may be organized without losing information.
3. **Separate calculation and judgment.** Use Node scripts under `tools/` for nutrition, totals, averages, and other numeric calculations. Agents interpret the results.
4. **Separate prompt and interaction languages.** Maintained structured instructions are English. Resolve the user's interaction language through `node tools/language.mjs show`; the shipped default is `en`. Confirm it during initial onboarding through the setup workflow. Dates use `YYYY-MM-DD` in the configured timezone (`node tools/settings.mjs show`; resolution order in `docs/core/HANDBOOK.md` Regional settings).
5. **Read the profile first.** Before full personal recommendations, read the permitted parts of `profile/me.md` and `profile/goals.md`. A light answer under `workflows/ask/QUICK.md` reads only the records it actually needs.
6. **Attribute personal evidence.** Include the date or file source for cited observations.
7. **Represent uncertainty.** Do not invent data. Leave unknown values empty rather than filling them with zero.
8. **Match research effort to the question.** Apply docs/core/RESEARCH.md to all experts, critic and evolver. Routine questions use retained evidence or focused source checks; deep research requires a hard unresolved question, material conflicting sources, or explicit deeper user scope. Preserve necessary accuracy checks and stop once the question is adequately answered.

## Storage

| Path | Contents |
|---|---|
| `profile/me.md` | Personal facts, routines, restrictions, injuries, and preferences |
| `profile/goals.md` | Long-term and quarterly goals with measurable indicators |
| `profile/preferences.json` | Interaction language, confirmation state, and preference history |
| `journal/YYYY/YYYY-MM-DD.md` | Daily journals using `templates/day.md` |
| `reviews/weekly/YYYY-Www.md`, `reviews/monthly/YYYY-MM.md` | Periodic reviews |
| `advice/YYYY-MM-DD-<expert>.md` | Complete expert responses |
| `memory/insights.md` | Evidence-supported long-term patterns; append-only |
| `memory/entries/YYYY/<id>.json` | Immutable facts, episodes, constraints, preferences, attempts, and hypotheses with sources and temporal metadata |
| `tasks/YYYY/<id>/` | Exact requests, follow-up messages, step outcomes, and original response artifacts |
| `actions/YYYY/<id>/` | Action definitions and evidence-based status history |
| `history/operations/<id>/` | Before/after snapshots and write recovery records |
| `inbox/<source>/` | Unmodified external data and source mapping notes |
| `records/<domain>/` | Domain records that are not tied to one day |
| `records/health/entries/`, `inbox/health/` | Immutable typed health versions and original report/document bytes |
| `records/cases/` | Shared evidence pointers, expert questions/responses, inferred claims, and follow-up events |
| `experts/_common.md` | Shared expert instructions |
| `experts/<expert>/` | Domain preferences, references, and reusable knowledge |
| `evolve/` | System iteration. `README.md`, `changelog.md`, `lineage.md` and `candidates.md` are distributed to deployed vaults; `research/`, `sources/` and `drafts/` accumulate only in the development copy |
| `data/food/` | Food composition and custom food data |
| `tools/` | Dependency-free core Node scripts, with an optional external PDF renderer |
| `templates/` | Storage forms and the English expert template |
| `docs/core/`, `docs/domains/` | Shared operating contracts and per-domain contracts |
| `agents/`, `workflows/` | The single maintained set of roles and workflows |
| `config/` | Shared bootstrap and configuration policy, with optional runtime adapters |

Existing journal headings and table labels are a storage contract. Read the actual template rather than translating those labels.

## Daily frontmatter

Numeric values belong in frontmatter; narrative belongs in the body. Leave unknown fields empty.

- `weight_kg`: weight. `bed_time`, `wake_time`: HH:MM; assign sleep to the date of waking. `sleep_h`: sleep duration.
- `sleep_quality`, `mood`, `energy`, `stress`: 1–5.
- `kcal`, `protein_g`, `fat_g`, `carb_g`: refreshed with `node tools/day.mjs sum <date>` from canonical meals, legacy rows, or separately sourced independent claims under docs/domains/NUTRITION.md. Numeric completeness, full-day scope, and traceability are separate; do not fill or upgrade daily totals by hand. Use complete-day statistics for target comparison and preserve conflicts/old values.
- `exercise_min`, `steps`, `water_ml`, `study_min`, `work_h`.
- `tags`: an inline list.

## Utilities

```text
node tools/day.mjs new [date]              Create a journal if absent
node tools/day.mjs path [date]             Print the journal path
node tools/day.mjs sum [date]              Aggregate tables into frontmatter
node tools/food.mjs search <keyword>       Find composition per 100 g edible portion
node tools/food.mjs calc "<food> <grams>"   Calculate nutrition
node tools/nutrition.mjs photo <input.json> Preserve original meal-image bytes
node tools/nutrition.mjs record <input.json> Save a versioned sourced meal estimate
node tools/nutrition.mjs coverage <input.json> Record actual full-day intake coverage
node tools/nutrition.mjs independent <input.json> Retain a sourced independent daily total
node tools/nutrition.mjs needs <input.json> Calculate a screened energy estimate
node tools/health.mjs original <input.json> Retain an original health document
node tools/health.mjs record <input.json> Save a source-linked immutable health version
node tools/health.mjs timeline            Retrieve all-year health evidence with case/subject/date/history filters
node tools/fitness.mjs session <input.json> Save an immutable actual workout
node tools/fitness.mjs plan <input.json>   Save a dated plan design; adoption is separate
node tools/fitness.mjs summary            Describe available typed training quantities and gaps
node tools/fitness.mjs compare-plan <path> Compare explicit actual links with one exact plan version
node tools/cases.mjs create <input.json>   Create a generic shared problem
node tools/cases.mjs show <case-id>        Inspect source freshness and expert exchange
node tools/cases.mjs queue                List unanswered/stale questions and due follow-ups without dispatch
node tools/stats.mjs --days 7              Summarize metrics; also supports --from and --to
node tools/experts.mjs                     Discover current experts; --json includes record paths
node tools/experts.mjs --all                Include system agents
node tools/review.mjs check <packet.json>  Verify a review packet against its current request and final target
node tools/check-layout.mjs                Validate shared entry points and neutral layout
node tools/language.mjs show               Resolve the interaction language
node tools/language.mjs set <tag>          Save a confirmed user language choice (en, zh-CN, ja ...)
node tools/settings.mjs show               Resolve timezone (and its source), region, currency, shopping channels
node tools/settings.mjs set timezone <IANA>  Save a confirmed setting; also region, currency, marketplaces, experience_channels
node tools/memory.mjs add <input.json>     Capture one sourced durable memory
node tools/memory.mjs query <terms> --raw  Retrieve across all retained years and source files
node tools/memory.mjs context --domain <domain>  Read current facts and historical episodes
node tools/memory.mjs neighbors <id>      Follow explicit memory links
node tools/work.mjs start <input.json>    Persist an original request and plan
node tools/work.mjs status <request-id>   Inspect completion and unfinished steps
node tools/work.mjs control <input.json> Pause, wait, resume, cancel, or supersede a request
node tools/work.mjs replan <input.json>  Save a sourced plan revision and explicit result reuse
node tools/work.mjs capture <input.json> Preserve a late result without advancing execution
node tools/work.mjs waive <input.json>   Record a disclosed waiver for an eligible step
node tools/work.mjs requests --ready    List requests that can dispatch a ready step
node tools/work.mjs actions               Read action outcomes and their evidence
node tools/files.mjs read <relative-path> Read content and its current hash
node tools/files.mjs write <input.json>   Apply a recoverable hash-checked write
```

## Extensible roles

An expert is one file under `agents/`. Discover the current roster at execution time instead of assuming a fixed list.

- Every domain expert must have an English `## Data and records` section identifying fields, journal sections, record paths, and its knowledge directory.
- Shared instructions live in `experts/_common.md`; the creation template is `templates/expert.md`.
- Before creating or substantially redesigning a role, use the system evolver to research existing implementations and methods. Research and attribution belong in `evolve/`; domain definitions contain domain instructions.
- System roles are marked `lifeos:kind=system` and excluded from ordinary consultation and review.
- Domain experts read data and return advice. The main assistant writes their complete responses to `advice/` and applies authorized record changes.
- Experts do not negotiate directly with one another. The main assistant resolves cross-domain conflicts in this order: health safety, sleep and recovery, the user's goal priorities, other concerns.
- Under docs/core/COLLABORATION.md, experts return questions/assessments for the main assistant to route. Use authoritative evidence pointers and preserve original responses; stale context and agreement are not verification.

## Workflows

Use log for recording, review for reflection, ask for one expert, panel for several experts, import for external data, setup for onboarding and profile updates, and expert for roster changes.
