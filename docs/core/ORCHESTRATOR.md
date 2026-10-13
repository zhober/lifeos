# Main assistant control procedure

The main conversation is the coordinator. Apply these controls across all personal-data workflows. Keep these instructions in English and interact in the user's configured language. Determine authorization from the current request and recorded request history. Reuse approval within its defined scope; an earlier system change is not permanent authorization for unrelated work.

Read `docs/core/CONTROL.md` for pause, wait, resume, cancel, replacement, plan revisions, attempt ownership, and qualified completion. User steering changes the active task within its scope; preserve the instruction and select the appropriate control rather than silently continuing the old plan.

## Simple records use the quick path

A simple self-contained record needs no request, plan, step events, critic, expert role, or memory entry. When the user states an ordinary daily observation in plain words and asks for nothing else, read `AGENTS.md` and `workflows/log/QUICK.md` and run:

```text
node tools/quick-log.mjs <input.json> [--dry-run]
```

That one command archives the verbatim statement, writes the canonical meal/fitness/health records through the existing utilities, projects them into the journal, and runs the `day.mjs sum` equivalent. Report its receipt and stop. Do not open a `tasks/` request merely to hold a record that quick-log already completed, and do not add a memory entry unless the user stated a genuinely durable fact, preference, or constraint.

A simple question likewise takes the light path in `workflows/ask/QUICK.md`: a direct answer from the few records it needs, without a request, plan, critic or expert role, and one `tools/advice-note.mjs` command when a personalised recommendation is worth keeping. Its escalation conditions route consequential questions back here.

Use the full procedure below instead when: the user asks for advice, interpretation, a plan, or a comparison; a photo or document needs vision or original-file import; an existing record must be corrected, superseded, or retracted; the work has several steps, waits, external sources, or another role; a concerning health or psychological sign is reported; it is a finance, shopping, travel, or career record; or quick-log rejects the input. Anything quick-log refuses leaves the request open for the full procedure.

## Understand and plan

For all personal inputs/context, apply config/CONFIGURATION.md's Voluntary disclosure and privacy policy before profile/memory/source retrieval or expert questions. Read default/applicable subject preferences through the configured file or tools/privacy.mjs, respecting each actual refusal and scope across roles. Do not use another role, history lookup, review or proxy question to obtain declined information. Select minimal permitted context and filter handoffs/review/new summaries; qualify useful general/anonymous/range/hypothetical help when necessary. A generic privacy feature request is not a personal refusal or selected mode.

Select research effort under docs/core/RESEARCH.md before assigning evidence work: local or lightweight by default, deep only for a concrete hard question/material source conflict or explicit requested depth. In deep mode retain the unresolved question, reason, scope and stop condition in the existing artifact. No extra research form is needed for a simple answer. A missing personal fact needs clarification/qualification rather than a literature search. Panels reuse a shared investigation instead of every role repeating it; review gates do not imply deep research. Existing authorization remains sufficient for justified escalation within its scope.

Distinguish personal records, advice, reviews, imports, profile changes, and system-development requests. One message can contain several intents. Preserve explicit observations first, update durable facts, retrieve context, and only then advise using the updated data. Questions and hypothetical examples are not events that happened to the user.

For a personal-data task, save the exact initial request and a small ordered plan with `node tools/work.mjs start <input.json>`. Provide a stable `operation_id`, `original_input`, `intents`, and unique `steps`. Save the returned request ID and reuse it during continuation. Treat a genuinely new request as new work; do not deduplicate merely because two messages have identical words. A simple record already completed through the quick path above is not a personal-data task for this purpose.

## Dating after midnight

Interpret relative words such as "today", "midday", "this evening", or "last night" from what the user means, not from the calendar day the message was sent. A message sent between 00:00 and 03:59 usually describes the day that just ended. The journal date is the day the events happened; the capture timestamp is preserved separately, and the raw-record line carries the real capture date when it differs from the journal date. Sleep is stored on the waking date. Do not move or backdate an existing record to make the dates agree.

Preserve supplied file/image attachments and reference them through `attachments`. An attachment-only request may have empty original_input with nonempty retained attachments; do not replace it with invented user wording. For meal photos use docs/domains/NUTRITION.md and save the original before starting such a request. Record attachment traces and derived observations separately from verbatim statements.

Save follow-up user statements with `work.mjs message`. Store payloads and returned artifacts under that request's `tasks/YYYY/<request-id>/` directory. A task can have recording, memory capture, historical retrieval, calculation, expert calls, archive, action tracking, and final-response steps as needed. Do not add irrelevant steps.

Steps are sequential by default. Use explicit `depends_on` arrays when independent expert calls may run in parallel; their review and archival steps depend on the relevant outputs. Inspect `ready_steps` and `blocked_steps` before execution. The task utility rejects starting or completing a step whose dependencies are unfinished.

## Capture and classify before advising

Preserve original statements in the journal or request artifact before deriving structured facts. Use exact journal labels from the existing template.

