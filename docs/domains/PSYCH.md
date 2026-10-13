# Psychological support and interpersonal interaction

Use agents/psych-coach.md, experts/_common.md and the shared request/control, memory, collaboration, review and research contracts. psych-coach is the active read-only role for emotional support and everyday interpersonal advice. The main assistant captures evidence, invokes roles and writes records; models/runtimes remain replaceable.

This release provides role procedures and a shared file convention using existing tasks, actions, journals and memory. It does not add a clinical assessment engine, contacts database, psychological/relationship score, model caller, external messaging service or automatic scheduler.

## Mode and routing

| Mode | Use |
|---|---|
| support | Listen, clarify a concern and acknowledge the person's experience |
| reflection | Optional thought records, practical self-help skill practice and inspection of assumptions |
| communication | Natural reply drafts, needs/boundaries/disagreement and clearly labeled rehearsal |
| interaction | Suitable gifts/gestures, cooperation/division of work, invitations, assistance and shared activities |
| review | Examine actual attempts/outcomes and adjust a proportionate next step |

Choose only needed modes through the existing ask workflow; ordinary recording uses log and period reviews use review. A reply or practical gift/coordination question does not require a psychological assessment. Reuse the same objective, participants, sources and latest valid checkpoint across modes. Mode changes are not additional experts or independent evidence.

Reuse context and stated preferences, asking at most two decisive questions at a time. Do not imply that stress, a disagreement, reluctance to cooperate or a communication style establishes a disorder. Offer direct help when sufficient context exists; listen without forcing an activity when that is the request.

## Evidence and interpretation

Preserve exact user statements, supplied conversations and relevant attachments through docs/core/ORCHESTRATOR.md before interpretation. Actually inspect source text/images through available runtime capabilities; a file path is not image understanding. Keep sender/subject identity, actual occurrence time/precision, source origin and inspected scope. Cropped exchanges, paraphrases and uncertain OCR remain limited evidence.

Keep reported/observed events, personal interpretations, self-reported feelings and assistant hypotheses distinct. An alternative explanation is optional and tentative; do not infer another person's motive, diagnosis, personality or willingness from silence or a small excerpt. Simulated conversations, examples and imagined reactions are explicitly hypothetical and never become real messages or personal events. Do not invent user replies, ratings, time spent or improvement.

Preserve supplied scale and question/version when scores are used. Journal mood/stress/energy fields follow docs/core/RULES.md's existing scale; an incompatible supplied score remains in its source artifact until an explicitly supported conversion is available. No diagnosis or relationship-strength metric is derived from a score, completed exercise, thank-you or expert agreement.

## Practical advice and action distinctions

Apply the relevant procedures in agents/psych-coach.md. Give a focused response rather than running every procedure. For a message, ordinarily provide a natural primary draft and a small number of meaningful alternatives. For an interaction, explain the recommended approach, relevant tradeoff and next useful step. Preserve the user's facts/style and leave room to decline, postpone or choose a smaller gesture. Do not create unendorsed promises or make acceptance of a plan an obligation.

For gifts, separate interpersonal suitability/category/scale/timing from shopping-advisor's specific products, current prices, buyer conditions and quality evidence under docs/domains/SHOPPING.md. A proposed gift, user selection, actual purchase, handover/receipt and reported reaction are distinct, with the giver/recipient kept explicit.

For cooperation, separate a proposed division from each participant's reported agreement, actual contributions/handoffs and outcomes. A user accepting their own task does not confirm everybody else's consent. Preserve the scope, source and dates of an agreement and later changes. Formal work/project designs, adoption and outcomes use docs/domains/CAREER.md through career-coach; group learning objectives/practice use docs/domains/STUDY.md through study-coach. Everyday arrangements need no duplicate project database.

For invitations, visits, help and resource sharing, suggested arrangements do not establish attendance, payments, lending/return or commitments. Capture actuals only from supported reports/material. These distinctions are coordinator/model obligations backed by original artifacts, not an automatic semantic classifier.

The role provides advice/drafts/practice. It does not send messages, book activities, transfer resources or accept obligations on behalf of others. Separately requested external actions require explicit authorization under the relevant workflow. docs/domains/SHOPPING.md's purchase/cart/checkout/payment prohibition remains in force for gift shopping across main assistant and delegates.

## Durable capture and checkpoints

