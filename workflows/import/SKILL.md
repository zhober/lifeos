---
name: import
description: Preserve external exports or API data and map them into personal journals. Use when the user supplies files or asks to import health, activity, calendar, study, or similar records.
argument-hint: <source> [file-path]
---

# Import external data

Input: $ARGUMENTS

When permitted imported morning sleep data is actually captured and analyzed, use docs/domains/REPORTING.md's after-sleep event to export the preceding daytime report plus waking-date sleep. A file's arrival or an imported score does not prove completed analysis or justify an unsupported scale conversion. Pending/withheld/changed sources remain explicit; no clock watcher or report is inferred from a file path alone.

Travel material uses docs/domains/TRAVEL.md. Apply disclosure before retaining permitted original bytes through runtime filesystem capabilities or interpreting tickets/confirmations/maps. Existing work.mjs attachments reference retained sources; they do not copy or parse binary originals. No dedicated travel PDF/CSV/OCR importer is supplied. Keep source reading/subject/time/booking status uncertainty explicit; a suggested itinerary or quote does not establish a reservation, actual visit or account-action authorization.

For financial sources use docs/domains/FINANCE.md: retain permitted original bytes with finance.mjs original, inspect/extract only through available runtime tools and normalize a selected worksheet with exact source pointers. No built-in bank/XLSX/PDF parser is claimed. Keep extraction pending/uncertain when necessary; exact source/flow identities, aggregate/event separation, currency/period and coverage prevent invented classifications or cross-source double counting. Imported forecasts/obligations are not automatically paid transactions, and no bank login/synchronization is implied.

Apply config/CONFIGURATION.md's Voluntary disclosure and privacy policy before extracting, indexing or sharing personal details. A supplied file supports its stated current purpose, not unrelated fields or later unrestricted use. Preserve allowed originals under existing contracts while selecting only permitted derived context; do not expose blocked attachment metadata or require a replacement upload to recover a declined field. If a tool cannot keep extraction/output within scope, retain the limitation and use a permitted smaller analysis rather than sending blocked contents onward.

Apply `docs/core/ORCHESTRATOR.md` for a durable import request, step outcomes, conflict reporting, and retry behavior. Use stable source/record operation IDs so resuming an import does not duplicate the same event.

Use `docs/core/CONTROL.md` when an import is paused, cancelled, replaced, or replanned. Completed file writes remain evidence and cannot be replayed as new imports. Waiting on a format clarification or file conflict does not silently resume; capture the answer or resolution before continuing.

Follow the language policy in `AGENTS.md`. Preserve source files and original statements in their original language. Use existing templates and source notes for exact persisted field and heading names.

## Workflow

1. Save the original file or response unmodified under `inbox/<source>/YYYY-MM-DD[-sequence].<extension>`, using a short lowercase source identifier. Avoid overwriting prior originals; do not recopy a file already in the inbox.
2. If the source README is absent, document provenance, field meanings, and journal mapping rules in the configured interaction language. Reuse that mapping for later imports.
3. Organize records by date:
   - Map indicators such as steps, sleep duration, and weight into their existing frontmatter keys.
   - Do not overwrite a conflicting user-entered value. Preserve the incoming value and conflict explanation in the raw-record section.
   - Put detailed activities or schedules in the corresponding existing tables or narrative sections with provenance.
   - Append an import trace identifying the source and original filename.
4. Aggregate each affected journal with `node tools/day.mjs sum <date>`.
   For shopping screenshots, saved listings, community experience text/captions or order/after-sales exports use docs/domains/SHOPPING.md. Retain originals, actually inspect/extract content and save versioned exact variant/price/quality/instance/watch records. Declare buyer/fees/discount eligibility, expiry and actual source-reading scope. Search snippets and an unread video are leads; a retailer import does not order, return or refund anything. Legacy shopping tables remain summaries and are not reimported as duplicates automatically.
   Do not import browser profiles/cookies/tokens or authentication exports into the vault. Necessary account login is completed by the user; retain only scoped product/quote/experience or supplied transaction evidence with unnecessary private account data excluded. No transaction/after-sales action is performed to obtain an import.
   For workout/device exports use docs/domains/FITNESS.md. Retain original bytes, actually parse/inspect them, and map explicit units/time/completion/source identifiers to one canonical session. Resolve duplicates across user/device reports instead of summing the same workout twice. Do not import steps as training repetitions or a watch estimate as measured calories/clinical load. Independent daily exercise totals retain exercise_min_origin independent and original scope; they are not added to session time. Preserve raw files, corrections, unresolved values and updated case evidence.
   For medical reports/visits/medication exports use docs/domains/HEALTH.md. Preserve original bytes, actually inspect/extract them, and record typed immutable versions with subject, actual dates, original units/comparators/ranges, OCR uncertainty, attributed wording, and prescriptions versus reported use. Link case evidence and expose reassessment after source/record changes. Unreadable documents remain pending.
   For work exports, project/material/feedback documents, postings or application history use docs/domains/CAREER.md. Retain originals through career.mjs original, inspect the actual text/data, preserve subject/occurrence/explicit duration units, and create canonical typed versions. Calendar allocations are plans or elapsed blocks, not measured active work. Provider keys can detect duplicates within a source; cross-source event matching needs judgment. Preserve exact project/slot/material/opportunity references, actual stages and unresolved facts; imports do not submit applications or establish success.
   For meal photos and nutrition imports read docs/domains/NUTRITION.md. Preserve originals and source units/bases; group image views by eating event and create sourced immutable meal versions rather than duplicate rows. Use `nutrition.mjs independent` with its template for separately supplied daily nutrient totals, declaring units and source-supported full-day scope. Never add them to meal totals or fill unsupported nutrients. Bare totals and legacy table rows remain unverified until their provenance is reconstructed; a free-form source cell or all-intake statement alone is insufficient. Preserve structured conflicts, independent claims, and displaced cache history. Never infer full-day completeness from file count or a successful import.
   Capture selected sourced facts, episodes, preferences, constraints, and method outcomes under `docs/core/MEMORY.md`. Use the source's actual occurrence date and record capture time separately. Keep old raw imports and superseded memory versions. Use hash-checked writes for organized records.
5. For repeated deterministic imports, propose a `tools/import-<source>.mjs` converter and document it in the source README when requested.
6. Report imported dates, fields, and conflicts in the configured interaction language.

Do not modify or delete originals, infer missing personal values, or translate storage keys.
