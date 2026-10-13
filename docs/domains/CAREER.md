# Work, projects and career development

Use this contract with experts/_common.md, docs/core/ORCHESTRATOR.md, docs/core/MEMORY.md, docs/core/CONTROL.md, docs/core/REVIEW.md, docs/core/COLLABORATION.md and docs/core/RESEARCH.md. The main assistant records/routes work; career-coach interprets evidence and proposes actions; tools perform validation and descriptive arithmetic. Models and providers are replaceable.

## Scope and modes

Use the narrowest relevant mode. Work/research/projects remain in scope regardless of whether the user is seeking employment.

1. Work/project review: objective, expected output/quality, milestone/dependency, adopted design, actual work and feedback → identify a primary bottleneck and a bounded next step.
2. Direction comparison: clarify goals and hard/soft constraints, compare at most a few plausible directions using dated regional/level-specific evidence and uncertainty, then propose a reversible information-gathering or proof-building step. User priorities control the tradeoff; no guaranteed outcome or personality-based destiny.
3. Skill/proof gap: map source requirements to demonstrated ability, actual artifacts, recency and feedback. Separate knowledge, execution, proof, visibility, recency, access and formal gates. Reuse evidence or small practical work before automatically prescribing a course. study-coach handles learning through the main assistant in the necessary planning/resource/teaching/review modes.
4. Search/material review: retain the posting and location/date, map truthful experience/evidence to its requirements, inspect actual application-stage records and versions. A prepared resume/application is not a sent application; no response remains unknown. Do not recommend volume before understanding the stalled stage.
5. Interview practice: use a role-relevant question, preserve the real answer, distinguish assistance and hypothetical examples from claimed experience, return specific feedback and another bounded attempt. A practice assessment is not evidence of employer acceptance.
6. Performance/advancement: clarify stakeholder expectations, collect actual delivered work, attribution, constraints and feedback; separate effort, output, quality, acceptance, impact and visibility. Prepare a communication or evidence artifact when useful without inventing results.

Reuse profile/goals and relevant all-year memories/actions before questioning. Ask at most two decisive intake questions at once and allow unknowns. Establish why a new goal matters and which actions are acceptable using shared rules. Do not treat missing logs, exploratory research, external waiting or a changed priority as misconduct.

## Source and action rules

Use retained suitable evidence or focused verification first; deep research needs docs/core/RESEARCH.md's concrete trigger. Verify changing postings, pay/industry claims, credential gates and material uncertainties at their primary source when possible. Record lookup date, region, level, sample scope and limitations. Chinese interaction does not establish jurisdiction; foreign source examples do not automatically apply locally.

Separate source authority, applicability and the strength of the specific claim. Copied postings/links or expert agreement are not independent evidence. Small samples and subjective scorecards do not support employability percentages, hiring odds or causal efficiency claims.

External sending/submission/publication requires explicit user instruction and main-assistant/runtime execution; this role stays read-only. Preserve truthful credentials and work attribution. Important decisions/conflicts use existing docs/core/REVIEW.md triggers; ordinary recording/description remains lightweight.

## Records and originals

Store original supplied documents, screenshots, exports or source/code samples through `career.mjs original`, preserving bytes/hash under inbox/career/. Retention does not parse, execute or verify them. Extracted text/observations need runtime reading and must cite the original. Keep user words and originals in their source language.

Use templates/career-record.json plus the relevant shape in templates/career-details.json and `career.mjs record`. Every record declares subject, occurrence bounds/precision, evidence class, review/extraction status, sources and state. Capture time does not establish occurrence; unknown dates/quantities remain null. Optional occurred_at requires an explicit ISO timezone and the matching local occurrence date; never derive it from capture time without reported timing.

| Kind | Meaning | Required distinction |
|---|---|---|
| project | Versioned objective, milestones, criteria, due dates and within-project dependencies | Design is proposed until separately accepted; dependencies must exist and be acyclic |
| project_state | Exact-design acceptance/pause/resume/cancel/completion report with reason | Only sourced reports; reported completion is not automatic verification |
| work_session | One actual activity with optional exact project/slot and explicit duration | Active work, elapsed session and unspecified bases; measured/reported/estimated quality |
| milestone | Exact-design/slot observation | Not started, in progress, blocked, submitted, accepted, reported complete, cancelled or unknown; acceptance has an attributed stakeholder |
| evidence | Actual deliverable, feedback, skill proof, assessment or result | Original provenance, role/author, optional explicit-unit/protocol metrics; feedback is not guaranteed impact |
| opportunity | Dated job/academic/project/freelance snapshot and requirements | Known versus uncertain region/access/compensation; snapshot is not a live availability promise |
| career_event | One stable target/process and a proposed or observed stage | Planned/prepared/contacted/submitted/interview/offer/accepted/declined/rejected/withdrawn/completed/unknown; actual and proposal remain separate |

Project details require objective and milestones (empty is allowed before a plan is known). Each milestone has a stable id, title, observable acceptance_criteria, optional due_on, depends_on IDs and optional estimated planned_duration. Dependencies are within the exact project version; external blockers use attributed descriptions/shared cases rather than fabricated edges.

