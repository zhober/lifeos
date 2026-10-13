# Daily data/action reports and morning-sleep trigger

The user selected a data/action-first daily PDF. Automatic generation follows actual morning sleep submission and completed source-bound analysis, not a fixed 08:00 schedule. This replaces the briefly discussed clock trigger. No new expert is added; the main assistant uses current log/import/health/review/task/action/case procedures.

## Period and event semantics

Report date D covers daytime work/study/food/exercise/other records for D. The following morning's sleep remains stored on waking date D+1 under docs/core/RULES.md. Link that sleep and its completed analysis to report D with sleep_context; label the waking date in the PDF. Never move/overwrite sleep into the previous day's journal or copy arbitrary next-day data into D. Other trend dates stay within D; sleep trends may include the linked waking date.

After log/import captures user-supplied sleep data, the main assistant prepares a minimal immutable task artifact from templates/sleep-input.json, filling timezone with the configured timezone in effect (`node tools/settings.mjs show`), and retains exact original source pointers. Any field can remain unknown. Apply disclosure before reading, interpreting, summarizing or sharing; do not force sleep submission or reconstruct declined details. If skipped, manual reporting can still proceed. Missing sleep remains explicit in structured JSON and the report's display-scope explanation; it need not occupy an empty card.

episode_type is main_sleep, nap or unknown based on actual source meaning. The trigger is the submitted record itself, not a clock reading: any submitted main sleep episode for a waking date D+1, together with its completed analysis, triggers the report for the preceding daytime date D, whatever clock time it arrives. A nap, uncertain episode or arbitrary imported sleep score does not trigger it. Missing distinctions stay unknown rather than forcing a personal question.

Analyze the sleep record with `tools/report-sleep-analysis.mjs`, which derives a descriptive analysis from the submitted bytes alone: bed/wake interval, submitted duration, the user-supplied quality figure on its own scale, the user's note, and explicit limitations. It states a duration/interval mismatch side by side instead of averaging or rewriting it, and it makes no interpretation, trend or health claim. Capture the result from templates/sleep-analysis.json under a new task artifact with analysis_method descriptive_script. observations separate observation/hypothesis, and input_sources bind the exact sleep-input bytes. That artifact satisfies the reporting contract on its own; no model is needed for an ordinary daily report.

Use health-advisor's procedure instead, with analysis_method model_review, when the user reports concerning signs or explicitly asks for an assessment. Follow docs/domains/HEALTH.md, docs/core/RESEARCH.md and docs/core/REVIEW.md separately for anything consequential; an ordinary factual daily report does not launch all experts or broad literature work. Runtime/model analysis is never invented or clinically validated by the script.

Automatic personal reports use subject self. A companion/child's sleep stays attributed to that person and does not populate the user's sleep cards or trigger their report. Other-person context needs an explicitly scoped manual summary rather than a silently merged personal metric.

Use health-advisor's procedure only for a reported concern or an explicit assessment request. An ordinary daily report uses the descriptive script analysis above; it does not run the assessment procedure, invent a clinical reading or require a model to fill in the analysis artifact.

Prepare templates/sleep-report-event.json with exact sleep input/analysis paths, SHA-256 and truthful exposure descriptors. Call the after-sleep hook only after analysis completes. Pending analysis, changed source, subject/date/timezone mismatch or withheld context cannot silently produce an analyzed personal report. Automatic personal reporting requires an initialized real vault (.lifeos-deploy.json); development examples use explicit fictional basis and labels. This feature does not authorize cloud deployment.

```text
node tools/report.mjs after-sleep <event-input.json> [--runtime <external-pdf-runtime>]
```

This is a workflow/tool event hook executed by the runtime after recording/analysis. There is no clock job, polling process, background folder watcher or automatic reaction to files copied into a cloud folder without an executing runtime. Both the main assistant and any future model/API adapter read this shared procedure; register the callback in the adapter when it has real event support. Do not claim a native scheduler or filesystem watcher was enabled. Pause/cancel and docs/core/CONTROL.md still apply.

The hook reports one of four outcomes as JSON on stdout. Exit 0 covers all of them; only a genuine input/consistency error exits non-zero.

| status | Meaning |
|---|---|
| `generated` | Report archived with JSON, Markdown, HTML and PDF |
| `generated_without_pdf` | JSON, Markdown and HTML archived; the PDF renderer was unavailable, with the setup command in pdf_setup |
| `generated_text_only` | The caller explicitly passed --no-pdf |
| `skipped` | reason no_permitted_content_beyond_sleep: the covered date held nothing beyond the triggering sleep; no archive was written |
| not `ready` | The event is not yet eligible (`sleep_analysis_pending`, `main_sleep_episode_not_confirmed`, `sleep_sources_withheld`, …); no report attempted |

