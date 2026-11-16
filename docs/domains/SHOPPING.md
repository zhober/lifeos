# Shopping offers, experience evidence and ownership history

Use experts/_common.md and the shared orchestration, memory, control, collaboration, review and research contracts. shopping-advisor reads evidence and advises; the main assistant saves it; scripts validate records and explicit arithmetic. Models/APIs are replaceable, and personal files remain authoritative.

## Need and source discovery

Reuse purpose, budget, usage frequency, owned items and preferences. Ask only decisive missing questions, normally at most two. A purchase is not required to solve a need; compare keeping/repairing/reusing an item when relevant.

Channel scope is configured, not assumed. Resolve it with `node tools/settings.mjs show`: the user's preferences.shopping marketplaces/experience_channels, else nonempty project.json shopping lists, else unset. When unset and channel scope matters, ask once which marketplaces the user buys from (and, only if needed, their region or currency under the voluntary-disclosure policy); save an actual answer with `node tools/settings.mjs set marketplaces <a,b>`. A skip leaves discovery to official manufacturer pages and widely available retailers for the stated context, labelled as such. Free-form personal shopping preferences stay in experts/shopping-advisor/preferences.md. Channel identifiers are lookup scope, never connections or authority. Compare actual seller, SKU/specification, region, condition, quantity and warranty. Do not infer authenticity, reliability or price advantage from platform identity alone.

For specific products, use targeted community queries on the user's configured experience channels (for example Xiaohongshu, Zhihu or Bilibili for Chinese-language users; Reddit, YouTube or specialist forums elsewhere), alongside suitable official specifications and tests. Search exact model/variant plus actual use case, long-term use, problems, return/repair or alternatives. Select a small useful set, inspect originals, and stop under docs/core/RESEARCH.md. No every-platform quota or default heavy literature task.

Save author/title/original link, publication/lookup dates when known, inspected scope/location, product applicability, actual usage duration/test method and conditions, sample limitations, promotion/sponsorship knowledge and conflicting findings. An owner report may be useful for comfort/noise/usability; a personal anecdote does not establish a failure rate or safety guarantee. No disclosure does not prove no sponsorship.

### Experience posts versus promotion

Classify every community source before using it, from its body and account, not its title:

