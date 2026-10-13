# Personal finance worksheets and advice

Use agents/finance-advisor.md, experts/_common.md and shared privacy, orchestration/control, memory, collaboration, research and review contracts. finance-advisor reads permitted evidence and advises; the main assistant captures originals, writes local records and tracks user-reported actions. Models/APIs remain replaceable.

finance.mode is analysis_and_advice_only. Neither the main assistant nor delegates access financial accounts, trade, transfer funds, pay bills, borrow, cancel contracts or file taxes through this role. User acceptance, a price match or critic approval does not authorize those actions. docs/domains/SHOPPING.md's no-purchase/payment boundary also applies. Runtime endpoints, secrets and connection settings stay outside this vault.

## Voluntary input and scope

Apply config/CONFIGURATION.md's Voluntary disclosure and privacy policy before questions, source selection or retrieval. Personal financial fields remain optional; general guidance needs no complete profile or bank statement. Use anonymous subject/account/flow aliases and the user's chosen exact, approximate or hypothetical inputs. A refusal cannot be recovered from another role, old file or proxy question.

Select only needed bookkeeping/cashflow, balances, budget, goal/debt, scenario or review work. Missing private values stay null; they do not become zero, guessed salary, invented holdings or a wait for mandatory disclosure. Named currency/scale and periods are needed only for meaningful specific money calculations; otherwise give qualified general or clearly hypothetical help. Interaction language does not establish currency, residence or tax jurisdiction.

## Originals and normalized worksheets

Use finance.mjs original for authorized local CSV/XLS/XLSX/PDF/text/JSON/images. Bytes/hash are preserved under inbox/finance/ with an immutable .meta.json exposure descriptor; no parser, OCR, bank connector, HTML execution or upload is provided. Default original exposure includes raw_statements and common financial/account fields. A permitted narrower declaration is possible only when the source actually fits it; do not relabel a hidden statement to bypass refusal. Do not request credentials/full account numbers or print unnecessary identifiers in titles, aliases, quotes or replies.

Runtime/model extraction uses only allowed evidence and retains exact source excerpts/rows/units, extraction limits and subject. If inaccessible or uncertain, preserve pending/unknown status. The public double-entry-generator remains an optional researched converter, not an installed dependency or proof every current export is supported.

Use finance-record.json and a finance-details.json shape with finance.mjs record. All local worksheets are immutable versions under records/finance/entries/YYYY/<id>/versions/. A worksheet is a selected evidence snapshot, not an automatically synchronized global ledger. Kinds:

| Kind | Input and interpretation |
|---|---|
| cashflow | One explicit period/currency; sourced canonical flows, actual/planned distinction and income/expenses/cash coverage |
| balances | Dated assets/liabilities; anonymous item identity, aggregate/item distinction and coverage |
| budget | Proposed/accepted limit and optional reported spending with actual coverage |
| goal | Proposed/accepted target, optional dated current saving and fixed contribution |
| debt | Stated principal/payment/fee and nominal annual basis-point rate; conditional monthly amortization model |
| scenario | Explicit assumptions, exact or range inputs and horizon; conditional fixed cash-flow comparison |

basis personal describes user/household/anonymous-person inputs; hypothetical requires subject example and inferred evidence, and never becomes observed personal money. Model proposals/forecasts remain inferred, not verified cashflow/balance facts. Unknown quantities are null; monetary ranges are retained in scenario range fields or original artifacts rather than substituted by an exact midpoint.

All records need a generic title, explicit anonymous subject, evidence class, source review/extraction confidence, actual occurrence bounds/precision and durable sources. recorded_at is capture time. Corrections use the same ID, exact latest supersedes and a new operation; kind/subject/personal-example identity do not silently switch. Retract a wrong assignment before a separately identified correction. Exact origin provider/key prevents duplicate canonical worksheets when permitted identity is supported; no heuristic date/amount-only match proves an event.

Separate exposure sidecars contain schema/kind/basis/scopes/field identifiers and the exact version path, without monetary values. The tool checks saved refusals before reading a stored worksheet's contents, validates checksums/exposure consistency and does not resurrect an older allowed version when the latest is withheld. Additional privacy scopes/fields are required for sensitive titles/excerpts/context not represented by known structured fields. This is a structural gate and caller declaration, not automatic semantic redaction, encryption or an OS lock.

The saved general mode also blocks personal worksheets and financial-original reads/capture through these helpers; genuinely hypothetical examples remain possible. In ranges mode, the caller must choose only volunteered approximate/range/anonymous summaries and declare their exposure accurately. The utility cannot determine whether a supplied amount or prose is genuinely approximate, anonymous or fictional. Generic file tools and arbitrary runtime reads are not an access-control boundary; apply the shared policy before calling them as well.

Data and exposure metadata are separate immutable writes. An interrupted capture blocks normal collection use until the identical authorized operation recovers its descriptor. Do not delete or overwrite incomplete files, guess exposure metadata or silently loosen restrictions. Replayed receipts preserve the original capture; they do not certify current evidence freshness.

## Exact calculations and limits

Use finance.mjs amount for unsigned decimal strings with explicit currency/scale 0..4; extra precision, exponent notation, separators and unsafe results are rejected. Monetary cells use nonnegative safe integer minor units or null. Derived sums, differences and ratios use BigInt intermediate arithmetic; signed results are explicit. Currency format is checked, not exchange-converted or inferred. Compare currencies separately.