A date whose only content is the linked morning sleep is skipped rather than published, because the archive would restate the morning's own record against a daytime date with no record in it. Only the before-after sleep link matters: a date with any permitted recorded metric, action, follow-up, summary or domain note still generates normally, and gaps alone never count as content. The skip writes no archive and no trace artifact; report nothing was recorded was produced, and suggest manual reporting if the user expected one. Manual `collect`/`generate` for that date still works.

## Data preparation and daily-use improvements

```text
node tools/report.mjs collect <date> --out <new-vault-relative-input.json>
node tools/report.mjs generate <permitted-input.json> --runtime <external-pdf-runtime>
node tools/report.mjs verify <date-or-report-id>
node tools/report.mjs show <date-or-report-id> [--historical]
```

The deterministic collector resolves permitted journal metrics, canonical nutrition/fitness values, historical action status and current shared-case follow-ups. It does not create a missing journal, change original daily values, book/execute actions or generate personalized recommendations. Unknown values remain unknown; explicit zero stays distinct. Nutrition known subtotals do not become full-day intake, conflicts remain unknown and old numeric rows retain unverified labels. Missing/changed exercise links and incomplete inputs remain visible. Existing sleep/learning trends show recorded values with missing points, without false zeroes or health/productivity scores.

Action states are selected from evidence captured by report-day end in the configured timezone; later capture does not silently move backward. Status capture time is not actual execution date. Related assistant-request state is checked at generation; a completed consultation does not complete a user action, while paused/cancelled/replaced work is not presented as an automatically executable priority. Shared-case pending/stale/due signals are surfaced for coordination without dispatching an expert or resuming a stopped request. This makes continuation gaps visible in a daily artifact.

Use templates/daily-report-input.json to add minimal sourced domain summaries, exact finance/shop/career/travel records, long-memory context and prior approved advice when relevant. The baseline is not a universal typed-domain summarizer: the model/runtime checks domain/source/subject/occurrence/coverage semantics and supplies permitted additions. Do not claim every domain was comprehensively interpreted from absent records. Report domains come from shared reporting.domains and can be extended without a new per-provider store. Existing original field names/headings/languages remain unchanged.

Prepared sources have stable ID, vault-relative path, exact SHA-256, applicable scopes/field identifiers, mixed exposure and detailed/summary/range precision. Metrics distinguish finite values/unknowns, units, ranges, evidence and complete/partial/unknown/unconfirmed coverage. Sections, action states, observations/hypotheses and existing case follow-ups retain source IDs. New consequential plans belong to their advice/review workflow, not an unchecked report-summary field.

## Disclosure and source safeguards

Before reading mixed legacy journals/actions/cases, the collector checks all applicable default/subject preferences, including configured future scopes. If it cannot safely isolate restricted fields or detailed inputs in ranges mode, it skips those bodies and records a neutral coverage gap. No repeat/proxy request or old-file recovery is used to fill the gap. A runtime may supply a properly scoped smaller dataset; this is not permission to relabel hidden actuals.

Normalization excludes items whose current scopes/fields/source exposures are withheld. Used source bytes are checked only after disclosure; finance originals/worksheet aliases also pass the existing finance pre-read gates. Changed/unavailable source-linked rows do not become current data. The exporter rechecks used sources after rendering and before publication. Actual source interpretation, synonym matching, truthful exposure tagging and model context selection remain runtime responsibilities; this is not semantic redaction, encryption or an OS lock.

Archived report metadata is inspected before report/PDF/source-body reads. Current refusal can block model reuse/delivery of an old report even if the file still exists. Old retention and a deletion request are separate. Source changes make an old report historical; explicit --historical permits source-stale viewing only while disclosure and archive integrity still allow it. Do not bypass this through generic file reading or an aliased path. The generated report is derived evidence, not a second profile/memory authority.

## Files, PDF and repeated generation

Default archive: reports/daily/YYYY/YYYY-MM-DD/report-<content-id>/. Preserve report.json, report.md, report.html and report.pdf with bundle.meta.json/publication.json. Content identity includes normalized data/source/policy and renderer recipe; identical successful inputs return the prior version, and material corrections produce another version. Old reports are not overwritten. Publication receipts bind exported file hashes. An interrupted archive may be recovered from identical inputs; tampered bytes require review. Cooperating-process locks do not solve distributed cloud conflicts.

The presentation uses a warm dashboard with locally drawn domain icons, a short action snapshot, full action/coordination cards, compact metric cards, recorded-value charts and domain notes. Human-facing headings can be conversational and lively; data/actions remain primary and long diary narrative stays supplementary. Apply the same hierarchy to standalone HTML; Markdown remains a complete portable text view. No remote illustration, web font or tracking asset is needed.