- **Official**: the brand or platform's own notice or page. Use for rules, thresholds and validity; the checkout page still decides the final price.
- **Real experience**: specific and checkable details (actual amount paid, what was bought, size with the buyer's height/weight, use duration), mentions drawbacks or returns, no purchase links or "claim in my profile". Treat as an anecdote about one buyer.
- **Opinion/seeding**: a person's picks with some detail but no proof of purchase, or an account posting many same-template guides with stacked hashtags. Prices and claims are leads to verify.
- **Promotion**: brand/official or merchant accounts, "deal / saving / welfare" aggregator accounts, hype titles in the user's language ("must-buy", "buy without thinking", "top picks", "steal", "price crash"), coupon-claim links, only praise, stock photos, a sponsorship tag. Not evidence of price or quality.
- **Lead**: a title or snippet not actually read.

Absence of a sponsorship tag does not prove no sponsorship, and one real experience does not establish a trend. Deal-aggregator articles (for example SMZDM) often carry affiliate links; use them to find items, then confirm on the official page. Record the classification and the reason with each source in the report.

### Coupons and basket arithmetic

Take rules from the platform's own coupon notice: threshold, discount, validity window, whether one per order and whether stackable, excluded categories and refund treatment. Compute each scenario as `sum − discount` with the sums shown, keep per-item budget separate from the basket total, and mark coupons the user may hold as unknown until the user shows them. Reading a coupon page is allowed; clicking claim is not.

A search snippet, inaccessible post or video title is a lead. Use actual readable text/images/subtitles or runtime-provided content; retained HTML/video URL is not inspected content. Video caption segments require location/timestamps. If a runtime cannot access a source, keep the gap and use an equivalent source in the same bounded scope, rather than inventing content or changing connection settings.

## Accounts and advisory-only operation

The shared shopping.mode is research_and_advice_only and shopping.login_handled_by is user. This boundary applies to the main assistant, shopping-advisor, other expert/worker calls and runtime integrations. Browsing tools with transaction capabilities do not grant authority to use them. A target-price match, recommendation, login or user acceptance of advice does not authorize a purchase.

Use public sources when they suffice. If a needed marketplace/community page, actual variant price or buyer-specific eligibility requires login, explain the needed read scope and let the user personally sign in through the runtime/browser's normal interface. Wait for actual user completion before dependent authenticated reading; continue independent public research when useful. An already available authenticated session may be used only for the scoped research. Do not claim the model logged in or read account-specific prices when the runtime cannot provide that view; use supplied material or preserve the gap.

The user handles QR codes, passwords, OTP/SMS codes, CAPTCHA, sliders and platform verification. Do not request these secrets in chat, retrieve/export cookies or tokens, or automate/bypass authentication. Keep browser profiles, cookies, tokens and authentication exports in runtime-owned storage outside the synced vault. Retained source screenshots/excerpts should contain only required product/price/experience evidence; do not copy unnecessary addresses, payment identifiers or private account pages into shopping records.

Allowed website actions are scoped searching, viewing, reading and inspecting variants/quotes without committing account or transaction changes. Do not add to cart, reserve/order, enter checkout, pay, redeem/claim account coupons, confirm receipt, cancel/return/refund orders, change account data, or contact merchants. Read available promotions rather than claiming them; when a final checkout price is necessary, the user can inspect it manually and provide the evidence. Never place an order merely to test a price, even if the amount is zero or the order can be cancelled.

Observed_checkout quote records mean a user-provided/readable existing source, not permission to navigate checkout. Ownership/refund/repair records are the user's reported/imported history, not assistant execution. The handoff ends with findings, comparisons, uncertainties, links and optional recorded research follow-up; the user performs all buying/after-sales actions manually. Do not delegate a prohibited action or route it through a different tool, script or agent.

These are shared model/runtime operating instructions and validated configuration, not an OS-level browser lock. A runtime must enforce the boundary in its actual capability/permission mapping; no browser/provider/global connection settings are changed by this clarification.

## Source records and identities

Original supplied files/excerpts/screenshots go through shopping.mjs original to inbox/shopping/. Retention preserves bytes/hash but performs no OCR, video reading or HTML execution. Link obtained source text to its original and keep it in the original language.

Use shopping-record.json with a shopping-details.json shape and shopping.mjs record. Kinds:

| Kind | Contents | Interpretation |
|---|---|---|
| product | Exact canonical item variant, identity fields/basis, condition and specifications | Confirm matching before merging; a name/photo or brand alone is insufficient |
| offer | Dated shop/SKU, buyer/quantity/stock/payment context, price components, discounts and expiry | Price observation/qualification, not a live-price guarantee |
| quality | Specific claim/direction, source type/channel/author/read scope, applicability and original evidence unit | Preserve support, contradiction and unknowns; no automated certainty score |
| ownership | One physical instance's planned or observed purchase/use/return/refund/repair events | Recommendation/preparation is not actual ownership; request for refund is not received money |
| watch | Product, quantity, currency/scale/target, platforms, next check and sourced proposal/acceptance/state | Accepted recorded queue, not a running timer or purchase authorization |

All records need subject, source review/extraction status, occurrence bounds/precision and sources; recorded_at is capture time. Unknown dates/amounts remain null. Optional occurred_at requires an explicit timezone and matching local date. Model estimates/hypotheses remain distinct; inferred offers must be scenarios, inferred ownership must be plans and inferred watches must be proposed. Quality hypotheses go in case/assessment artifacts rather than original observations.

Product identity may use brand/model/variant/pack/region/product code and other declared fields. identity_status is confirmed/tentative/unknown; confirmed needs an explicit source matching basis. Different colour/capacity/package/region/condition versions are distinct when they affect the comparison. Source verification and identity matching are coordinator/model tasks; the script checks representations, not real-world authenticity.

Use one canonical record ID per same observation. More screenshots or corrections revise that record; a new date/offer observation or ownership event is separate. Optional exact provider/record_key prevents duplicates within declared kind/subject/provider, but cross-source matching needs judgment. Versions are immutable; corrections supply the exact latest supersedes and retain history. Subject/kind changes need retraction and a separate corrected identity. Generic file writes cannot overwrite typed entries or originals, including path aliases.

Use exact product_ref for offers/evidence/instances/watches. Product corrections invalidate linked current use; earlier records remain accessible as history. Never silently relink old prices to a different variant. A physical ownership_id cannot switch product: preserve replacement links through a new instance. Existing purchases.md/wishlist.md remain readable and can link canonical IDs; do not sum or re-import them as duplicates automatically.

## Quote arithmetic and comparisons

Money uses explicit three-letter currency and scale (0..4), with safe integer minor amounts. For example, EUR scale 2 with 12345 minor units means 123.45 euros; JPY normally uses scale 0. Take the currency from the source quote, never from the user's region or a configured default. No currency conversion or guessed decimal scale. Offer amounts describe the order total for quantity_units of the canonical product unit, including its declared pack; no ambiguous per-item/listing basis.

Listed, shipping, tax and other fee components are separate; explicit zero must be backed by inspected source context, not guessed from absence. Discounts have unique IDs, amount_minor, eligibility (confirmed/conditional/unknown/ineligible), actual conditions and stacking confirmation. Do not double-subtract discounts already reflected in the listed base; document the chosen pre-discount basis in the source. Omit already-applied reductions from the subtraction list.

Confirmed cash total requires all charges known, eligible discounts known, joint stacking verified when multiple reductions apply, buyer eligibility confirmed, full_payment, usable original evidence and a supported quote type. Unconfirmed fees/discounts/eligibility, estimated scenarios, snippets, source changes or deposits leave eligible total unknown. A separately labeled conditional calculation may show what the stated assumptions would yield; it does not meet a target-price watch. Future cashback, points, gifts and trade-in values remain separate, not cash discounts by default. Negative/overflow totals cannot be eligible quotes.

Compare only exact matching variant/version, currency/scale, quantity and buyer subject with complete eligible full-payment amounts, sourced in-stock status and observations on the selected date. Other quotes stay visible with reasons rather than ranked. Seller/warranty/service and subjective fit remain decision criteria; sorting cash price does not pick the overall best product. Recheck current price, eligibility and stock before purchase even on the observation date.

Explicit validity/expiry can show that an offer expired. A past observation without a new check requires rechecking; a stated future expiry does not guarantee price/stock until then. Dates are in the vault timezone. Historical minima are grouped by exact variant/currency/scale/quantity among eligible recorded observations and their sample size/paths; they are not all-market historical lows or guaranteed recurring discounts.

Ownership cost assessment may separately show sourced consumables, energy, maintenance, shipping or service costs for a stated horizon. Missing costs remain unknown; no invented lifespan or automatic total-cost score is supplied. Paid/refunded/service amounts in ownership events are independent attributed claims, not duplicated transactions or an automatic finance ledger.

For a known actual monetary event, retain a stable cash_flow_id when evidence identifies the same payment/refund/service flow. Ownership views deduplicate repeated reports with the same ID and value; conflicting amounts/roles are unresolved. Missing ID/date/value or unusable source is a gap. Report known purchases/service/refunds by currency/scale and an eligible net of the recorded subset; no missing lifetime cost is filled with zero and no price observation is added as a payment. Proposed flows are excluded.

## Quality synthesis

Quality source types are official_spec/test/teardown/owner_report/merchant_review/promotion/snippet/other, separate from the hosting channel. direction is supports/contradicts/mixed/uncertain; applicability is exact_variant/model_family/category/uncertain. read_scope is full/excerpt/caption_segment/snippet/unread; preserve location and actual limitations.

Group evidence by a specific claim_key. evidence_unit_key identifies the actual original test/report when checked, not merely a domain or repost URL. Copied videos/posts, overlapping tests and multiple summaries of one source share an original unit; unknown independence stays unknown. Keep contrary evidence and conditions; counts are provenance and cannot vote a claim true or yield a confidence percentage. Source authority, claim certainty and personal applicability remain separately judged under shared rules.

Do not require five positive/five negative reviews or balanced support. Record material strengths/problems supported by available evidence; sample comments do not establish defect rates. Owner experience and longer-term personal feedback can be retained immediately without pretending a stable pattern from one purchase. Medical/safety claims require appropriate current source/specialist input, not shopping testimonials alone.

## Ownership, watches and continuation

Ownership status: planned/ordered/received/in_use/return_requested/returned/refund_reported/repair_requested/repaired/replaced/disposed/cancelled/unknown. Keep actual report, date, subject and sources. Plan versus observation is explicit, and unsupported gaps in earlier history remain gaps. Chronological views use occurrence, not recording order; conflicting same-day states need timestamps or stay unresolved. Refund/repair completion remains reported until independently documented as such; cancellation of an advice request does not cancel an actual order.

Watches are proposed/accepted/paused/cancelled, with sourced target money, quantity, platforms and optional next_check_on. The latest immutable revision controls a watch. Only an accepted applicable sourced watch enters the active queue. A same-day eligible recorded offer at/below the target is a recorded match; older, conditional, expired, unavailable, wrong-buyer/currency/quantity or stale offers do not trigger a match. Queue merely lists due checks and matches; runtime invokes searches/reminders under current authorization and docs/core/CONTROL.md. No background monitoring, retailer API or automatic transaction is provided.

Retrieve relevant facts/experiences across all years using docs/core/MEMORY.md, with shopping-record/product/instance entities. Keep user preferences in their shared file, sourced attempts and outcomes in shared memory, and recommendation/acceptance/execution separately in actions/. Exact source/identity/record corrections make case inputs need reassessment. New material evidence needs coordinator case updates; expert agreement is not verification.

## Utilities and integration

```text
node tools/shopping.mjs original <input.json>
node tools/shopping.mjs record <input.json>
node tools/shopping.mjs price <offer-id-or-path>
node tools/shopping.mjs compare <comparison.json>
node tools/shopping.mjs product <product-id-or-path> --subject self --at YYYY-MM-DD
node tools/shopping.mjs timeline --history --kind ownership
node tools/shopping.mjs queue --subject self --at YYYY-MM-DD
```

Use log/import to retain originals/actual purchase/after-sales facts and link existing tables without deleting history. Ask/panel/review read need, quotes, claim-specific quality, owned items and active watches. Apply docs/core/REVIEW.md to meaningful commitments/uncertainty/conflicts; everyday recording and routine comparison stay lightweight. The role does not place orders/pay or contact merchants; those actions are outside this advisory contract.
