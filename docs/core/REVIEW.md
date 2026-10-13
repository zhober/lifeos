# Proposal review contract

Use this contract with `agents/critic.md`, `docs/core/ORCHESTRATOR.md`, `docs/core/CONTROL.md`, and `docs/core/MEMORY.md` for proposed advice/plans in any personal domain. The main assistant owns routing, revisions, persistence, and final communication. The critic verifies proposals and material resolutions; responsible domain experts revise substantive domain advice.

## Invocation

Review is required for a panel, an explicit user request to audit a supplied proposal, or consequential advice with unresolved material uncertainty, conflicting evidence, incompatible constraints, substantial time/money commitments relative to the user's recorded circumstances, or meaningful safety concerns. Use the actual recommendation and user context; do not invent universal spending thresholds.

For single advice and weekly/monthly reviews, record the trigger or a concise reason review is unnecessary in request artifacts. Simple recording, calculations, and descriptive daily reviews need no critic. If a daily exchange produces a separate consequential plan, review that proposal as advice without adding experts to the daily-review workflow. System iteration stays with the evolver and project checks.

When asked to audit a supplied plan, pass that plan directly to the critic; a missing proposal requires clarification rather than invention. Keep the critic out of initial domain assessments. Independent review uses a separate agent context when supported; otherwise disclose sequential execution.

## Input and source checking

Apply config/CONFIGURATION.md's Voluntary disclosure and privacy policy before personal evidence/context. Critic review does not authorize asking again for declined health, relationship, financial or other information, loading blocked old values or sending them to another role. Review the permitted packet and disclose decisive gaps; narrow/withhold unsupported recommendations instead of forcing disclosure or bypassing safety/review gates.

Apply docs/core/RESEARCH.md to the critic and evidence collection. A mandatory review can inspect current records, calculations, and decisive source passages with local/lightweight effort. Escalate only a specific hard unresolved question or material source conflict; the review gate alone does not justify a literature survey. Keep missing decisive verification visible and preserve review requirements while the coordinator obtains only the necessary evidence.

Supply the original request/follow-ups, goals/preferences and current constraints, dated full-history evidence, calculations/source rows, domain records and prior action outcomes, external source passages/links and lookup dates, exact expert responses, and the precise deliverable version. Label estimates, hypotheses, obsolete facts, and uncertain dates.

Save immutable versioned targets under `tasks/YYYY/<request-id>/artifacts/`, with stable claim/action labels. Independently inspect material original records, relevant memories, contrary evidence, source applicability, and arithmetic. Expert agreement and copies of one source are not independent corroboration. Search beyond recent statistics when earlier events, attempts, decisions, or outcomes may matter. Missing records do not establish absence or noncompliance.

Follow `experts/_common.md` for external evidence: browse for changing or uncertain external claims, keep searches free of identifying personal details, and preserve citation metadata. Local-record verification does not automatically require browsing. Missing decisive verification may block consequential advice.

For medical claims inspect docs/domains/HEALTH.md's source appraisal alongside the exact supporting passages: authority, claim/outcome certainty and basis, applicability, reading scope, version/correction status, and conflicts. Reject prestige/popularity/quartile-only certainty claims, media summaries substituted for unread originals, and a duplicated source counted as corroboration. Keep provisional model appraisal distinct from a published formal evidence grade; low or unknown evidence cannot be upgraded by expert agreement.

For a confidence increase justified by cross-validation, inspect the original evidence units and synthesis under experts/_common.md. Check shared samples/studies, overlapping reviews/guidelines, contrary/null findings, compatibility of the claims/populations/outcomes, source quality, and the actual rationale for the change. Independent applicable corroboration may strengthen confidence; the number of agreeing URLs or reviewers is insufficient. Keep unresolved independence explicit rather than endorsing a manufactured certainty gain.

## Findings and verdicts

Each finding has a stable ID, severity, category, affected claim/action labels, concrete description, requested change, responsible role, and sources. When evidence is missing, cite the reviewed claim and inspected records and identify the gap; do not invent a source proving the missing evidence.

| Severity | Meaning | Treatment |
|---|---|---|
| blocker | Serious safety issue or a fundamental defect preventing presentation as actionable advice | Resolve/remove the recommendation and obtain reviewer confirmation |
| major | Unsupported material conclusion, decisive evidence gap, infeasible commitment, or material conflict | Correct/remove it or obtain reviewer-confirmed evidence that the objection does not apply |
| minor | Optional refinement without material impact on safe interpretation or feasibility | Reasoned rejection or disclosed deferral is allowed |

Each round returns `pass`, `revise`, or `insufficient_evidence`. A completed critic call is not approval. Important missing inputs use `insufficient_evidence`; minor uncertainty may be addressed in a qualified revised target. Do not manufacture objections or elevate style preferences into blockers.

## Dispositions and final review

