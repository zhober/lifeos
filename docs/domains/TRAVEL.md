# Travel planning, evidence and continuity

Use agents/travel-planner.md with experts/_common.md and the shared disclosure, research, orchestration/control, memory, collaboration and review contracts. The expert is read-only; the main assistant preserves originals, checks sources, applies authorized file writes and tracks outcomes. Models and execution tools remain replaceable.

travel.mode is research_and_advice_only and travel.login_handled_by is user. Main assistant and delegates do not reserve/hold/book, purchase/pay, change/cancel bookings, rent vehicles, submit entry/visa/insurance forms or message others through this role. Selecting a plan, critic approval or login does not authorize those actions. User authentication stays outside the synced vault. No credential, cookie, document-number or global provider configuration is needed here.

## Scope, privacy and research

Choose only relevant discovery, route comparison, full-trip, single-day, nearby-gap, logistics, affected-plan revision or review work. Apply config/CONFIGURATION.md's Voluntary disclosure and privacy policy before asking or retrieving travel, location, identity, finance, health or companion context. User-provided city/area, budget bands, anonymous companions and functional constraints can be enough; no complete profile, exact location or document upload is required. Ask at most two decisive optional questions. Do not recover refused fields through another expert, historical files or a proxy question.

Language/timezone does not identify departure, nationality, residence, passport or currency. Missing eligibility details remain unknown; give general official-check pointers or clearly hypothetical options rather than a personal entry/driving/insurance verdict. Preserve persistent versus request-only restrictions in the shared convention. A refusal limits precision, not useful permitted work or automatic waiting.

Use docs/core/RESEARCH.md's local/lightweight-first rule and concrete escalation conditions. Reuse applicable source checks while checking changing material information for actual route/date/variant conditions. Venue/operator/property/government/embassy sources support relevant original schedules/terms/requirements; inspected local and traveller community material supports experience leads, crowding, food and practical usability. Attribute dates, reading scope, independence, contrary evidence and uncertainty. Reposts, expert agreement and source counts do not establish independent verification.

Do not reuse source projects' dated visa/refund/tax/clinical examples, fixed timing rules or author-specific pace as current facts. Beyond a reliable forecast window, use explicitly labeled seasonal climate evidence. A timetable is not seat inventory, a map link is not a verified navigable/accessible route, and a quoted rate is not a booking. Browsing failures remain gaps after a reasonable alternative, not indefinite retries.

## Authoritative record locations

| Location | Meaning |
|---|---|
| tasks/YYYY/<request-id>/request.json and events | Exact requests, messages, execution/control and source evidence under existing tools/work.mjs |
| tasks/YYYY/<request-id>/artifacts/travel-plan-<id>-v<version>.json | Versioned normalized design from templates/travel-itinerary.json; an artifact is a proposal, not adoption or actual travel |
| Task artifacts/travel-check-<id>.json | Saved tools/travel.mjs check output tied to the exact design hash and assessment date |
| Task artifacts/travel-checkpoint-<id>.json | Versioned continuation pointers from templates/travel-checkpoint.json |
| inbox/travel/ | Authorized original bytes and source notes retained by main-assistant filesystem capabilities; no dedicated importer/OCR/original-retention CLI |
| records/travel/index.md | User-owned pointers to trips/tasks/plans/sources, without a second copy of history |
| actions/, advice/, memory/entries/ | Proposed user actions, sourced status/outcomes, complete consultations and permitted long-term facts/events |
| experts/travel-planner/ | Checked reusable external reference knowledge, not private travel profiles |

The active travel contract uses existing generic task/action/memory storage. There is no separate typed travel database or automatic current-plan selector. Template/checkpoint state interpretation, actual privacy classification and source truth/freshness are main-assistant/model responsibilities. Original byte retention and photo/PDF/text interpretation depend on available runtime tools; preserve unknown/pending interpretations instead of invented extraction. Do not store full identity documents/credentials when a permitted anonymous excerpt suffices.

## Design, selection and actual evidence

Keep one trip_id across related requests and versioned plan_id designs. A design has explicit personal/hypothetical basis, subject, objective, requested date bounds, optional origin/destinations, assumptions, constraints, sources and selected items. Hypothetical examples use subject example and never become real financial/travel facts. recorded_at is actual capture time; trip from/to is proposed travel time, not proof of occurrence.

Save a new plan version for a substantive change, with an exact preceding artifact path/hash in supersedes. Use a new filename, stable operation ID and files.mjs write with expected_hash: null; preserve the old version. Store full expert originals separately from the concise design. Do not overwrite an accepted plan or infer that an unselected revision replaces it. Keep alternative routes/options outside the selected items list until chosen, or in separate candidate designs.

Adoption points to the exact design hash plus actual user-selection evidence in a checkpoint/action. Latest proposed and adopted pointers may differ. User selection, reported booking, cancellation, actual activity and outcome need their own source pointers; accepting the whole route does not establish everybody's consent, a paid reservation or any completed visit. Only supported reports/documents update actual states; dates passing or assistant step completion do not do so. A changed source or hash requires rechecking, not silent repair or substituting a latest file with the same title.

For itinerary-linked actions, include the exact design/item/selection in source artifacts and retain outcomes through work.mjs action-create/action-update. No proposed booking/visit/packing task is considered accepted/completed without appropriate evidence. The main assistant handles permissions independently of action-state labels; financial/shopping/travel transactions remain outside this role.