finance.mjs calculate uses one selected worksheet or a newly supplied permitted normalized input. It labels personal/example basis and evidence/preview status. Source changes, retraction, pending review, uncertain extraction and explicit historical versions remain visible. Arithmetic does not establish truth, full coverage, affordability, tax accuracy or a future result. Do not add independent/overlapping worksheets together; choose/revise a canonical period snapshot or explicitly reconcile its underlying sources first.

Cash-flow rows require an anonymous canonical flow ID or remain unresolved. Preserve duplicates as source reports; identical identities/values are counted once, conflicts stay gaps. Each row explicitly describes an event with actual date or an aggregate with its true period, never an invented payment day. Aggregate/event overlap is excluded; multiple category aggregates need distinct supported categories and explicit disjointness. Unknown date/value/type/identity does not advance full-period totals.

Types income/expense/refund describe recognized economic income/spending/refunds. Each row declares cash_effect true/false/null independently: a posted credit-card purchase can be an expense with no immediate own-cash movement, while later principal settlement is debt_out with a cash effect and no second expense. Unknown cash effect limits cash totals without erasing known economic categories. Own-account transfer is excluded only under explicit consolidated_cash scope; third-party payments are not own transfers. debt_in/debt_out and investment_in/investment_out are principal cash movements, not earned income/consumption. Interest/fees are expenses when supported. Refunds are their own actual flows, not another copy of the purchase; retain original links in source artifacts. Period refunds can relate to earlier purchases. No bank posting/classification is automatically verified by the script.

Recorded subtotals are separate from complete-period income/net spending/cash changes. Full-period results require explicit source-backed coverage and no relevant unresolved gaps. Reconciliation uses declared opening/closing consolidated cash and complete flow coverage; a difference is unexplained evidence, not permission to add a balancing transaction. Planned bills, expected salary, accepted budgets and forecast contributions are not actual payments.

Balance calculations use one stated valuation date and currency. Unknown/stale/mismatched values remain gaps. Do not add an aggregate total to its component items or conflicting identities. Only complete source-backed asset/liability coverage yields complete net worth; a recorded subset is not the user's total wealth. Asset valuations and loan balances do not update themselves.

Budget comparisons distinguish remaining against reported spending from complete-period remaining. Goal months assume fixed stated contributions, no returns/inflation/withdrawals and known target/current values; missing inputs stay unknown. An accepted goal is not a saving outcome.

Debt calculation models only nominal annual basis-point rates with monthly compounding, half-up interest rounding to the declared minor unit, fixed payments, explicit upfront fees and 1..1200-month horizon. It reports missing inputs/non-amortization/horizon limits; it does not model APR/variable rates, penalties or unstated contracts. A modeled repayment is not a payment or guaranteed payoff date. Assess actual contract applicability and affordability separately.

Scenarios support exact values or ordered minor-unit ranges, with explicit months and assumptions. Output is a conditional ending value/range from fixed income/expenses and stated one-off costs. It is not a simulation, market-return forecast, calibrated probability, tax engine or retirement guarantee. More complex requested models require separately verified inputs/implementation, not an invented result.

## Advice, memory and coordination

Use scripts for material math; use docs/core/RESEARCH.md's retained/local or focused lookup for changing/uncertain product/rate/tax/insurance facts. Taxes/insurance/investments/retirement remain optional source-grounded expert questions, with actual jurisdiction and contractual terms checked when needed. Do not import foreign defaults, universal reserve/asset-allocation ratios or financial health scores.

Record full advice/proposals/acceptance/actual user changes/outcomes through current tasks/actions and consultation archives. Use finance-checkpoint.json for versioned source/worksheet pointers, assumptions and pending questions under task artifacts; preserve older checkpoints and original replies. docs/core/CONTROL.md governs waiting/resume, pause/cancel and linked follow-ups. Dates do not schedule reminders. Do not pressure disclosure or waive safety/review gates because private data is missing.

Shared memory retains selected permitted facts/events/decisions with finance-record:<id>, goal/person entities, actual occurrence/validity and source/version/correction links across years. No second financial profile or SQLite authority is introduced. Use privacy before retrieval, inspect original current evidence and compare actual equivalent periods. A suggested cancellation is not a cancelled subscription, and a recurring charge is not automatically fraud.

Shopping supplies product/quality/eligible-price facts, finance affordability/cash-flow effects, career work/income assumptions, and psych-coach interpersonal meaning/shared-expense negotiation. Main-assistant cases route only distinct necessary questions and reassess changed/retracted/withheld finance inputs. Hypothetical sheets and expert agreement do not verify personal financial facts. Apply docs/core/REVIEW.md for panels/consequential or materially uncertain plans, not every ordinary recording/calculation.

## Commands

```text
node tools/finance.mjs amount <money-input.json>
node tools/finance.mjs original <original-input.json>
node tools/finance.mjs record <record-input.json>
node tools/finance.mjs show <record-id-or-exact-version-path>
node tools/finance.mjs calculate <record-id-or-exact-version-path>
node tools/finance.mjs calculate <new-normalized-input.json>
node tools/finance.mjs list [--history] [--kind KIND] [--subject SUBJECT]
```

List returns only permitted worksheet metadata, not all financial values or private-record counts. These tools perform local retention/read/arithmetic, not banking, trading, payments, automatic imports, forecasting services or live financial advice evaluation.
