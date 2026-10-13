# Training records, plans, recovery and progression

Use this contract for fitness-coach and directly related recording/import/review work. Follow docs/core/RESEARCH.md's local/lightweight-first rule, shared memory, docs/domains/HEALTH.md for personal health sources, docs/core/COLLABORATION.md for shared questions, docs/core/CONTROL.md for execution, and docs/core/REVIEW.md for material plans. The coach remains read-only. The main assistant records authorized observations and plans; Node utilities validate files and describe quantities. No script determines injury risk or automatically prescribes training.

A simple reported session takes the quick path in `workflows/log/QUICK.md`, which creates the same canonical session record with `recording_complete: false` and unknown intensity. Recovery feedback, plan links, and any interpretation still follow this contract. A `health_refs` entry may be a health record ID or a `records/health/entries/...` path; an ID resolves to that record's current version.

## Start with the actual question

Establish the goal, current training background, available time/equipment, preferences, and applicable restrictions from existing records. Retrieve relevant history across all years: earlier plans, performance, interruptions, unsuccessful methods, and sourced health/nutrition constraints. Check current applicability; an old injury or medication statement is not automatically current. Missing logs do not establish inactivity or nonadherence.

Preserve original reports/exports/media and exact user words before interpretation. Fitness original retention supports ordinary export/media files under inbox/fitness/, but does not parse FIT/GPX/TCX, inspect video/image technique, or validate a watch's accuracy. Actually inspect/convert through the runtime and retain the mapping/source. Pending interpretation remains pending. Do not infer exercise form, clinical injury, calories, or precise exertion from a filename or unavailable video.

Record the actual subject and occurrence day, or leave the day unknown. An assumed capture-day assignment requires an explicit assumption. Capture time is separate. One actual workout has one canonical session ID even if described in text, a screenshot, and a device export. Add sources/revise that session instead of adding copies. Optional source_record_key identifies an exact external source/record pair; different eating/training occurrences remain distinct despite similar text/files. Source matching across different providers still requires coordinator judgment.

## Immutable records

| Kind | Retained meaning |
|---|---|
| sessions | Actual reported completion, explicit recording completeness, session elapsed minutes, optional session RPE, typed activities, working/warmup sets, repetitions/holds, loads and conventions, distance/intensity, notes, exact optional plan link |
| plans | Proposed goal, dated schedule, exercise targets, rest slots, constraints/rationale and review date, with immutable design revisions |
| plan-events | Sourced user acceptance/pause/cancellation/reported completion tied to an exact design path/hash; separate from reviewer approval and actual execution |
| recovery | Before/during/after/follow-up report, explicitly scaled fatigue/soreness/readiness, sleep, notes, session link, and references to authoritative health records |
| assessments | Source-linked performance measurement, explicit units, metric/protocol/equipment keys, known comparison conditions, and actual occurrence day |

Every version has operation_id, explicit subject/title, sources, evidence method reported/measured/estimated, reviewed/pending state and extraction confidence. state active/retracted indicates record validity, not health readiness or plan adoption. Corrections supersede the exact latest file and retain old versions. Identical operation retries return the same original receipt; changed payloads need new operations. Preserve important memories through the existing shared memory utility using fitness-record/case entities and supersession where facts change.

User statements such as not performed are explicit reports for a session/planned occurrence; unknown or absent records are distinct. A later correction of that report uses the same canonical session ID. Unknown quantities stay null. recording_complete describes the reported session, not all activity on that day/week. For resistance work, sets_complete additionally states whether the activity's set list is complete. Interrupted/partial sets and unknown set type/completion remain visible; warmup sets are separate from working sets.

Use exact plan path/slot_id links for actual training; optionally bind actual activities to plan_activity_id. Do not infer a plan link from date or activity similarity. An actual session marked completed does not prove all intended targets were met. Keep deviations/rescheduling and unlinked records visible. A missing scheduled record is missing_record, not a skipped workout. Explicit inconsistent performed/not-performed reports require source-preserving reconciliation.

## Units and descriptive metrics

Accept explicit kg/lb, m/km/mile, and s/min where supported. Do not guess a unit from magnitude or convert an unknown unit. Keep the original quantity and its normalized value. Repetitions state total/per_side and the actual side count where needed. External loads state total/per_implement/assistance. For per_implement, implements means the number of implements engaged in each counted repetition, not the number owned or all limbs over successive sides. When that basis is unclear, keep load/repetitions unquantified rather than double counting.

External volume sums normalized external added load times actual repetitions for recorded working sets. It excludes warmups and does not infer lifted body mass, mechanical work, machine equivalence, assistance-adjusted effective resistance, calories or training benefit. Assistance/bodyweight/unknown load retain their distinct limitations. Compare like exercise variants/equipment/load conventions rather than summing all kilograms into a universal dose. Interrupted repetitions can contribute a known partial quantity while completed working sets are reported separately.

Session RPE must have an explicit supported scale. 0_to_10 and borg_6_to_20 remain distinct; never convert one silently. The optional duration_rpe_units proxy multiplies reported session elapsed minutes by explicitly reported 0_to_10 session RPE. Unavailable/incompatible inputs leave it null. This is a descriptive arbitrary-unit proxy, not calibrated strain, injury prediction, a safe-load threshold or objective measurement. Prefer like-activity, consistent-method personal comparisons and preserve subjective/recording limitations. No acute/chronic ratio or automatic risk zone is computed.

