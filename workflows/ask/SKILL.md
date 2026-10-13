---
name: ask
description: Consult one relevant expert and archive the complete response. Use when the user asks for advice from a particular role or on a single specialist topic.
argument-hint: [expert] <question>
---

# Consult one expert

Input: $ARGUMENTS

A simple general-knowledge or low-stakes personal question takes the light path in `workflows/ask/QUICK.md` instead. Use this workflow for consultation and for any escalation listed there. Read the contracts named below when the question needs them, not as a fixed preload.

Travel questions use docs/domains/TRAVEL.md and travel-planner: select only needed discovery/planning/logistics/revision/review work, apply disclosure before context and current source checks before decisive claims, and retain exact plan/selection/actual distinctions. Use travel.mjs only for permitted normalized arithmetic; archive full expert output and versioned task-based checkpoints. No booking/payment/account action is authorized.

Before personal questions or source/context selection, apply config/CONFIGURATION.md's Voluntary disclosure and privacy policy for every applicable subject. Use the shared preference view, not a per-role refusal list. Work with permitted anonymous/approximate/general inputs when appropriate; do not use another role or historical record to recover a declined field. Missing private data limits unsupported specificity without requiring disclosure or full intake.

Select local/lightweight research under docs/core/RESEARCH.md before consulting. Routine questions stop once reliable evidence answers them. A deep expert investigation needs a concrete hard question/material unresolved source conflict or explicit deeper user scope, with reason/scope/stop condition retained in the request artifact. A requested link, a medical topic, or a critic gate alone is insufficient.

Use docs/domains/HEALTH.md for health questions. For an ongoing/shared issue follow docs/core/COLLABORATION.md and retrieve its case, keeping original evidence and role interpretations separate. Retain exact question/response bindings. When the execution request closes, bind an authorized linked follow-up instead of reviving it. An assessed response or closed case does not satisfy a triggered critic gate.

Learning requests use docs/domains/STUDY.md and the single study-coach role in the necessary planning/resource/teaching/review modes. A single explanation starts directly in teaching. Historical ai-tutor requests resolve to study-coach through project.json definitions.role_aliases or tools/experts.mjs --resolve. Interactive lessons/practice and continuation use workflows/learn/SKILL.md so original student turns and pending questions remain durable.

Emotional support and interpersonal advice use docs/domains/PSYCH.md with psych-coach in the needed support/reflection/communication/interaction/review modes. Reuse original turns, person/context history and latest valid checkpoint. Direct replies, gifts and everyday coordination do not require psychological assessment or a panel. Request product/work/health/learning input only for the distinct necessary question, preserving participant agreement and actual-action evidence. Save real replies before continuing; do not send messages or execute shopping transactions.

Financial questions use docs/domains/FINANCE.md with finance-advisor. Check permitted scopes first; reuse one relevant current/historical worksheet and finance.mjs calculation with actual source/coverage limitations. Bookkeeping, budget, saving/debt, balances and scenario modes are optional. No full-profile intake or private-data reconstruction. Actual cash, economic categories, principal, forecast and hypothetical values stay distinct; precise unsupported recommendations remain qualified. Product quality/price and work assumptions go to the responsible role only when needed. No financial account/purchase/payment execution.

Work/career advice uses docs/domains/CAREER.md and the narrowest career-coach mode. Read exact project/adoption/milestone/source evidence, work summaries and original outcomes/opportunities/process stages. Do not conflate preparation, acceptance, actual execution or results; route learning gaps through the main assistant instead of duplicating teaching.

Specific purchase advice uses docs/domains/SHOPPING.md: reuse owned items and preferences, discover relevant offers on the user's configured marketplaces and inspect experience on configured community channels where useful (ask for channels once when none are set and scope matters). Preserve exact variant/buyer/discount conditions and original claim sources, including inaccessible/snippet/video limits; routine discovery stays lightweight. Compare saved offers without presenting conditional calculations or historical observations as current eligible prices. Accepted price watches and actual after-sales feedback remain separate from advice.

