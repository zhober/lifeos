# Message digests

A digest collects new items from sources the user chose, keeps those that match the user's interests, and reports the best few with the original text, a translation when the original is in another language, and an assessment. Every digest kind uses the same pipeline; kinds differ only in their collector and their personal settings. A student or researcher uses the literature digest; someone in business would fill the news digest with industry feeds. Procedure: `workflows/digest/SKILL.md`. Tool: `tools/digest.mjs`.

## Kinds and settings

`project.json` digest.kinds registers each kind with its collector: `literature` (PubMed journals, bioRxiv/medRxiv, optional feeds) and `news` (RSS/Atom feeds). Deployment seeds `profile/digest/<kind>.json` from `templates/digest/<kind>.json` with `enabled: false` and no interests; nothing about any person's field ships with LifeOS. A kind is used once the user has given interests and sources and it is enabled.

Personal settings (one file per kind):

| Field | Meaning |
|---|---|
| `interests[]` | Dimensions `{id, label, core, method, keywords[], weak[]}`. `core` marks the user's central topics; `method: true` marks a dimension of method words that never qualifies an item alone; `weak` lists generic terms that are shown but never count |
| keyword | A string, or `{term, requires[], unless[], case}`. Whole-word match with an optional plural; `term*` is a prefix; terms written mostly in capitals match case-sensitively. `requires`: the hit counts only with one of these context terms in the same text; `unless`: it does not count when one of these occurs |
| `core_tokens[]` | Short list of unmistakable core terms for the evidence scan behind any "nothing in the core field" statement |
| `strict_journals[]` | Broad journals whose items need a core-dimension hit |
| `exclude_title_prefixes[]` | Added to the built-in non-research prefixes (corrections, retractions, expressions of concern, editorials, replies) |
| `sources.pubmed.journals[]` | `{name, tier 1-4, aliases[], open_access}`; `name` as PubMed's `[Journal]` field accepts it, `aliases` as PubMed reports it (MedlineTA, ISO abbreviation, full title) |
| `sources.biorxiv` | `{enabled, server: biorxiv|medrxiv, categories[]}`; categories compare case- and separator-insensitively |
| `sources.rss.feeds[]` | `{name, url, tier}` |
| `report` | `{cap, translate, full_text, original_label, translation_label}` |

The setup or ask workflow fills the settings with the user, under the voluntary-disclosure policy: research or business interests are optional and kept to what the user states.

## Pipeline

1. **Collect** (`prepare`). Each source has its own window: from the day after its last successful collection to yesterday (first run: `lookback_days`; never more than `max_window_days`). PubMed uses all papers of the listed journals by Entrez date (`[edat]`, which does not lag like the publication date), pages through every result and fetches full records with efetch. The bioRxiv API is paged by its reported total (pages are small). When the bioRxiv API fails, Europe PMC's preprint index for the same window is used and the status says so; when both fail the window stays open for the next run. Requests identify LifeOS; pages that refuse automated access are not worked around. Raw data stays in scratch space (`.lifeos/tmp/digest/`).
2. **Screen** (scripted). Items already seen, in the queue, archived or reported are skipped by PMID, DOI, URL or normalised title. Non-research entries are removed with their reason listed. The rest is matched in two stages, title first, then title and abstract; an item is a candidate when it hits a core dimension or two topic dimensions. Everything else is listed by title for review, because relevant papers can hit no keyword at all. Items with no or a short abstract are flagged. The core-token scan runs over all research items.
3. **Score** (model). Every keyword candidate, and every title-review item the model adds, gets 1-5 with a reason. The scale and its anchors are fixed; the bar does not move with the day's volume.
4. **Queue** (scripted, at finalize). Scored items at or above `queue.min_score` that were not reported wait in `records/digest/<kind>/queue.json` with their full original text; waiting days are counted from the discovery date; items waiting longer than `expire_days` expire; selected items are marked promoted. Promoted and expired entries stay as an audit trail; beyond `max_entries` the oldest of them move to `archive.jsonl`, watching entries never do.
5. **Report** (finalize). Up to `cap` items from today's scored items plus the watching queue, best score first, then longest wait. A selected item needs its original abstract (recovered through Europe PMC when missing), a translation when the original is in another language than the user's, a core finding, a relevance statement and a suggestion. The translation is checked: numbers of the original must reappear and it may not be far shorter than the original, so a summary is refused. Fewer than four items need notes explaining why; zero items need a reviewed verdict for every core-token hit. The tool injects original text, links and all counts; the model writes only translation and assessment.
6. **Full text**. For selected items an open-access copy is saved when an official full-text API provides one (Europe PMC / PMC); otherwise the report links free full text (Europe PMC links, the preprint server page, journals marked `open_access`, Unpaywall when `UNPAYWALL_EMAIL` is set). Paywalled text is not obtained automatically; the user may sign in personally and ask for read-only access in a session.

Finalize is the only commit point: it writes `reports/digest/<kind>/<date>/report.md` and `report.html`, the immutable run record `records/digest/<kind>/runs/<date>.json` (scores, selection, counts, statuses), the queue, `seen.jsonl` and the per-source state. A failed or abandoned run changes nothing, and the next run collects the same window again. A finalized date cannot be redone with different input.

## Source status

Each source reports `ok`, `empty` (valid answer, nothing new), `failed` or `ok_via_europepmc`. A failed source is named in the report with the number of consecutive failed runs and stays in the next window, so "no preprints" and "channel down" are never confused. A day with very many items from one journal issue, many items without abstracts, or zero yield is described with the counts the report already shows; thresholds do not change.

## Adding a kind or a collector

A new kind with an existing collector needs only an entry in `project.json` digest.kinds, a template under `templates/digest/` and a personal settings file. A new collector is a function in `tools/digest-sources.mjs` that returns normalised items `{id, keys, source, title, abstract, url, doi, pmid, journal, tier, published, authors}` and a per-source status, wired in `collect()` of `tools/digest.mjs`; screening, queue and report are shared. Add fixture responses and checks to the development test suite.

## Boundaries

Digests read public sources and the user's own settings; they do not log in, post, subscribe or buy. Reports and the queue are personal data. Interests are kept as the user stated them and are not inferred from other records.