Shopping sources and actual ownership/after-sales statements use docs/domains/SHOPPING.md and shopping.mjs. Preserve one canonical variant/observation, exact price conditions and claim-specific inspected experience evidence. Record user decisions/actions separately from prices and hypotheses. Legacy purchase/wishlist tables remain historical summaries; do not duplicate them as transactions. Accepted watch queues list due rechecks without automatic execution.

Apply docs/domains/SHOPPING.md's account/advisory boundary to all shopping tools and delegates: the user handles login/verification; authenticated research remains scoped. No cart/checkout/order/payment or after-sales action is executed, including through another tool/agent. Record reported transactions without performing them. A final-price gap needing checkout is resolved by user inspection/provided evidence or kept unknown, not by entering a transaction flow.

For work/project/career evidence use docs/domains/CAREER.md and career.mjs. Keep original source bytes and one canonical sourced record, then link it in the work journal. Separate proposed/accepted project design, actual sessions, milestone submissions/acceptance, outcomes and career stages. Legacy work_h is independent from session subtotals. Update affected shared case evidence/selected memories after corrections; an assistant request's completion is not a user's project completion.

For emotional and interpersonal evidence use docs/domains/PSYCH.md. Preserve original conversations and actor/occurrence context, separate proposed wording/gifts/divisions from participant agreement and actual actions/outcomes, and retain a new interaction checkpoint for material continuation. Relevant single events/preferences use shared memory; role interpretations and simulations do not become facts. Product/work evidence continues under its existing contract. This does not authorize contacting others or performing shopping transactions.

For financial evidence use docs/domains/FINANCE.md. Apply disclosure before originals/worksheets; preserve bytes and permitted normalized snapshots through finance.mjs with current source/exposure/version checks. Do not sum overlapping worksheets, turn recurring plans into actuals or infer missing private amounts. Preserve exact financial-calculation artifacts and qualified source/coverage status; track user-reported financial actions without executing them. Shared cases/memory link canonical versions and are reassessed after corrections, retraction or new restrictions.

- Enduring facts and preferences: retain sourced memory entries and update the compact profile when useful.
- Temporary constraints: store known validity dates; do not invent an expiry when it is unknown.
- Events: preserve occurrence dates or explicitly uncertain ranges. Retain significant episodes across domains, such as a project decision, an unsuccessful study method, a product defect, a brief symptom, or an exercise limitation, even if they occurred only once.
- Estimates: label them estimated. Do not turn them into measured observations.
- Explanatory hypotheses: mark them inferred; never present them as a confirmed personal or clinical fact.
- Personal patterns: apply the evidence-span requirement. That requirement does not delay recording a fact or symptom.

Use `tools/memory.mjs add` with a stable operation ID and durable sources. Store both the event's occurrence time and the capture timestamp. A later correction supersedes an older entry by reference without deleting it. Resolution of a symptom does not erase the episode. Do not require the user to repeat a clearly supplied fact or repeat existing authorization.

## Retrieve beyond the recent window

Read `docs/core/MEMORY.md`. Before advice, combine the compact profile, currently applicable constraints, relevant full-history memory, and recent metrics. Fourteen-day statistics are an activity summary, not a memory-retention boundary.

For any question that could depend on earlier events, decisions, preferences, or outcomes, inspect the relevant domain and entity history as well as current facts. Search across all retained years, use synonyms and aliases, follow explicit reference links when useful, and include `--raw` to find old documents that have not been structured. Read the originals of material hits. Follow pagination when necessary; a first page or no keyword match does not prove that no history exists.

Pass dated source references and uncertainty to the selected experts. Retrieved records establish what was reported or observed, not a newly inferred cause. Ask a focused clarification if timing or meaning materially changes the assessment. Do not treat an old condition, preference, constraint, or project state as current without checking validity. In health contexts, a retrieved symptom does not establish a disease or clinical relationship.

## Execute and persist evidence

Use docs/domains/REPORTING.md for requested daily PDFs and after-sleep reporting. A real morning sleep submission and completed input-bound analysis trigger the preceding daytime report with explicitly linked waking-date sleep. Collect minimal permitted data, surface historical action state/current control and stale/pending case follow-ups, preserve JSON/text/PDF/source versions and verify before artifact delivery. No fixed clock task, automatic expert fan-out, invented completion or direct cloud deployment follows from this event.

For travel use docs/domains/TRAVEL.md. Capture originals, exact plan versions, source checks and distinct user selection/reported booking/actual activity/cancellation/outcomes in existing tasks/actions and shared memory. Use travel.mjs check only on permitted normalized inputs; inspect real source freshness, routes, current constraints and exact adoption separately. Preserve accepted/fixed/completed/unaffected portions when revising a disrupted plan and save a new checkpoint. No travel booking, payment, change/cancellation, forms, rental or messaging is authorized by the advice/control workflow.

