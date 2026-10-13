# Health evidence and longitudinal assessment

Use this contract for symptoms, sleep/mood/stress, health measurements, examination reports, clinical visits, medication statements, and attributed diagnoses. Follow docs/core/MEMORY.md, docs/core/CONTROL.md, docs/core/REVIEW.md, and docs/core/COLLABORATION.md. The health advisor interprets relevant evidence and remains read-only; the main assistant preserves originals and makes authorized record changes. Scripts validate file contracts and arithmetic, not clinical truth.

A simple reported symptom or measurement takes the quick path in `workflows/log/QUICK.md`, which creates the same typed sourced record. Routine morning sleep may use a script-generated descriptive analysis (reported times, duration, user-supplied quality, no interpretation); a health-advisor or model analysis is required when the user reports concerning signs or asks for an assessment.

Apply docs/core/RESEARCH.md before allocating external evidence work. Routine health questions use sufficiently applicable official/primary information and lightweight verification. The medical topic, source-confidence rubric, or importance of a decision does not by itself require a literature review. Escalate a concrete difficult unresolved claim or material credible-source contradiction; missing personal evidence needs clarification/qualification. Preserve required timely professional assessment and freshness checks.

## Capture before interpretation

Retain exact user statements and original documents/images. Use `health.mjs original` for supplied report files; bytes are preserved under inbox/health/ with a content hash. Retention does not inspect images, OCR a PDF, establish ownership, or validate a document's contents. Actually view/parse through the runtime. Keep unreadable or unavailable interpretation pending; retain extracted text separately with its source/page relationship. Do not send private originals to a public search.

Keep a stable explicit subject such as self, another known person's identifier, or unknown. Do not assume an uploaded document describes the user. Unknown subject or OCR/units/dates remains unresolved. Record the source's actual occurrence time and its precision independently of capture time. A retrospectively reported symptom does not begin today. Preserve month/year/range bounds and unknown dates instead of guessing a day.

Save immutable versions through `health.mjs record`. Core fields are operation_id, kind, title, subject, evidence (reported/documented/estimated), review_status (reviewed/pending), extraction_confidence (high/medium/low/unknown), occurrence bounds/precision, details, sources, and optional case_ids/related_record_ids. Correct by record_id and supersedes pointing to the exact latest path; use a new operation ID. Retraction preserves old versions. A changed subject or record kind requires retracting the misassigned record and creating another. Identical retries retain the exact original capture even after later corrections or source changes.

`state: active` means the stored record has not been retracted. It does not mean a symptom, diagnosis, restriction, or medication is active today. Interpret actual course, occurrence, and applicable dates from the sources. Never project an old taking/resolved statement forward without evidence.

## Typed records

| Kind | Retained details |
|---|---|
| symptom | Exact description, location, onset/ongoing/recurrent/resolved/unknown course, frequency, reported severity/scale, possible triggers, accompanying observations, attempted measures, and known resolution date |
| measurement | Name/code, original numeric/text/unknown value, comparator, explicit unit, specimen/method, report-provided range/unit/flag, and relevant population/context |
| report | Lab/imaging/examination/other type, original summary, issuer/context, and linked individual measurements |
| visit | Reported reason, attributed clinician summary, original recommendations, linked reports, and documented follow-up date |
| medication | Name, prescribed/reported_use/planned/unknown statement, actual-use status, explicit dose/unit/route/frequency when known, prescribed date, and actual-use dates when reported |
| diagnosis | Attributed name and clinician_confirmed/clinician_provisional/patient_reported/refuted/unknown verification, exact clinical passage and context where applicable |

Details may retain further original source fields without inventing unknown values. Numeric severity requires an explicitly reported 0-to-10 scale; this is a recording convention, not a triage threshold. Numeric measurements and report ranges require explicit units. Preserve values such as less-than results as qualified values, not exact points. Different units, methods, specimens, populations, or reference ranges need contextual review; do not supply a generic normal range from memory. An out-of-range source flag remains that report's flag, not an automatically inferred diagnosis.

A prescription or plan does not establish actual use. Record actual-use changes separately with their evidence; do not infer adherence, discontinuation, causation, or adverse effects from a gap in logs. The utility does not recommend starting/stopping medications or changing doses.

Clinician diagnosis status requires documented evidence, attributed context, and a captured exact quotation from retained readable clinical text. For a scanned report retain the original and extracted text first. A patient's recollection of a clinician's statement remains patient_reported with its original wording. A model explanation is a case/memory hypothesis, not a diagnosis record. Source hashes/quotes verify traceability rather than the credentials, authenticity, or correctness of a source.

## Retrieval and assessment