For shopping pages requiring login, follow docs/domains/SHOPPING.md: user-handled authentication, then scoped read-only research. Do not request secrets or save session data in the vault. Shopping advice ends with findings/links; the main assistant and delegates never add to cart, enter checkout, order/pay, claim promotions or execute after-sales actions. Observed checkout prices may come from the user's own source material only.

Apply `docs/core/ORCHESTRATOR.md`. Persist the exact request and follow-up messages, finish any recording intent first, and retrieve both current and relevant historical context under `docs/core/MEMORY.md`. Pass dated sources and uncertainty to the expert; a fourteen-day statistics window is not a history cutoff.

Follow `docs/core/CONTROL.md` when the user pauses, cancels, changes scope, or supplies missing information. Declare the expert in the plan and claim its attempt before an asynchronous call. Preserve obsolete outputs with capture rather than applying them to a new plan. Missing essential expertise remains blocked unless the authorized scope actually changes.

Follow the language policy in `AGENTS.md` (details in `docs/core/HANDBOOK.md`). Resolve the current roster with `node tools/experts.mjs`; match the user request to role descriptions, giving priority to a named role regardless of the language used to name it. Resolve a historical alias to its canonical active role before new calls, preserving original wording and old archive identifiers. If none fits, explain the gap and suggest the expert-creation workflow.

Apply `docs/core/REVIEW.md` after a proposal exists. Explicit audits, material uncertainty/conflict, substantial commitments relative to the user's circumstances, and meaningful safety concerns trigger review; ordinary simple advice need not. Record the trigger or reason no review is needed. For advice release, add critic, dispositions, a required non-waivable read step with `review_gate: true`, and archival dependencies before calling asynchronous review. A named critic auditing a supplied plan is audit-only: report its verdict even if adverse, without a release gate or invented replacement plan.

## Workflow

1. Invoke the selected expert through the available runtime, providing the original question, current date, and resolved interaction language. The expert reads its definition, shared rules, and relevant records. Disclose sequential role execution if independent agents are unavailable.
2. Save the full original expert output. For triggered advice, save a labeled final draft, provide the critic with exact sources/current and historical context, record every disposition, and re-review corrections under the bounded docs/core/REVIEW.md procedure. Complete the gate only with a passing current packet. For a direct critic audit, save the supplied plan and full audit packet; an adverse verdict completes the audit but does not approve the plan.
   Archive with the request ID, stable operation ID, expert output(s), and final response. For reviewed advice include `review_packet` and exact reviewed-target text as `summary`; expected experts include the domain role and critic. A direct critic audit uses expert `critic` and `audit_only: true`. Incomplete advice may use `provisional: true`, with missing responses and unresolved approval disclosed. Preserve every version, follow-up, full response, and review round; do not overwrite legacy archives.
3. Apply proposed domain-record changes only within the user's authorization. Ask only when the change was not already requested or approved.
4. Append a personal insight to `memory/insights.md` only if it is actually supported by at least two weeks of evidence.
5. Perform the durable updates below.
6. Present the advice or audit verdict in the configured interaction language with the archive path. Preserve reviewed quantities, assumptions, and minor notes; do not make post-review changes or present blocked advice as approved. Only approved final recommendations become proposed actions; factual capture remains independent.

## Durable personal updates

Extract new information from the exchange only when it exists:

- Goals: update `profile/goals.md` within the user's authorization.
- Constraints: update the relevant part of `profile/me.md`.
- Attempted methods and outcomes: use the profile's existing attempted-methods section.
- New facts: update the profile or the relevant expert knowledge directory.

For changed existing facts, append a dated old-to-new entry in the profile's change-history section and cite the advice file. Preserve existing headings.

Also capture sourced durable memories under `docs/core/MEMORY.md`, using validity dates and supersedes links rather than deleting prior versions. Classify single episodes separately from personal patterns and keep estimates and hypotheses labeled. Use hash-checked profile writes. Track proposed and adopted actions with `tools/work.mjs action-create` and evidence-based status events instead of one consultation-level execution flag.

## External knowledge

If the expert identifies reusable external knowledge, append the points, source titles and links, evidence levels, and lookup dates to `experts/<expert>/knowledge.md`. Keep external knowledge distinct from evidence-supported personal patterns. Write new prose in the interaction language without translating source quotations or rewriting prior entries.
