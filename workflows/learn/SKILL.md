---
name: learn
description: Teach or continue a source-grounded lesson with explanations, practice and feedback while preserving original learner turns and checkpoints. Use for interactive teaching, quizzes, exercises or resuming a lesson.
argument-hint: [topic or lesson] <learning request>
---

# Teach and continue a lesson

Input: $ARGUMENTS

Read docs/domains/STUDY.md and the shared language, request/memory, control, research and review contracts. Discover current roles and resolve historical names through project.json definitions.role_aliases or tools/experts.mjs --resolve. Use study-coach as the one learning role, selecting only needed planning/resource/teaching/review modes. Do not require a role handoff for a mode change. Runtimes may execute role procedures sequentially; describe execution honestly.

1. Preserve the exact request/attachments. Retrieve the goal, materials, earlier attempts, original turns and latest valid checkpoint. Start a request or continue the applicable ongoing one; terminal requests need an authorized linked follow-up.
2. Reuse needed sources or use study-coach's resource mode for a small suitable set. Include resources in the learner's language and direct AI teaching; user-selected AI instruction does not require exhaustive discovery or a planning phase.
3. Plan only necessary teaching, practice, feedback and checkpoint work under docs/core/CONTROL.md. Declare effects/dependencies and role attempt before calls. Keep a pending step when a student answer is required.
4. Give study-coach the objective, source locations, preference and checkpoint/answers in teaching mode. It returns explanations or one focused exercise and full assessment/evidence; it remains read-only. Reuse this context if resource, review or planning work becomes necessary.
5. Save complete output and a new checkpoint with the existing safe-write/archive tools. When awaiting an answer, retain the question and set the ongoing request waiting with its input condition. Present the question and yield for the actual reply.
6. Persist the exact reply with work.mjs message before analysis. Resolve the recorded input condition and resume the applicable request without overriding an explicit user pause. Pass the real answer, hints already given and checked reference solution to study-coach; retain assessment and next checkpoint. Use observed performance to adjust the next activity or plan in the same role. Replan explicitly if the objective or required steps change.
7. At a requested lesson end or sufficient completion, distinguish delivered instruction, observed performance and unresolved evidence. Save next activity/review proposals, warranted actions and sourced facts/episodes under existing acceptance, review and memory rules.

Do not invent scores, duration, mastery, execution, citations or independent review. Pauses/skips are not failed learning. Source/exercise corrections retain old feedback and identify reassessment needs. Timers, video parsing and model calls remain runtime capabilities.