## Normalized items and arithmetic

templates/travel-item.json and travel-price.json describe selected items. Stable item IDs and anonymous track IDs prevent confusing separate places/participants. source_indexes point into the design's retained source_references; declared verification needs a date and pointer, but the checker does not certify that declaration. checked_on/valid_until describe supplied evidence dates, not automatic freshness windows; recheck material current conditions near actual decisions.

Use exact ISO timestamps with offsets and explicit IANA start/end timezones. Cross-zone transport can have different departure/arrival zones; local dates may move backward while elapsed time still moves forward. Timing basis is fixed, estimated or unknown. blocks_time declares whether the item occupies its schedule track: lodging occupancy, optional extras or an activity inside a transport segment must not automatically block all other activities. Separate simultaneous groups into actual anonymous tracks rather than disguising conflicts. Unknown times, occupancy or buffers stay unknown.

Dependencies identify items in this exact design and a stated buffer_before_min. Include applicable access, transfer, security, queue, baggage and rest needs rather than universal default buffers. Supplied operating windows are checked as intervals, not verified against real venues. Unknown route/access duration needs runtime verification or a qualified alternative.

Cost status is quoted, free, included or unknown. A quote declares canonical cost_id, currency/scale, amount in safe integer minor units, positive billable quantity, unit, mandatory-charge completeness, eligibility, check date and optional expiry. Quantity explicitly means the number of billable units: for per_room_night use the stated room-night count; the script does not infer travelers/rooms/nights. Free/included classifications need supported meaning. Included components point to their parent and do not add another charge. A shared cost ID represents a supported same canonical charge, never a heuristic amount/name match.

```text
node tools/travel.mjs check <permitted-normalized-plan.json> [--as-of YYYY-MM-DD]
```

The read-only utility validates schema, source-pointer shape, date/time/zone consistency, dependency/inclusion graphs, supplied operating windows and schedule-track overlaps. It reports structural timing conflicts, unknown inputs and declared expired/future checks. Exact price products/sums use BigInt intermediates and reject overflow; duplicated identical cost identities count once, conflicting identities are excluded and remain gaps. Prices stay grouped by currency, with one scale per currency and no FX conversion. Quoted subtotals are not actual spending; complete selected-plan totals require explicit coverage and no relevant cost/source-declaration gaps. Ineligible prices are excluded, and missing amounts/quantities/mandatory charges are not zero.

The checker examines only the caller-selected normalized input; it does not read source contents, retrieve a profile/history, detect sensitive prose, verify fresh source hashes, determine adoption, validate actual routes/availability or execute external actions. Apply disclosure before supplying or reading the input, and verify sources separately before release. Passing schedule arithmetic with incomplete data is a qualified result, not a feasibility or booking guarantee. Generic files.mjs and arbitrary runtime file access are not privacy access locks.

CLI output includes input_sha256 for the exact supplied file bytes. Save the output and bind it to that design/version before release; changing the design requires a new check. This checksum does not validate its referenced source contents or the truth of the input declarations.

## Continuation, revisions and review

Create a new travel-checkpoint under task artifacts on a material update, pause or completion. Retain latest_proposed_plan_reference, adopted_plan_reference, selection/source/original-turn evidence, exact check output, reported bookings, actual activities, cancellations/outcomes and fixed/affected/completed item IDs. supersedes points to the preceding checkpoint path/hash. Source hashes identify exact artifacts; do not copy all private amounts/identity/location into a summary for convenience.

On takeover, apply disclosure, inspect original source/control state, check hashes and actual applicability, and reuse only a valid checkpoint. For a disruption, capture the exact report and new permitted area/time/constraint, identify downstream dependencies, preserve completed/fixed/unaffected portions and draft a new affected-plan version. Label any unknown booked/visited/changed state. A checkpoint describes continuation; docs/core/CONTROL.md remains authoritative for waiting, pause/cancel, attempts, plan revisions and closed-request follow-ups. Optional refused data does not force a waiting state.

Dates/deadlines are not scheduled alarms. There is no automatic weather/delay monitor, notification trigger, calendar account or booking manager. A future export/render is derived from the authoritative design and should not become a second editable source. Current output can be Markdown/JSON with useful source/map links; no images, themed page or external key is mandatory.

Use shared cases for only necessary financial, health/fitness, dietary, equipment or companion-negotiation questions. Main assistant provides minimal permitted evidence; role agreement does not confirm eligibility or availability. Current generic case hash checks detect referenced file changes; changed linked source/selection applicability also requires coordinator inspection under this contract, not a travel-specific automatic case resolver. Use docs/core/REVIEW.md for existing triggered panels/consequential or materially uncertain decisions. Small nearby suggestions need proportionate checks, not an automatic literature review.

Long-term memory uses travel and relevant domains with trip/person/place entities, actual occurrence/validity, sources and correction links across retained years. An unused plan is not a visit. Reuse permitted actual preferences and outcomes; single anecdotes do not establish persistent patterns. Store travel-clinical evidence through docs/domains/HEALTH.md, financial actuals through docs/domains/FINANCE.md and shopping evidence through docs/domains/SHOPPING.md rather than duplicating their authority.

Local file/arithmetic/continuation checks establish utility behavior and saved classifications. They do not evaluate live recommendation quality, truthful source tagging, current travel rules, navigation, inventory, privacy enforcement by a selected model or successful travel outcomes.