For external source assessment follow the detailed rubric below. It supplements the shared source classes without turning publication venue or a source's identity into a clinical conclusion.

1. Read the original question and applicable profile/goals, relevant health sources, prior advice/actions, and existing constraints. For a compound capture/advice request, persist the observations first.
2. Use shared memory and health timeline across all retained years. Link repeated records under a generic case when the evidence supports treating them as the same ongoing question. A months-old resolved episode may be relevant history without being current illness. Check exact timing, contrary evidence, and uncertain dates; record links do not establish causation.
3. Read recent sleep/mood/stress/energy and related nutrition/activity data, usually around fourteen days, with sample counts and gaps. Missing logs do not establish absence, recovery, or nonadherence. Use docs/domains/NUTRITION.md's full-day/source/uncertainty rules before drawing dietary conclusions.
4. State the current question, observations, plausible explanations, limitations, and decisive next information. Avoid a large speculative disease list. Ask at most one or two important missing questions at a time. For possible immediate danger, prioritize appropriate timely professional assessment under current authoritative guidance rather than routine coaching or delayed agent rounds. This project supplies no validated automated triage service.
5. Verify changing/uncertain health, drug, supplement, condition, guideline, and reference-range claims using authoritative original sources. Keep searches general and free of identifying personal details. Save titles, URLs, evidence levels, applicability, and lookup dates. If verification is unavailable, retain that limitation and avoid consequential unsupported conclusions.
6. Request nutrition/fitness/other expertise through the main assistant and docs/core/COLLABORATION.md. Keep shared observations, each expert's assessment, and clinical source conclusions distinct. Expert agreement or two citations to the same original is not independent corroboration. Return material conflict/uncertainty for review under docs/core/REVIEW.md.
7. Give normally at most three practical recommendations, with evidence, responsible role, and suitable follow-up. Track proposal/acceptance/execution separately through existing actions; capture dates and unknown outcomes honestly. Revisit prior ineffective methods before repeating them. Follow-up reminders are stored records, not an autonomous scheduler.

Use shared memory for selected sourced facts/episodes with health-record and case entities. A single relevant observation can be retained immediately; longitudinal personal patterns still need the shared evidence span. Supersede corresponding old memories when facts actually change. Case hypotheses remain inferred, including when an expert labels one supported. Avoid a second health-only memory database or copies of the same original fact in each expert's directory.

## External source appraisal

Appraisal depth follows docs/core/RESEARCH.md. Check identity/provenance, relevant passage, version and applicability for a routine direct answer; a suitable current guideline can be sufficient. Detailed paper methods, extensive source lineage or a body-of-evidence synthesis are for justified deep work. Retain reading scope and unknown/unassessed fields instead of chasing every template field. The rubric determines how to judge used evidence, not a requirement to retrieve every source type.

Evaluate each consequential externally supported claim, not just the page or author's reputation. Keep three separate assessments: source authority, certainty of evidence for the particular claim/outcome, and applicability to the current question/person. These are distinct from a personal report's OCR/extraction confidence or a meal's portion uncertainty. Never invent a calibrated percentage or combine these dimensions into an arbitrary numeric score.

| Source | Discovery preference and required checks |
|---|---|
| Official clinical guidelines or recognized professional-society recommendations | Prefer the applicable current official version. Check issuer, scope, population, development methods, evidence grade, recommendation strength, updates, and conflicts. Consensus-based or weak recommendations remain labeled accordingly. Official publication alone does not establish high certainty for every statement. |
| Systematic reviews, meta-analyses, and evidence syntheses | Prefer rigorous question-relevant syntheses. Check search/selection methods, underlying study quality, overlapping data, consistency, precision, and applicability; retain published certainty ratings when available. A meta-analysis label alone does not establish high quality. |
| Peer-reviewed primary research, including reputable medical journals | Prefer relevant rigorous studies and use reputable venues to guide discovery. Check design suited to the question, sample and controls, bias/confounding, outcome relevance, effect uncertainty, limitations, replication, and correction/retraction status. RCTs are particularly useful for many intervention questions; other designs may be necessary for diagnosis, prognosis, rare harms, or long-term outcomes. |
| Verified clinician/specialist articles or advice | Verify identity, institution, relevant specialty, date, supporting references, and conflicts. Distinguish institutional evidence-based education from expert commentary or personal experience. Trace cited guidelines/studies to their original sources. A famous clinician's unsupported opinion remains opinion. |
| Public accounts, short videos, forums, anonymous articles, or commercial promotion | Default to lead-only when provenance, methods, or evidence are unclear. Locate the original guideline/study before using the medical claim as advice support. Verified official or institutional accounts can carry credible material; evaluate the original content and publisher separately from its distribution platform. Popularity, follower counts, editing quality, and repost frequency do not raise certainty. |
| Weak-methodology, preliminary, non-peer-reviewed, corrected, or retracted work | Record limitations and current status. Preliminary/weak evidence can identify questions but needs appropriately qualified use and corroboration. Do not use retracted claims as current support; preserve them as historical/contrary context when relevant. |