Activity durations, whole-session elapsed time, distance, work-set counts, external volume and subjective proxy remain separate. Activity durations are not added to whole-session time; mixed/circuit timing can overlap. Summary reports totals only over available complete quantities, otherwise null plus known subtotal/count/missingness. It exposes source/estimated limitations and separately usable source-backed session metrics. An incomplete strength list cannot silently become a complete volume total. Available-session statistics are not complete weekly activity or proof a population recommendation was met.

Performance comparison requires the same subject/metric/protocol/equipment, compatible normalized units, reviewed usable non-estimated observations, and explicitly matching conditions. It reports arithmetic change; direction/importance and whether it supports progression require context. No automatic personal-best classification, 1RM, maximum-heart-rate/zone, fitness-age or clinical significance calculation. A numeric change with different conditions/unknown context remains incomparable.

## Plan and adaptation loop

1. Read goals, baseline, sourced constraints, prior actions and dated records. Prioritize health/sleep/recovery under shared rules; a fixed generic exercise amount is not a personalized target for every age or clinical context.
2. Draft a feasible plan with explicit goal, dates, measurable targets, intensity basis, alternatives, and review date. Use applicable current ACSM/NSCA/WHO or other authoritative guidance when needed, with claim/source quality and applicability. Use light verification for routine questions; only hard unresolved questions/material source conflict or explicit user depth justify deeper research.
3. Preserve the proposed design and satisfy triggered review before releasing consequential advice. Record user acceptance separately as a sourced plan-state event on the exact current version. A newer proposed design does not automatically replace an accepted design or reassign old actual sessions. A plan-state report does not satisfy a critic gate or execute an action.
4. Capture actual sessions and recovery; inspect compare-plan for exact linked records, unknowns, date deviations and per-target arithmetic. Read source originals, not only aggregate numbers. Do not interpret the overall session label as complete adherence, or absence as failure.
5. Compare appropriate periods and like performance conditions, with coverage/quality and recovery feedback. Decide whether to retain, adjust, reduce, pause or defer a change using the actual evidence. Avoid mandatory progressions or a fixed weekly increase independent of context. Preserve reasons and changed design versions.
6. Coordinate relevant nutrition/health questions through the shared case rather than making a new medical diagnosis or supplementation plan. New pain/other health observations can be captured under docs/domains/HEALTH.md once and referenced by recovery; keep actual symptoms and explanatory hypotheses distinct. Material conflicts/uncertainty follow review. Significant concern takes priority over routine training experiments.
7. Keep proposals, acceptance, execution and outcomes separate in existing action history. Single important events can enter sourced memory immediately; personal patterns still need longitudinal evidence. Keep past ineffective methods and resolved episodes. Review/due dates are records for future interactions or a runtime scheduler, not autonomous reminders.

## Journal, statistics and shared cases

Use one returned journal projection per dated self session in the existing exercise table. Do not change its headings/columns or raw statements. Corrections update that organized projection and reaggregate affected dates. day.mjs and stats.mjs share the live fitness-day resolver, ignore linked duplicates, and invalidate moved/retracted/missing/other-subject projections before or after first aggregation. Displaced values remain in companion fields and checked-write history.

Bare imported totals and legacy rows remain visible/unverified. Explicit exercise_min_origin independent preserves a separately supplied daily total instead of adding it to sessions. Keep original imports and scope; source-reconstruct actual sessions where available. Cached exercise_min fields are displays, not the sole event source. Use fitness.mjs summary for typed metrics and quality/coverage rather than interpreting a generic minutes average as training dose.

Shared cases can reference sessions/plans/recovery/assessments and exact plan-state events. Record supersession, original-source changes, health context corrections, and bound plan-state changes trigger reassessment. Plan source references capture the plan-event sequence even if design bytes remain unchanged. New plans can require reconsidering current advice while historical actual records retain their exact original links. Shared clinical/nutrition facts use one source and existing memory rather than another fitness-only memory database.

## Utilities and limits

```text
node tools/fitness.mjs original <input.json>
node tools/fitness.mjs session|plan|recovery|assessment <input.json>
node tools/fitness.mjs plan-state <input.json>
node tools/fitness.mjs show <id> [--kind sessions|plans|recovery|assessments]
node tools/fitness.mjs timeline [--subject ID --case ID --from DATE --to DATE --history]
node tools/fitness.mjs summary [--days N --from DATE --to DATE --subject ID]
node tools/fitness.mjs compare-plan <exact-plan-path>
node tools/fitness.mjs compare <assessment-id> <assessment-id>
```

Templates: fitness-session.json, fitness-plan.json, fitness-plan-state.json, fitness-recovery.json, fitness-assessment.json and fitness-original.json. Typed records live under records/fitness/; originals under inbox/fitness/. Shared fitness.original_max_bytes limits original byte size, not physiology. Calculators validate representation, source traceability and arithmetic, not movement form, device truth, medical safety or optimal programming. The runtime provides interpretation, actual agent execution and any timer/API capability. Interaction uses the configured language; maintained structured instructions remain English.