For ongoing or cross-domain questions use docs/core/COLLABORATION.md. Create/reuse a shared case, link original evidence once, and retain source-bound questions, complete responses, separate inferred claims, and follow-up references. Read case show/queue before reusing an old answer; corrected evidence or stopped/replanned execution requires reassessment. Case state does not override docs/core/CONTROL.md, docs/core/REVIEW.md, or user authorization. Bind a long-lived case to an authorized linked follow-up request when the original request closes.

For health capture use docs/domains/HEALTH.md. Retain original bytes, actual subject/occurrence/units, pending interpretation, and correction versions. Capture selected shared memories from these sources; an attributed report or model hypothesis is not a newly verified diagnosis.

For training use docs/domains/FITNESS.md. Preserve one canonical actual session across duplicate text/device/media sources, exact design/adoption and execution links, recovery and comparable performance. Reaggregate changed/moved/retracted dates through the shared live resolver. Missing planned logs remain unknown. Record sourced memories/actions and route health/nutrition questions through cases; new plans or state/source changes require reassessment without rewriting historical actuals.

Discover experts dynamically. Invoke only the relevant roles, using the established independent-versus-sequential execution convention. Save each complete expert output as a request artifact before composing a final response.

Use docs/core/REVIEW.md for panels and other triggered proposal audits. Keep the critic out of initial domain assessments, supply original and historical evidence, record issue dispositions, and review the exact final synthesis. Declare the essential review_gate as a separate non-waivable read-validation step; material issues need critic confirmation. Save cumulative rounds and preserve a blocked/provisional status when review cannot finish. An audit-only request may complete with an adverse verdict without releasing its supplied plan.

Record step transitions with `tools/work.mjs step`. A succeeded step requires existing artifact references. Record failed steps with the actual error. Never report a script, expert, archive, or file change as successful merely because it was planned.

Declare expert identities, effects, source inputs, waivability, and retry budgets when applicable. Claim asynchronous work before invoking it, retain its attempt ID, and include the current plan revision in callbacks. Use `capture` for stopped or obsolete callbacks; preserve them without advancing current execution. Use evidence-backed waivers only for explicitly eligible steps and report completed_with_gaps accurately.

For a consultation, use `work.mjs archive` with the request ID, a stable archive operation ID, final user-facing response, and paths to the full original expert outputs. Declare expected experts and explicitly list missing experts. A later complete version uses a new archive operation ID; previous partial versions remain intact. The archive saves the exact request, follow-up messages, final response, and verbatim originals.

For reviewed advice, include the passing review_packet and the exact reviewed target text. The archive revalidates file hashes and the completed gate; any text change invalidates the approval. Preserve all review rounds and dispositions. Use provisional archives for partial output and the explicit audit-only mode for a completed critique of an existing plan. Do not turn unresolved reviewed recommendations into proposed actions.

## Track actions separately from advice

Create action definitions with `work.mjs action-create`. Include the source consultation, owner, and deadline when known. A proposal starts as proposed; do not assume it was accepted or completed.

Record status changes with `work.mjs action-update`, citing an explicit user report or supporting record. Distinguish accepted, in progress, completed, deferred, declined, cancelled, and unknown. Record evidence and retain status history. A review reports unknown execution when there is no evidence; lack of a journal is not proof of noncompliance.

## Safe writes and continuation

For existing personal files, read their current hash with `tools/files.mjs read` and submit the exact content with `files.mjs write`. Use a stable operation ID and the expected hash. New files use an expected hash of null. Existing advice and raw journal statements remain protected. The utilities retain before/after snapshots and can recognize a previously committed retry.

The read utility binds the hash and UTF-8 content to one captured byte buffer; it is a snapshot, not proof that the file stays unchanged afterwards. File writers use validated actual targets for path rules and local lock identity, resolving dot segments and in-vault aliases with conservative Windows case folding. Caller paths and input fingerprints remain in history. Do not bypass append-only/immutable rules with a different path spelling. Semantic task/case locks are separate from file-target locks. A successful historical operation replay does not certify the current file hash; reread before preparing a new edit.

On a file conflict, reread and reconcile the latest content rather than forcing an old snapshot. On a partial failure, retain successful artifacts, disclose the missing results, and consult `work.mjs status <request-id>` to resume only unfinished steps. Do not replay successful recording steps. Restore stale local locks only after inspecting their owner and pending operation; do not silently take over an active writer.

Distinguish clarification from a new scope. Save clarifications as messages; revise the plan with a reason and expected revision when execution must change. A new goal replaces an unfinished request through the parent/child handshake. A new goal after closure is a follow-up. Cancel only the requested scope, keep prior evidence, and do not treat cancellation as data erasure or automatic withdrawal of earlier actions.

These checks protect cooperating local processes. Cloud synchronization is not a distributed lock or automatic merge system. When divergent edits are visible, preserve both versions and reconcile them explicitly.

## Respond

Give the user a concise distinction between saved observations, retrieved facts, assessments, actions, and unresolved information. Provide relevant paths. A task is complete only when required steps have succeeded with artifacts; keep partial or failed work visible rather than losing it when the model or session changes.
