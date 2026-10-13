# Shared problems and expert exchange

Use this generic contract when multiple experts need the same records, one expert needs another's assessment, a question persists across conversations, or new evidence affects an earlier conclusion. Keep personal evidence authoritative in its original record; cases retain links, questions, verbatim responses, assessments, and follow-up history. Any runtime/model can read these JSON files. This utility does not invoke agents or implement a provider/network protocol.

The main assistant creates/mutates cases and routes work. Experts remain read-only and return suggested questions/claims with sources. Discover enabled roles dynamically; the critic stays outside initial domain participants and reviews the resulting proposal under docs/core/REVIEW.md. Preserve independently generated role outputs when supported; disclose sequential execution otherwise.

## Files and meaning

- records/cases/YYYY/<case-id>/definition.json: immutable title, explicit subject, domains, initial lead/participants, provenance, and optional execution request ID.
- events/*.json: immutable numbered events for evidence, questions, responses, claims, follow-ups, state, execution binding, and participant revisions. Retain every superseded event.
- Health/nutrition/journal/inbox/memory source files: authoritative personal evidence. A case evidence event references the original rather than copying its fact into another expert's store.
- experts/shared/knowledge.md: shared external reference pointers with titles, URLs, levels, applicability and lookup dates. An expert may keep domain-specific notes linking that same source. Personal observations belong in records/memory.

A case is a question/problem container, not a diagnosis or a task's execution state. It may address health/nutrition, recovery/training, shopping/budget, or a future domain. Choose a consistent subject and source-supported grouping; unrelated occurrences need their own records/cases. Case IDs and health-record IDs can be stable entities in the existing memory store.

## Coordinator procedure

Apply config/CONFIGURATION.md's Voluntary disclosure and privacy policy to all personal subject scopes before questions, evidence selection or handoffs. Experts share only necessary permitted context; adding a participant, alternate role or follow-up cannot recover a declined value or convert a simulation/inference into personal fact. Declared gaps remain gaps, with qualified help rather than pressure to supply private details.

1. Capture original input and relevant records before advising. Start/resume the execution request under docs/core/ORCHESTRATOR.md and docs/core/CONTROL.md. Create or retrieve the shared case, with one lead and the required supporting roles.
2. Add evidence with exact source references and an explanation of relevance. Preserve known uncertainty, unknown dates, estimates, source report flags, and contrary evidence. Replacing evidence supersedes its current event and references the corrected source. Health evidence must describe the case's subject.
3. Ask a specific source-linked question from the initiating expert/main assistant to the appropriate participant. Capture the question ID, exact file hash, context revision, and execution plan revision. Multiple initial questions may be independent; outputs alone do not change the evidence revision. A new evidence/participant/state/binding event does.
4. Return the recipient's exact response, outcome assessed/needs_input/unavailable, and durable sources. Bind the exact question hash/context. An assessed response is an expert assessment, not a verification gate or established personal fact.
5. Keep separate hypothesis/assessment claims with author, topic_key, proposed/supported/refuted/withdrawn status, supporting sources and contrary sources. Corrections preserve the author and supersede the exact current claim. Another expert writes another claim. A supported hypothesis remains inferred; factual/clinical verification needs its own original record. Never count copied sources or expert agreement as multiple independent observations.
   When evidence from several sources is combined, attach the source-linked synthesis under experts/_common.md and templates/evidence-synthesis.json. Explain original-study independence/overlap, applicability, agreement and contradiction, and any provisional confidence change. A synthesis can strengthen an assessment without promoting the case hypothesis into a verified personal fact.
6. Review conflicting or consequential synthesis under docs/core/REVIEW.md and preserve the exact final proposal. A case response/claim/follow-up cannot bypass a task review gate, authorize a new action, or complete a task step. Use existing work actions for proposal/acceptance/execution; source-linked case follow-ups only track questions, monitoring dates and reported outcomes.
7. Save the final synthesis and complete expert originals through the existing consultation archive. Capture selected facts/hypotheses with appropriate shared memory classification and links. Query case queue on future relevant interactions/reviews; changed evidence may require new questions, not silent reuse of an old answer.

## Freshness, continuation, and limits

Every mutation except a response binds expected_revision from case show. Identical operation retries return the original receipt; changed payloads need a new operation ID. Replies bind the question's context_revision and question_sha256. Correct a response by superseding its latest event. An older question superseded by a new round cannot become current again through a late reply.

Sources retain capture hashes. Missing/changed source bytes and superseded/retracted health or canonical nutrition records invalidate current use, even when an old immutable file still exists. Old health originals are also checked through their captured records. Response-specific evidence changes require reassessment. Pending/uncertain extracted health data can be discussed for clarification, retaining its limitations; it does not become a reliable measurement because an expert read it.

Late responses after closure, a stopped execution request, a context change, a plan revision, or a source change are preserved with accepted false and stale reasons. Missing/changed submitted reply sources are retained as uninterpreted provenance with the old question references rather than hiding the reply text. A malformed binding/role is rejected. Case show/queue identifies unanswered, needs-input, stale questions/claims/evidence, unavailable roles, and due follow-ups. These are read-only signals; no background polling, model call, or message to another person occurs.

Question threads normally allow three rounds under project.json collaboration.max_question_rounds, independently of final critic review rounds. A follow-up question supersedes the current question in that thread. Preserve gaps on exhaustion; do not evade the limit by inventing a new thread for the same unanswered question. A materially new authorized scope or new evidence can be documented and linked as distinct follow-up work.

Current memory pointers also require reassessment when an applicable sourced memory supersedes them. Subject checks apply to linked health evidence in questions/claims as well as evidence events; a reply using another person's health record is retained with accepted false. Preserve the original subject and relationship explicitly rather than merging people through a shared topic.

Fitness evidence follows docs/domains/FITNESS.md: source/version/subject checks apply to sessions, recovery, assessments and plans. Plan references also bind the current plan-state sequence; a changed adoption/pause event can invalidate a current answer even if design bytes are unchanged. Historical actuals keep their original plan links. Revised health context or fitness observations require reassessment, not a new inferred diagnosis or retrospective rewrite.

Case states are open, monitoring, and closed. Closing marks coordination finished and retains pending/stale work visibly; it does not assert clinical recovery, erase history, confirm a cause, or stop a runtime process. Reopening needs a sourced state transition. Follow-up due dates can be unknown; lack of a reported completion is not proof the action was not performed. A completed question or case is not proof the underlying user problem resolved.

Career evidence follows docs/domains/CAREER.md. Source/record corrections or retractions require reassessment; project references bind the current adoption/state fingerprint. Changed state evidence can invalidate a current assessment without changing design bytes. Actual historical work keeps its exact plan link; external opportunity snapshots remain attributed external facts, not the user's skills or guaranteed live openings. The main assistant adds new material evidence and routes learning/work/health questions under the same case protocol.

Shopping evidence follows docs/domains/SHOPPING.md. Exact product/offer/quality/ownership/watch versions and original-source changes require reassessment. Product/community material is external evidence; personal ownership/buyer eligibility keeps its explicit subject. A marketplace review is not a personal health fact. New applicable prices or material experience findings are added by the main assistant; copied sources and expert agreement are not independent confirmation.

If linked to an execution request, paused/waiting/closed/replaced tasks prevent dispatch under docs/core/CONTROL.md. Reusing a long-lived case in another conversation uses bind to an active linked follow_up request after the old request closes, or its activated replacement. Rebinding cannot bypass an active/paused request. Case state and task state remain separate. A participant revision can add a newly installed expert, retaining prior assignments and invalidating the old context; it does not redesign that expert.

## Commands and templates

Finance evidence follows docs/domains/FINANCE.md. The coordinator supplies only allowed exact worksheet versions; financial exposure is checked before body/hash access in source inspection. Changed/superseded/retracted/withheld sources require reassessment and cannot be silently replaced by an older permitted version. Keep the financial subject and personal/example basis explicit; hypothetical worksheets support scenarios, not verification of personal wealth or payment. A completed calculation/case does not execute an account action.

Travel evidence follows docs/domains/TRAVEL.md: permitted exact design/selection/source pointers, supplied time/cost check limits and separate reported booking/actual activity/outcome evidence. Main assistant inspects linked source freshness, changed commitments and affected dependencies before reusing an assessment; current generic cases do not automatically resolve travel adoption or nested source applicability. Route only distinct financial, health/fitness, dietary, equipment or companion questions. Expert consensus does not confirm navigation, eligibility or inventory; it never authorizes a reservation/payment/change/cancellation.

```text
node tools/cases.mjs create <input.json>
node tools/cases.mjs evidence|question|response|claim|followup|state|bind|participants <input.json>
node tools/cases.mjs show <case-id> [--at DATE]
node tools/cases.mjs list
node tools/cases.mjs queue [--at DATE]
```

Use templates/case.json and templates/case-events.json. The latter is a catalog of payload shapes; pass one selected payload to the command. Source paths are vault-relative. Question/response events preserve role authorship while coordinator performs the actual write. General fields do not depend on a health-specific topic or model API.