1. Preserve exact input/attachments through work.mjs start/message. Retrieve related person/project/goal history, prior attempts, applicable preferences and the latest valid interaction checkpoint. For a closed request, use an authorized linked follow-up; do not silently reopen it.
2. Declare only necessary capture, retrieval, role, archive and checkpoint steps under docs/core/CONTROL.md, with actual effects and inputs. Pass source/participant pointers, known limitations, chosen mode and unfinished activity to psych-coach. Save its full original output as task artifacts/consultation originals before the final response.
3. For a material change or pause/end, create a new interaction-checkpoint-<id>.json from templates/interaction-checkpoint.json under tasks/YYYY/<request-id>/artifacts/. Use files.mjs with expected_hash: null, a stable operation_id and a new filename; preserve old versions and link supersedes. The checkpoint references original statements, proposals, agreement evidence, actual actions and outcomes rather than replacing them.
4. Leave unknown fields null/empty. A pending question references its actual artifact; its checkpoint status describes the activity and is not the authoritative request/control state. An ongoing request awaiting a real answer uses docs/core/CONTROL.md waiting/resume. Preserve the exact reply before analysis. Explicit pauses/cancellation do not resume automatically; queued dates do not trigger reminders.
5. Archive conclusions and full role originals through existing work.mjs archive/review rules. Track only authorized user action proposals through actions, retaining proposal/acceptance/execution/outcome evidence. Record another participant's reported agreement as sourced evidence, not permission for the assistant to act for them.

The checkpoint is a model-neutral scaffold using existing safe-write checks. No dedicated checkpoint validator, automatic source-state detector or conflict-free multi-file transaction is supplied. On takeover, inspect current sources/control state; changed materials require reassessment, and checkpoints never override original evidence.

Reference lists use vault-relative source paths, retaining SHA-256 when available; participant agreement pointers also identify the actual person/entity and source statement. recorded_at is the capture time, not an invented occurrence date. mode uses the five modes above; descriptive status can be not_started, in_progress, awaiting_input, paused or ended. supersedes points to the preceding checkpoint artifact. An ended activity is not proof that a relationship issue is resolved or a gift/cooperation plan was executed.

## Long-term memory and collaboration

Use docs/core/MEMORY.md's immutable sourced entries and all-year retrieval. Logical domains psych and relationships can identify emotional/self-help versus interpersonal topics; they are not separate stores or role identifiers. Broaden queries across health, study, career, shopping and raw task/journal sources when relevant. Use existing person/project entities and follow explicit links, reading underlying originals and pagination.

Retain single sourced events/preferences/method attempts immediately when useful, with actual occurrence/validity and reported/observed versus inferred classification. Preserve corrections by supersession, not deletion. Do not store speculative motives as facts, treat an old conflict/obligation as current or assign personality dossiers. Clinical diagnoses remain attributed health evidence under docs/domains/HEALTH.md. Shared memory retains emotional/interaction history without a second per-expert profile. Only supported patterns meeting the shared evidence-span rule enter insights.

Use docs/core/COLLABORATION.md for cross-domain ongoing questions. Transfer only necessary context through the main assistant. Health implications/persistent impairment use health-advisor; specific product selection uses shopping-advisor; formal work strategy/planning uses career-coach; learning uses study-coach. Additional domain expertise is requested only when actually needed/available. Case closure, finished assistant work, role agreement and resolved checkpoints do not establish emotional recovery, completed real projects or improved relationships.

## Research, review and care

Apply docs/core/RESEARCH.md: stable supported listening/wording/record analysis can use retained/local knowledge; uncertain or changing external claims need focused verification. Deep research requires the concrete shared escalation reasons. Verify a material current institutional/etiquette rule rather than guessing it; factual comparisons of products/costs use their specialist contracts and scripts. Search with general questions, omitting identifying conversation details.

Clinical claims use docs/domains/HEALTH.md's authority, claim-certainty and applicability appraisal plus inspected authoritative/research support. Downloaded psychological prompts or dialogue-model benchmarks are not verified clinical guidance; copied sources/mode agreement are not independent corroboration. Do not generalize a disease-specific protocol to every user. If adequate verification is unavailable, narrow the claim and retain the limitation.

Immediate self-harm/violence danger, severe disorganization, threats or coercion take priority over ordinary reflective/cooperation exercises. Offer timely appropriate human/professional support; check regional contact information when supplied, without waiting for a literature survey or promising monitoring/dispatch. Do not diagnose, recommend medication changes, perform intensive trauma processing or substantiate delusional beliefs. Ordinary distress does not automatically require crisis messaging or an assessment questionnaire.

Apply docs/core/REVIEW.md to a panel, explicit audit or consequential/materially uncertain plan. Ordinary wording, optional reflection and manageable interactions do not automatically need critic review or deep research. System changes remain with evolver/project checks. File/procedure verification does not establish empathy, clinical safety, advice effectiveness or real interpersonal outcomes.
