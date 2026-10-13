---
name: setup
description: Initialize or update interaction language, regional settings, personal profile, and goals. Use for the first interactive onboarding after deployment, profile updates, or a lasting language, timezone or region change.
---

# Onboard or update the user

Maintained instructions are English. User-facing onboarding follows the interaction language.

Apply config/CONFIGURATION.md's Voluntary disclosure and privacy policy before any personal question or profile/history retrieval. Read the configured default/applicable subject choices through tools/privacy.mjs or the preference file. Every personal field is optional; skip refusals without asking why, reconstructing the information elsewhere or requiring completion of the form. This generic workflow does not select privacy choices for the user.

## Confirm language first

1. Run `node tools/language.mjs show`.
2. If the preference is unconfirmed and that choice is not declined, offer a preferred-language choice and allow skipping. Ask in the language the user is already writing in; otherwise use the resolved default (`en` unless the vault configures another). Do not assume a language from the region, timezone or name.
3. Save only an actual answer. A skip/decline retains the unconfirmed default, stops repeat questioning and permits useful allowed help without mandatory profile intake. Deployment or elapsed time is not confirmation; do not create an indefinite wait for this optional choice.
4. Resolve the answer to a language tag such as `en`, `zh-CN`, `es` or `ja`, then save it with `node tools/language.mjs set <language-tag>`. An unambiguous prior answer in the same session can be reused.
5. If already confirmed, use the stored language without asking again. Change it when the user explicitly requests a lasting change.

The preference belongs to `profile/preferences.json`, is portable across models, and must survive upgrades. An isolated request for a response in another language does not automatically change it.

## Regional settings (optional)

After the language choice, and only when useful, settle regional settings. Each is optional, asked at most once, skippable, and saved only from an actual answer through `node tools/settings.mjs set <setting> <value>` (hash-checked, history retained). Apply the voluntary-disclosure policy: region and currency are location/finance information, so a withheld location or currency field, or a general privacy mode for that scope, means do not ask.

1. Run `node tools/settings.mjs show`. Dates follow the reported timezone. When its source is `system`, state it briefly (for example "Dates will use Europe/Berlin") and ask only if the user indicates it is wrong or the runtime clearly runs elsewhere (a cloud host on UTC). Save an IANA name with `set timezone <name>`; `system` returns to the runtime clock. Already-written records keep their recorded timezone.
2. Ask for region or currency only when a domain actually needs it: shopping channel scope, prices, finance worksheets or travel costs. Save with `set region <ISO 3166-1 alpha-2>` or `set currency <ISO 4217>`. Never infer them from language, timezone, name or files.
3. When the user first asks for shopping help and no channels are configured, ask which marketplaces and review/experience channels they use, and save lowercase identifiers with `set marketplaces <a,b>` and `set experience_channels <a,b>`. Free-form shopping preferences stay in `experts/shopping-advisor/preferences.md`.
4. A skip leaves the value unset; continue with general, clearly scoped help.

## Profile and goals

Follow `docs/core/ORCHESTRATOR.md` for the durable request, follow-up answers, and step outcomes. User answers provide source evidence; do not rely on the current session as the only memory.

Use `docs/core/CONTROL.md` to record waiting for necessary answers, resume with the captured answer, and revise the plan when goals change. Skip nonessential questions under stated uncertainty instead of introducing unnecessary waits. Pausing or cancelling onboarding preserves already supplied information.

1. Read only permitted relevant profile/goals excerpts. Missing fields do not require collecting a complete profile; respect default/subject restrictions before retrieval.
   Use docs/domains/CAREER.md when work/career goals are relevant: reuse actual objectives/deadlines, current expectations, artifacts/feedback, capacity and preferred direction. Obtain location/level only when needed for current opportunity/credential facts; keep uncertain market requirements separate from personal ability. Do not force a job-search intake for ordinary project recording.
   Use docs/domains/FITNESS.md for training goal/background, available time/equipment, source-backed baseline and current restrictions. Reuse existing answers; preserve self-reported scales/protocols and unknown values without requiring extensive testing or a full literature review to start recording.
   Use docs/domains/HEALTH.md for source-linked health constraints, attributed diagnoses, actual medication-use context, and documents. Reuse known answers and preserve actual validity/occurrence. Fictional development records and unreviewed uploads are not the user's clinical history.
2. Ask only one or two decisive optional questions for the requested goal/activity at a time. Body/health, family/relationships, schedule, food, exercise, work/learning and goals can be discussed only within permitted scope. Respect anonymous/approximate answers and refusals; no fixed questionnaire or all-field requirement.
3. Save each answered round immediately rather than waiting for completion. Update the profile's `updated` field and append dated old-to-new change entries. Preserve existing data and storage headings.
   Capture sourced durable facts and preferences using `docs/core/MEMORY.md`; record temporary validity and uncertain dates explicitly. For changed facts, link the correction to the prior memory without erasing it. Use `tools/files.mjs` for hash-checked profile writes.
4. When permitted measurements and applicability are established, confirm units and use `tools/nutrition.mjs needs` under docs/domains/NUTRITION.md to calculate BMI and a screened energy estimate. Review normalized inputs and input issues; clarify only an allowed dimension, otherwise retain the limitation rather than guessing or pressing for withheld details. Software sanity bounds do not define clinical healthy ranges. Do not guess missing age/equation coefficients, assume a default activity factor, or generate universal nutrient targets. General adult eligibility does not imply condition-specific dietary advice.
   The user normally photographs meals. Explain the simple photo-recording habit once, with optional size/leftover/label views; do not require weighing every meal. Capture known dietary restrictions, practical preferences, familiar portions, and goal/review-date context without repeatedly asking existing profile answers. Preserve targeted nutrition history in its initialized records and shared memory.
5. Summarize the profile and suggest one small daily recording habit in the selected interaction language.