Journal quartiles and impact factors are optional discovery metadata. If used, retain the ranking scheme (such as JCR or CAS), year, subject category, value, and verification source; schemes/years/categories must not be conflated or guessed. A Q1 paper is not automatically strong evidence, and Q2/Q3/Q4 papers are not automatically weak. Methodologically strong and relevant research remains eligible regardless of quartile. Do not discard lower-ranked papers solely because of venue, or let an elite journal/editorial or celebrity override applicable stronger evidence.

For source authority use high/moderate/low/unknown with a stated reason. For claim certainty use high/moderate/low/very_low/unknown with a stated reason and basis: published_rating, provisional_appraisal, or unknown. Preserve a published GRADE or other rating exactly with its method and claim/outcome; do not call an informal model appraisal formal GRADE. Individual papers and expert opinions cannot independently supply a body-of-evidence grade merely from their design or prestige. For applicability use direct/partial/indirect/unknown, explaining differences in population, condition, intervention, outcome, time, and setting.

Retain the exact supported claim and reading scope (full_text, relevant_sections, abstract_only, or not_accessed). A search snippet, inaccessible paper title, or unread citation cannot be described as fully appraised evidence. Mark decisive missing methods/results as needs_verification, and do not infer details behind a paywall. Older sources are not automatically obsolete; verify relevant updates. A newer isolated study does not automatically supersede an established synthesis. Conflicting guidance/research needs reasons, dated applicability, contrary evidence, and review instead of selecting the most famous or newest source.

Use decisions are eligible_support, limited_support, lead_only, do_not_use_as_evidence, or needs_verification. Low/unknown certainty cannot be promoted through repetition, copied posts, expert agreement, or the absence of better results. When adequate applicable evidence is unavailable, retain the gap and qualify/defer the consequential recommendation. Personal treating-clinician instructions remain attributed personal records under the existing diagnosis/visit contract; this external-literature rubric does not automatically validate, dismiss, or override that care.

Use templates/health-source.json to retain each source/claim appraisal in the expert/shared knowledge entry or an immutable request artifact. Record title, URL/DOI, publisher/author, provenance and channel, publication/update/access dates, source type, each appraisal/reason, published grade/recommendation strength when present, limitations, conflicts, reading scope, and current version/correction status. Use null/unknown for unverified facts. Shared references point to one original source; multiple articles summarizing the same study are not independent corroboration. Source/appraisal changes relevant to a case require preserved revisions and reassessment under docs/core/COLLABORATION.md.

In user-facing advice briefly identify the decisive source type, evidence certainty, applicability, and main caveat; preserve full metadata in files. Translate labels into the interaction language. This rubric is qualitative model reasoning, not a new automated medical evidence scorer.

For several sources supporting the same claim, apply experts/_common.md's cross-source corroboration procedure and templates/evidence-synthesis.json. Independent credible evidence can strengthen a provisional claim appraisal; overlapping studies, reposts, shared bias or incompatible populations cannot be treated as additional independent confirmation. Preserve contrary/null findings, the independence/overlap rationale, and unchanged or reduced certainty when warranted. Keep the resulting external-evidence synthesis distinct from a patient's diagnosis and from source-published ratings.

## Commands

```text
node tools/health.mjs original <input.json>
node tools/health.mjs record <input.json>
node tools/health.mjs show <record-id>
node tools/health.mjs timeline [--case ID --subject ID --from DATE --to DATE --history]
node tools/health.mjs compare <measurement-id> <measurement-id>
```

Use templates/health-record.json and health-original.json, with typed examples in templates/health-details.json. Record paths are records/health/entries/YYYY/<record-id>/versions/. The timeline defaults to all retained years, separates unknown-date records even under a date filter, and can retain superseded/retracted history with --history. A case filter also follows explicit case evidence references, so linking an existing record does not require rewriting it.

`compare` uses current reviewed, traceable, non-estimated, unqualified numeric measurements with the same subject/name/unit/specimen/method. It returns only arithmetic delta and incompatibility reasons. Preserve each report's range and clinical context. A compatible software comparison is not evidence of clinical significance. Low/unknown extraction confidence, pending review, changed sources, and retraction remain visible in record limitations.
