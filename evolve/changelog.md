# Changelog

Append-only record of system changes: what changed, why, and the evidence. New entries go at the end.

## 0.1.0 Initial public release

- File-based personal assistant: personal records and operating instructions are plain Markdown/JSON files; any model with file access and Node can take over through `AGENTS.md`.
- Small entry: `AGENTS.md` is an intent router plus a safety floor; other documents are read only when a task needs them. Byte budgets are enforced by the development test suite.
- Quick paths: `tools/quick-log.mjs` records a simple daily message in one command; `workflows/ask/QUICK.md` answers simple questions without the full consultation procedure. Live trials with fresh models read about 5-9 KB of instructions for these cases.
- Full procedures for consequential work: request/plan/step tracking, critic review, multi-expert panels, long-term sourced memory, and shared case collaboration.
- Domain roles: nutrition, health, fitness, study, career, shopping, psychology/interaction, finance, travel, plus critic and evolver. Shopping, travel and finance are research/advice only.
- Voluntary disclosure and privacy preferences apply to every role; nothing personal is required.
- Storage safety: immutable records, hash-checked recoverable writes, machine-local locks with stale-lock recovery, and reporting of sync/backup conflict copies.
- Deployment: `tools/deploy.mjs` installs or upgrades a personal vault without overwriting personal data, and removes managed system files that no longer exist in the source.
- Daily data/action report after a submitted sleep record, with an optional PDF renderer.
- Regional settings: no region is built in. The timezone resolves from the user preference, then `project.json` `timezone` (ships `null`), then `LIFEOS_TIMEZONE`, then the system timezone, through `tools/settings.mjs`, which also stores optional region, currency and shopping channels; records keep the timezone they were written with. The interaction language defaults to `en` until the user chooses it during setup. Shopping marketplaces and experience channels are user preferences; the shared lists ship empty.
- Food composition tables are not distributed for licensing reasons. They are optional reference files each user may build for personal use (`tools/build-food.mjs`, `data/food/README.md`); without them `data/food/custom.json` and label values still work and unknown composition stays unknown, never zero.
- Bilingual documentation: `README.md` (English, entrypoint `human`) and `README.zh-CN.md` (Simplified Chinese, entrypoint `human_zh`) serve as both the repository front page and the guide inside every deployed vault.

## 0.1.1 Coaching replies, photo meals on the quick path, plainer reports
- From real use: the assistant only recorded meals and missed obvious advice (a dinner suggestion after two meals, tomorrow's tweak, recovery after the previous evening's training), and handled meal photos and corrections through the full procedure with long reasoning and ad-hoc scripts.
- `AGENTS.md` adds a short style rule: coach after saving with 1-3 specific suggestions, ask at once with numbered options when an unclear item changes the result, keep reasoning short and do not read tool source. The log quick guide gains a reply section and documents every input.
- `quick-log.mjs`: photo meals (`meals[].photos`, originals preserved through the existing photo utility), non-meal attachments such as sleep screenshots (`attachments`), meal corrections (`meals[].supersedes`, replacing the journal row and re-summing the meal's day), a receipt `context` (today so far, last 2 days' training, recent sleep and symptoms) for advice, all entries validated before anything is written, and a slimmer receipt.
- Daily report human views (HTML/PDF/Markdown) drop citation labels, the source index, paths and SHA-256 hashes, and use plain labels such as "estimate" and "partial"; `report.json` and bundle metadata keep full sources and verification. Layout version 7.
- Entry budgets raised slightly (AGENTS 3.5 KB, log guide 7 KB) at the owner's request; current sizes are 2.9 KB and 4.9 KB.
