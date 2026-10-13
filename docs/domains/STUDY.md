# Learning resources and AI teaching

Use experts/_common.md and the shared request, memory, control, review and research contracts. The main assistant writes records; study-coach is the single learning role for planning, resources, teaching and review. Models and runtimes remain replaceable.

This release uses existing journals, requests, artifacts, actions and memory. It adds role procedures and a checkpoint template, not a study database, mastery classifier, video parser, model caller or scheduler.

## Mode and context

- Use log for actual study observations and ask/study-coach for plans, resources, explanations or progress review.
- Use workflows/learn/SKILL.md for interactive instruction, quizzes and lesson continuation; natural-language requests work without native command registration.
- Coordinate cross-domain constraints through the main assistant under docs/core/COLLABORATION.md. All learning work stays with study-coach; its modes do not add experts or independent assessments.

Choose only necessary modes: planning for goals/path/workload, resources for material selection, teaching for instruction/practice/feedback, and review for evidence-based progress/method adjustment. Mode changes reuse the same goal, sources, original turns and checkpoints; they do not require a second role invocation or the whole sequence on every question. A direct explanation starts in teaching, and observed difficulties can inform the next plan.

project.json definitions.role_aliases maps the historical ai-tutor identifier to study-coach. Resolve old names through `node tools/experts.mjs --resolve ai-tutor --json` or the shared manifest. The archived agents-disabled/ai-tutor.md is historical reference, not a second active prompt. Preserve old role identifiers, lesson IDs and checkpoints in personal records; read relevant experts/ai-tutor/ references when they exist, and append new references to experts/study-coach/. Do not create another learner profile or a duplicate knowledge store.

Reuse the goal, baseline, deadline, time, language/style and earlier attempts. Ask at most two decisive onboarding questions at a time; practice questions are teaching activities. Give direct explanations when requested rather than forcing Socratic questions.

## Resource selection

Include courses and video lessons in the learner's language (for example Bilibili and Chinese university MOOCs for Chinese-language learners), other MOOC platforms, suitable open learning communities, textbooks and official subject documentation. Select by topic; no platform is reliable or unsuitable as a whole.

Evaluate content reliability, learner fit and accessibility separately. Inspect originals and retain author/institution, title, URL/file, language, prerequisites, section/page/timestamps, inspected scope/date and selection reason. Access, cost and captions stay unknown until checked; reposts are not independent corroboration.

Offer a small useful set with an immediate activity. AI teaching is an alternative or supplement and can be chosen directly. Apply docs/core/RESEARCH.md's retained/local or focused verification and stopping policy; do not require exhaustive course discovery before teaching.

A video URL or player is not inspected content. Source-based teaching uses obtained subtitles, excerpts, images or actual user-provided material with location references. If unavailable, state the gap and teach only the supported general topic; do not invent video-specific claims.

## Teaching loop

1. Read the latest valid checkpoint, relevant sources and original learner turns. Material/answer-key corrections require reassessment of affected feedback.
2. Establish one specific objective. Diagnose a prerequisite when useful, or give the requested explanation/worked example directly.
3. Explain a manageable part; choose questions, examples, diagrams, teach-back, quizzes or project/code practice to match the learner's request.
4. For practice, ask one focused question and wait for the real answer. Preserve the question/version and exact learner words before interpretation.
5. Check the reference solution, rubric and assumptions before feedback, using suitable source passages, official documentation and scripts/runtime checks. Generated answer keys remain provisional until checked; do not claim unperformed checks.
6. Give specific feedback, accept alternative correct reasoning and retain disputed grades. Record hints/examples/revealed solutions; assisted performance remains assisted.
7. Adjust the activity or propose later review. Exposure, duration, confidence, skipping and one correct answer do not establish durable mastery; independent/delayed checks are separate observations.

Teaching response length follows the activity and requested detail. Shared brief advice-summary limits do not constrain every lesson. Ordinary exercises do not automatically need critic review; consequential proposals use docs/core/REVIEW.md's existing triggers.

## Durable capture and continuation

Use work.mjs start/message for exact requests and student replies, retain full role outputs as task artifacts and consultation archives, and use files.mjs for safe writes. Declare the current request/plan, dependencies and role attempts under docs/core/CONTROL.md. Invented teaching examples are not personal observations.

Use stable topic/lesson IDs when known. Retain original questions, student answers, explanations, material pointers and feedback as separately named artifacts under tasks/YYYY/<request-id>/. Keep all originals; checkpoints complement them.

For every material change, create `study-checkpoint-<checkpoint-id>.json` from templates/study-checkpoint.json, with a new filename, expected_hash: null and stable operation_id through files.mjs. Preserve older checkpoints and link them via supersedes, retaining source/output paths or hashes. This is a shared convention backed by existing write checks, not a new dedicated checkpoint validator.

A checkpoint records the objective, sources/exercise versions, original turn references, observed performance/assistance, pending question, next activity, uncertainty and review proposal. Unknown dates/quantities remain null. Do not estimate actual study time from message count or a proposed lesson duration.

An unanswered exercise stays awaiting_answer. For an ongoing request, keep its pending step and use waiting/resume under docs/core/CONTROL.md; a reply can clear the recorded input condition. Do not predict completion. At the requested lesson end, save the checkpoint and close the authorized execution scope accurately; a later lesson uses an authorized linked follow-up when the earlier request is terminal.

Pause/cancel affects execution, not historical performance. Skip does not imply correctness. Preserve obsolete outputs after replanning; they do not advance the new plan. A new model retrieves the latest checkpoint and relevant original sources/turns to continue the unresolved activity.

## Progress and memory

Use the existing study table and study_min for actual reported activity. Imported tests and reading lists may be source artifacts. Performance interpretation retains occurrence date, task version, conditions, assistance and provenance; missing evidence stays unknown.

Distinguish viewed material, practice attempts, assisted success, independent success and delayed retests. Self-confidence is a separate signal. Use comparable evidence rather than universal mastery percentages or unsupported model labels.

Track proposals, acceptance, execution and outcomes through existing actions. Review dates are proposals until accepted; stored dates do not send reminders. Use shared memory for durable facts/episodes rather than a second tutor profile; only qualifying patterns enter memory/insights.md.

study-coach performs ordinary weekly/monthly learning review and inspects particular lessons/grades in the same role when necessary. Use original evidence and avoid duplicating every assessment. Apply current goal priorities and constraints without changing other role responsibilities.