Human views (PDF, HTML, Markdown) stay simple: no per-item citation labels, source index, file paths or SHA-256, only one closing line pointing to report.json. report.json and bundle.meta.json keep the full source list (IDs, paths, hashes) and per-item source IDs, so `verify` and historical checks are unchanged.

Display only information available in the already permitted normalized report. Hide unknown-only metric cards, domain sections with no items, all-unknown trends and empty action/follow-up/summary/coverage sections in PDF, HTML and Markdown. Explicit zero is a known value and stays visible. A domain with substantive notes or existing actions remains useful even without a numeric total. Do not infer that someone works instead of studying, or treat omitted items as evidence of inactivity. Preserve all original data, unknown fields, domain availability and source metadata in report.json; this is a view projection, not deletion or a profile change. Retain actual source/conflict/partial-coverage warnings and unknown points within an otherwise known trend.

The cover is a selection of up to reporting.cover_card_limit cards (default four), rather than fixed work/study/sleep/exercise slots. reporting.cover_domain_priority normally prefers nutrition, health/sleep and fitness, then other domains with available information. Choose one known metric or sourced note per available domain before filling remaining slots with other known quantities. Diet totals still show partial/estimate/coverage evidence. Without nutrient quantities a sourced food note can appear as a record, without an invented total. Missing slots collapse and sparse reports can share a page. Future configured domains remain eligible; no occupation-based exclusion or new agent is inferred. The shared cover settings are part of every renderer recipe, so changing them creates a new immutable export.

Use only normalized sourced facts for highlights. Decoration and wording must not invent achievements, personal motives, targets, grades, diagnoses or a health/productivity score. Do not turn paused/deferred requests into executable priorities. Display original subjective ratings as their source scale, with no implied target. Human views label only estimates, inferences, unverified records and partial or unknown coverage, in plain words (e.g. "estimate", "partial record"); full evidence/coverage codes stay in report.json. Ranges are not silently reduced to a precise midpoint. Keep partial nutrition visibly separate from full-day intake. Charts preserve gaps and explicit zero, and sleep keeps its waking date. Simple original journal tables can be presented as labeled cells; ambiguous text stays literal and originals remain unchanged.

Missing data and accepted/proposed/completed states remain visibly different. Short cover previews may abbreviate long titles, but the full action content must remain available in the detail pages. Paginate full prose instead of clipping it. Fictional examples are labeled on the cover and continuation pages. Use the shared REPORT_LAYOUT_VERSION recipe for PDF and text-only archives; presentation updates create new immutable bundles and never overwrite previous exports. A PDF is an export of the same structured record; it does not establish activity, booking, diagnosis or suggestion execution.

PDFKit 0.20.2 is an optional renderer installed outside the synced vault from config/runtimes/pdf/ manifests. Run tools/report-setup.mjs with an external runtime directory, or use an existing verified runtime via --runtime/LIFEOS_PDF_RUNTIME. An embeddable Chinese font is required; available OS fonts can be used without copying source fonts. Fonts are embedded into the PDF.

When no runtime is configured the export does not fail: it archives JSON/Markdown/HTML, returns status generated_without_pdf with the unavailable reason and the setup command, and leaves report.pdf absent so a later run with a working renderer adds the PDF to the same immutable bundle. An explicitly selected --runtime or LIFEOS_PDF_RUNTIME that cannot be used still fails, so a mistyped path is never silently downgraded. --no-pdf requests text-only output deliberately and reports generated_text_only. Core scripts remain dependency-free.

No browser activation, online conversion, cloud upload, model API or global npm install is required. Reading/displaying generated PDFs is portable; future generation needs a capable execution environment and appropriate fonts. Raw JSON/Markdown remain readable by replacement models. Deliver a verified permitted PDF to the user using the runtime's artifact/file capability; do not send it to anyone else or only claim an inaccessible machine path was delivered.

## Deployment and verification boundary

Deployment distributes instructions/tools/templates/renderer manifests and initializes only empty report roots. Development samples/runtime packages/previews stay outside the deployable vault under workspace test/. An execution runtime can be separately prepared outside the vault for real use; machine paths and event support are environment concerns, not model/API routing settings. Cloud deployment still requires an explicit user request. Upgrade rules for system files are shared and live in config/CONFIGURATION.md and docs/core/ARCHITECTURE.md.

File/state/source/privacy/PDF tests use fictional inputs. They do not evaluate actual image/OCR extraction, real sleep advice quality, causal explanations, clinical effectiveness, independent expert judgment or multi-year/cloud concurrency. Routine source checks are lightweight; source conflicts and consequential claims follow shared escalation/review requirements. No fixed clock report task is active.
