---
name: review
description: Generate a daily, weekly, or monthly life review from records, goals, prior advice, and outcomes. Use for personal reflection and progress summaries, not a code review.
argument-hint: day|week|month [date]
---

# Review recorded life activity

Input: $ARGUMENTS

Daily PDF requests and the completed morning-sleep event use docs/domains/REPORTING.md/workflows/report/. Default style is data/actions, preserving source/coverage and proposal/acceptance/actual distinctions. Sleep remains dated by waking; source-bound reports link it to the previous daytime date. Descriptive reports do not launch every expert or deep research. Original reviews/journals remain intact; PDF exports are immutable derived versions, not new personal facts.

Travel review uses docs/domains/TRAVEL.md and relevant exact designs, selection evidence, actual activity/cancellation/outcomes and checkpoints. Compare expected versus reported experience/expenses with source and coverage limits; time passing or a finished assistant task does not establish a trip/booking/visit. Reassess changed source/constraints and preserve corrections. Reminder dates and advice never execute booking/payment/change/cancellation.

Apply `docs/core/ORCHESTRATOR.md` for request persistence and continuation. Retrieve applicable long-term context under `docs/core/MEMORY.md`, including earlier decisions, constraints, and attempted methods relevant to this period.

Apply config/CONFIGURATION.md's Voluntary disclosure and privacy policy before selecting personal review/history context. Review only permitted relevant evidence and filter expert/critic packets accordingly; a periodic review cannot require declined details, reconstruct them or treat absence as noncompliance. Preserve unknowns and qualify unsupported conclusions.

Inspect task lifecycle under `docs/core/CONTROL.md` alongside action history. A cancelled or superseded request is not an uncompleted personal action or evidence of noncompliance. Preserve scope changes and qualified completions in the review; do not restart held or closed requests merely because they appear in historical records.

Default to today and daily mode. Weekly mode covers the natural week beginning Monday through the selected date; monthly mode covers the selected month. Follow `AGENTS.md` for interaction language. Localize newly generated review headings and prose.

Apply `docs/core/REVIEW.md` to consequential recommendations in weekly/monthly synthesis or an explicitly requested audit. Record the review trigger or concise reason it is unnecessary. Keep the critic out of the initial domain assessments. Descriptive daily reviews continue without expert calls; a separate consequential plan follows an advice workflow and its review gate.

## Workflow

1. Read goals, relevant long-term insights, and the previous review when available.
2. For dates with existing journals, run `node tools/day.mjs sum <date>`; keep missing dates missing rather than generating placeholder records for a review. Then run `node tools/stats.mjs --from <start> --to <end>` and inspect the underlying journals.
3. Read advice from the period. Use available evidence to distinguish completed, partially completed, and uncompleted actions; mark execution or outcomes unknown when records cannot establish them.
   Inspect relevant shared cases and cases.mjs queue under docs/core/COLLABORATION.md for due follow-ups, pending questions, source corrections, and stale assessments. Health reviews use docs/domains/HEALTH.md's all-year history and current applicability. A closed case or absent log is not proof of clinical recovery; queue signals do not resume paused tasks or invoke experts.
   Training reviews use docs/domains/FITNESS.md and fitness summary/compare-plan with exact plan links and coverage/quality. Separate actual completed/partial/not-performed reports from missing records, activity-specific quantities, recovery and comparable performance; do not infer adherence or an injury-risk zone from generic minutes/proxy changes.
   Learning reviews use docs/domains/STUDY.md and original answers/checkpoints. Separate time/exposure, assisted performance, independent performance and delayed tests; missing logs are unknown. Use study-coach in review mode and inspect particular lessons/grades within the same role when needed, without duplicating every assessment or treating mode changes as independent review.
   Work/career reviews use docs/domains/CAREER.md, career summary for this period and exact project views as of its end date. Keep active/elapsed/estimated/unknown effort, accepted design, submitted/accepted outputs, feedback and process stages distinct. Preserve unknown/same-day conflicting status and later events separately; original work_h is not added to sessions. Ask career-coach for the narrow relevant assessment, without inventing productivity or employability scores.
   Shopping reviews use docs/domains/SHOPPING.md for recorded purchases/use/after-sales outcomes and accepted watch queues. Read source-bound comparable quotes and original quality claims; historical minimum, target match, requested refund and actual money/experience are distinct. Report conditional/stale/unknown observations instead of asserting savings or product resolution. Queue due dates do not resume paused requests or send notifications.
   Read `node tools/work.mjs actions` and inspect each relevant action's status history and sources. Separate proposal, acceptance, completion, postponement, rejection, and unknown execution. When reviewing an earlier period, inspect dated status evidence rather than projecting today's status backward.
   Emotional/interpersonal review uses docs/domains/PSYCH.md, original turns, participant agreements, actions and interaction checkpoints. Inspect psych-coach input only for relevant support/method/interaction outcomes; missing logs are unknown. Proposed replies/gifts/divisions, actual use/contributions and reported outcomes stay separate. No relationship-strength/recovery score is inferred from exercise completion, gratitude or agreement. Old conflicts or commitments are checked for current applicability.
   Financial review uses docs/domains/FINANCE.md and selected current/historical worksheets with finance.mjs calculate, source/exposure/freshness and coverage checks. Compare equivalent periods/currencies without adding overlapping worksheets or aggregate totals to components. Accepted budgets/goals, actual payments, economic spending, cash movement and modeled outcomes remain distinct; missing data is unknown and no financial health/return score is invented. privacy-before-retrieval and no-account-action rules apply.
4. Daily mode: do not invoke experts. Append a short review at the end of the day's journal, using a clearly identified daily-review section. Include one or two positive observations and one to three priorities for tomorrow.
5. Weekly or monthly mode: discover experts at execution time and invoke only relevant domain roles with recorded data, excluding the critic from this initial group. Request a concise assessment, normally up to 200 Chinese characters or about 120 English words. Combine responses into a draft for:
   - Weekly: `reviews/weekly/YYYY-Www.md`, using the ISO week.
   - Monthly: `reviews/monthly/YYYY-MM.md`.
6. Include data overview and comparison with the previous period, progress against goals, prior-action outcomes, domain assessments, cross-domain relationships and conflicts, and at most three measurable next priorities.
   When review is triggered, save an immutable exact draft under request artifacts, obtain critic findings, record dispositions, and review the final synthesis and material corrections under docs/core/REVIEW.md. Declare the non-waivable `review_gate`, validate the complete packet, and archive all original domain/critic outputs with the exact reviewed draft as `summary`. Write the weekly/monthly document through checked writes only after the gate passes; preserve the reviewed content. Blocked recommendations remain provisional artifacts with status disclosed, while factual capture can continue.
7. Append evidence-supported patterns to `memory/insights.md` only under the shared personal-insight criteria.
   Capture newly established factual updates and outcomes with `tools/memory.mjs add` independently of the pattern threshold. Retain old versions and occurrence dates. Use hash-checked writes for review and profile files.
8. Reply with the main findings and saved path in the configured interaction language.

Expert assessments follow the same independent-versus-sequential execution convention as other consultation workflows. Preserve existing historical entries.