work_session duration is `{value, unit, basis, quality}`. Supported explicit units are min/h; bases are active/elapsed/unspecified and qualities measured/reported/estimated. Null values remain unknown. Do not infer active time from a calendar block, message count or a recommended schedule.

Evidence metrics are `{name, value, unit, protocol}` with numeric/unknown values. Protocol/context and comparable source evidence matter; the script does not assess quality or causal benefit. Feedback requires an attributed author; model hypotheses belong in shared inferred assessments/cases, not actual evidence records.

Opportunity requirements are `{id, text, category, skills}`; category is required/preferred/gate/uncertain. Retain checked_on, source_url, organization, region and deadline when known; compensation_text preserves original scope without inventing currency or frequency. Ability/proof mapping is a sourced expert assessment, not an automatic numeric match score.

Career events declare process_id, mode, statement_type (plan/observation), stage, description and optional opportunity_ref. Modes: job_search/interview_practice/performance/promotion/transition/freelance. One subject/process cannot silently change mode or target opportunity. Different applications/attempts use distinct process IDs; unknown target links may be filled when sourced. Events are histories, not one mutable stage flag.

## Identity and correction

Keep one canonical record ID per actual session/statement. Additional screenshots/export views or corrected amounts revise that record; distinct occurrences are separate records. An exact provider/record_key can detect duplicates within declared kind/subject/provider; cross-provider or text matching still requires coordinator judgment.

Record versions are immutable under records/career/entries/. Corrections supply record_id and supersedes equal to its exact latest file; old versions remain. Subject/kind changes require retracting the misassigned record and creating another. Retraction keeps history. Stable operation IDs make identical retries idempotent; changed input with the same ID is rejected. Do not overwrite these records/originals through files.mjs.

Link milestone, state and attributed project evidence to the exact project_ref, never just a matching date/title. Later proposal versions do not relink earlier observations. Inferred proposals cannot become adoption, performed work, proof or application history. Generic task completion describes the assistant's processing, not the user's project completion.

## Retrieval and descriptive reports

```text
node tools/career.mjs original <input.json>
node tools/career.mjs record <input.json>
node tools/career.mjs show <record-id>
node tools/career.mjs timeline --subject self --from YYYY-MM-DD --to YYYY-MM-DD
node tools/career.mjs timeline --history
node tools/career.mjs project <project-id-or-exact-path> --as-of YYYY-MM-DD
node tools/career.mjs summary --days 14 --subject self
node tools/career.mjs summary --project <exact-project-path> --from YYYY-MM-DD --to YYYY-MM-DD
```

Timeline reads all retained years when requested and separates unknown dates. Summary defaults to the last 14 days and subject self; explicit windows/subjects override it. Source quality, corrections/retractions and exact reference gaps remain visible. A short statistics window does not limit retention.

Duration totals use only usable exact-day known non-estimated records within the selected window. Keep active/elapsed/unspecified groups separate; report known subtotal, known record count, gaps and estimates separately. A complete total requires no gaps for that group. No records means unknown total, not zero work. Counts of artifacts/statuses are descriptive, not output quality or personal value.

Project view presents latest proposed design separately from the latest evidenced accepted design and its state. New proposals do not automatically become active. Same-day status conflicts remain unresolved unless all competing observations have explicit occurrence timestamps; capture order is not event order. Unknown dates/source quality can prevent an automatic current status. Milestone due dates without completion evidence are uncertain overdue status, not proven noncompliance.

Submitted, accepted and reported complete stay distinct. Planned criteria/dependencies and actual reports are shown together; missing evidence cannot establish fulfillment. The model interprets deviations and source reports rather than deriving completion from hours or other milestones.

Career processes use all retained dated observations up to the selected end date to explain the stages of processes represented in the window. Later events are not projected backward; proposals and unknown ordering remain visible. A missing stage is unknown; no response is not a rejection and no count is a hiring probability.

## Integration, memory and follow-up

The main assistant records a source-linked work note in the existing journal work section, preserving raw statements. Link career-record:<id> and exact record path when applicable. Legacy work_h stays separate; do not add it to canonical sessions or replace it with incomplete session subtotals. No new automatic whole-day work coverage/cache is implemented.

Retrieve relevant long-term project decisions, role requirements, past methods and feedback through shared docs/core/MEMORY.md. Selected single episodes may be retained immediately; stable patterns need the shared evidence-span criteria. Keep proposals, acceptance, actual work and outcome separate in actions/; a new goal/milestone does not silently alter accepted actions.

Use shared cases for learning/health/work constraints and scoped expert questions. Corrected/retracted career sources and changed project-state context make related case inputs require reassessment. New material evidence should be added through the main assistant; queue flags do not invoke experts or resume paused tasks.

Normally return one primary bottleneck, supporting uncertainty, and up to three practical actions with output/definition of done, time budget, feedback/review condition and a smaller alternative if useful. Review actual feedback before repeating or intensifying a method. Stored dates do not send reminders; timers, parsers and model/external calls remain runtime capabilities.