The main assistant records `fixed`, `removed`, `rejected`, `deferred`, or `unresolved` for every finding, with a reason and evidence. Return material domain corrections to the responsible expert when needed. The critic separately confirms prior finding IDs as `resolved`, `not_applicable`, or `unresolved` on the new target.

A material issue is not closed merely by the main assistant claiming a fix or the user accepting risk. `fixed`/`removed` material issues need a later final review confirming `resolved`; rejected material issues need a later final review confirming `not_applicable` with evidence. The latest final review explicitly accounts for every earlier blocker/major. A new material finding in the last round needs another final review before approval.

Panels first review collected proposals, then synthesize and review the exact final deliverable. Single consultations and periodic reviews may start with the final draft. A change to the target text or decisive evidence invalidates the old approval. Check synthesis changes, quantities, cumulative demands, assumptions, and disclosures in the actual text the user will receive.

`project.json` sets `review.max_final_rounds`, normally three: the first final review and at most two repair/re-review rounds. At most one preliminary proposal review precedes them. Keep cumulative round history; do not reset the limit through a new packet or task revision. On exhaustion, retain partial results, disclose remaining issues, and wait for necessary evidence or an actual authorized scope change rather than labeling the plan approved. Preserve late results under docs/core/CONTROL.md.

## Review packet

Use `templates/review-packet.json` under the request's `artifacts/`. Packet fields are `schema_version`, `request_id`, `plan_revision`, `trigger`, `target`, `rounds`, and `dispositions`. Include all rounds, consecutively numbered from one. Retain finding IDs uniquely; continued discussion of an existing issue uses a resolution rather than a new ID.

Every target, verbatim critic `response`, and source has a vault-relative `path` and SHA-256 `sha256`. Referenced bytes must still match at checking time; preserve snapshots of mutable evidence when needed. Each round contains `stage` (`proposals` or `final`), `mode` (`independent` or `sequential`), target/response, verdict, sources, findings, and resolutions.

A finding contains `id`, `severity`, `category` (evidence, scope, feasibility, conflict, or safety), `targets` (claim/action labels), `description`, `requested_change`, `owner`, and `sources`. A resolution contains `finding_id`, `outcome`, `reason`, and `sources` and refers to a finding from an earlier round. Each main-assistant disposition contains `finding_id`, `action`, `reason`, and `sources`.

For minor findings left rejected, deferred, or unresolved, include `disclosures` with `finding_id` and an exact `quote` from the final target that explains the remaining limitation. The checker verifies the quoted text is present; the critic verifies it describes the issue adequately.

```text
node tools/review.mjs check <vault-relative-packet.json>
```

The read-only checker reports `passed`, `passed_with_notes`, or `blocked`, validating file bindings, issue accounting, round limits, and request/plan identity. It returns exit code 2 for a valid blocked review and 1 for invalid input. It cannot determine whether the reasoning or evidence interpretation is correct. Passing with notes requires minor-issue disclosures in the reviewed target.

## Task and archive integration

Declare an essential read step with `review_gate: true`, `required: true`, and `waivable: false` after final review/dispositions. To succeed, supply `review_packet` and include that same packet in `artifacts`; the task utility requires a current passing packet. Critic invocations use their own dependencies/attempt identifiers. The gate is a separate validation step.

New personal action proposals are blocked while a declared release gate is unfinished. After passing, the main assistant still checks that each proposed action belongs to the approved final scope; the utility cannot judge that semantic relationship.

For reviewed consultations, pass `review_packet` to `work.mjs archive`. A declared gate makes it mandatory for a final archive. The `summary` must equal the reviewed target bytes. Save every critic round, target version, finding, and disposition. Use `provisional: true` to retain incomplete or blocked output without presenting it as approved; a provisional archive cannot satisfy the gate. Final archives require the declared gate to have succeeded. Archive retries retain the original immutable snapshot even after later state changes.

An explicit audit of an existing supplied plan can finish with an adverse verdict: its objective is to report the review, not release a revised plan. Use expert `critic`, `audit_only: true`, and the complete packet, without a release-gate step. This archive retains the reviewed proposal and full critic output while the user-facing summary reports the verdict. It does not certify the supplied proposal and cannot bypass a declared release gate. A later requested repair/release follows the normal gate contract.

Existing requests without this declaration remain readable and retain historical archival behavior. New triggered workflows must declare the gate; scripts cannot infer whether an omitted review was warranted. Review approval concerns the reviewed portion; missing supporting roles and other task gaps remain governed by docs/core/CONTROL.md.

## Presentation and retention

Return a localized short verdict, priority findings/tradeoffs, and qualified final status. Around 300 Chinese characters or 180 English words is a summary preference, not a limit on full review artifacts. Highlight at most three changes initially while saving every material issue and its sources.

The main assistant persists exact critic text, target versions, evidence, confirmations, and dispositions under the original request. The critic remains read-only. Assessments are not automatically verified personal facts; capture personal facts separately under docs/core/MEMORY.md and retain outcomes for later reviews without projecting obsolete conditions into the present.
