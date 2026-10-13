// Arithmetic over explicit quote conditions and dated source records; no live pricing/quality score.
import { today, localDate } from './lib.mjs';
import { dateOrNull } from './store.mjs';
import { ensure } from './record-data.mjs';
import { shoppingRecords, shoppingRecordView, shoppingOwnershipClaim } from './shopping-data.mjs';

const safeSum = values => { let total = 0; for (const v of values) { total += v; ensure(Number.isSafeInteger(total), 'Price component sum exceeds safe integer arithmetic.'); } return total; };
export function offerPrice(record, collection = shoppingRecords()) {
  const view = shoppingRecordView(record, collection), d = record.details, p = d.price, reasons = [...view.limitations];
  const fields = ['listed_minor', 'shipping_minor', 'tax_minor', 'other_fee_minor'];
  if (fields.some(f => p[f] == null)) reasons.push('unknown_price_component');
  if (d.quantity_units == null) reasons.push('unknown_order_quantity');
  const knownCharges = safeSum(fields.filter(f => p[f] != null).map(f => p[f]));
  const usableDiscounts = d.discounts.filter(x => x.eligibility === 'confirmed' && x.amount_minor != null);
  const confirmedDiscounts = safeSum(usableDiscounts.map(x => x.amount_minor));
  if (d.discounts.some(x => x.eligibility === 'unknown' || x.amount_minor == null && x.eligibility !== 'ineligible')) reasons.push('unknown_discount');
  if (d.discounts.some(x => x.eligibility === 'conditional')) reasons.push('conditional_discount');
  if (d.discounts.filter(x => x.eligibility !== 'ineligible').length > 1 && d.stacking !== 'confirmed') reasons.push('unverified_discount_stacking');
  if (d.purchase_eligibility !== 'confirmed') reasons.push('buyer_eligibility_unconfirmed');
  if (d.payment_basis !== 'full_payment') reasons.push('not_full_payment');
  if (['scenario', 'snippet'].includes(d.quote_type) || record.evidence === 'inferred') reasons.push('not_verified_quote');
  const knownAll = !fields.some(f => p[f] == null), discountsKnown = !d.discounts.some(x => x.eligibility !== 'ineligible' && x.amount_minor == null);
  const canStack = d.discounts.filter(x => x.eligibility !== 'ineligible').length < 2 || d.stacking === 'confirmed';
  const possible = knownAll && discountsKnown && canStack ? knownCharges - safeSum(d.discounts.filter(x => x.eligibility !== 'ineligible').map(x => x.amount_minor)) : null;
  if (possible != null && possible < 0) reasons.push('discount_exceeds_order_charges');
  const eligibleTotal = !reasons.length ? knownCharges - confirmedDiscounts : null;
  return { ...view, currency: p.currency, scale: p.scale, quantity_units: d.quantity_units, listed_minor: p.listed_minor ?? null,
    known_charges_minor: knownCharges, confirmed_discounts_minor: confirmedDiscounts,
    total_minor: eligibleTotal, per_unit_minor: eligibleTotal == null || d.quantity_units == null ? null : eligibleTotal / d.quantity_units,
    conditional_scenario_minor: possible != null && possible >= 0 && eligibleTotal == null ? possible : null,
    price_reasons: [...new Set(reasons)], rebates_or_extras: d.rebates_or_extras,
    note: 'Amounts use declared currency scale. Conditional scenarios and deferred cashback/extras are not an eligible cash price.' };
}
function quoteTime(record, at, now) {
  const d = record.details;
  const effectiveNow = now ?? (at === today() ? new Date().toISOString() : null);
  if (record.date_precision !== 'day') return 'unknown_observation_date';
  if (record.occurred_start > at) return 'future_observation';
  if (d.valid_until && d.valid_until < at) return 'expired';
  if (d.expires_at && localDate(d.expires_at) < at) return 'expired';
  if (effectiveNow && d.expires_at && Date.parse(d.expires_at) < Date.parse(effectiveNow)) return 'expired';
  if (record.occurred_start === at) return 'observed_on_selected_date';
  return 'needs_price_recheck';
}
function productRecord(id, collection) {
  const r = collection.all.find(x => x.kind === 'product' && x.file === id) ?? collection.current.find(x => x.kind === 'product' && x.record_id === id);
  ensure(r, 'Unknown product ID or exact path.'); return r;
}
function ownershipCashHistory(events, at) {
  const moneyEvents = events.filter(r => r.state === 'active' && r.details.statement_type === 'observation' && r.details.money != null
    && (!r.occurred_start || r.occurred_start <= at));
  const gaps = moneyEvents.filter(r => !r.usable_as_recorded_evidence || r.date_precision !== 'day' || r.details.money.amount_minor == null || !textValue(r.details.cash_flow_id));
  const usable = moneyEvents.filter(r => !gaps.includes(r)), flows = [], conflicts = [];
  for (const id of [...new Set(usable.map(r => r.details.cash_flow_id))]) {
    const group = usable.filter(r => r.details.cash_flow_id === id);
    const claims = [...new Set(group.map(r => r.details.money_role + '/' + r.details.money.currency + '/' + r.details.money.scale + '/' + r.details.money.amount_minor))];
    if (claims.length !== 1) { conflicts.push({ cash_flow_id: id, records: group.map(r => r.file) }); continue; }
    flows.push({ cash_flow_id: id, role: group[0].details.money_role, ...group[0].details.money, records: group.map(r => r.file) });
  }
  const currencies = [...new Set(flows.map(f => f.currency + '/' + f.scale))];
  const sums = currencies.map(key => {
    const items = flows.filter(f => f.currency + '/' + f.scale === key);
    const purchases = safeSum(items.filter(f => f.role === 'purchase').map(f => f.amount_minor)), service = safeSum(items.filter(f => f.role === 'service_cost').map(f => f.amount_minor));
    const refunds = safeSum(items.filter(f => f.role === 'refund').map(f => f.amount_minor)), paid = safeSum([purchases, service]);
    return { currency: items[0].currency, scale: items[0].scale, purchase_minor: purchases, service_minor: service, refund_minor: refunds,
      known_net_minor: paid - refunds, complete_recorded_net_minor: !gaps.length && !conflicts.length ? paid - refunds : null };
  });
  return { flows, sums, conflicts, gap_records: gaps.map(r => r.file),
    note: 'Only distinct sourced cash-flow IDs are added. Totals cover recorded flows, not complete lifetime costs; recurring/missing future costs remain unknown.' };
}
export function compareOffers(paths, options = {}) {
  ensure(Array.isArray(paths) && paths.length > 0 && new Set(paths).size === paths.length, 'Compare a nonempty distinct list of exact offer paths.');
  const collection = shoppingRecords(), at = dateOrNull(options.at ?? today()), now = options.now;
  ensure(!now || Number.isFinite(Date.parse(now)) && /(?:Z|[+-]\d{2}:\d{2})$/.test(now), 'Comparison timestamp needs explicit ISO timezone.');
  const records = paths.map(file => { const r = collection.all.find(x => x.kind === 'offer' && x.file === file); ensure(r, 'Unknown offer path.'); return r; });
  const prices = records.map(r => ({ ...offerPrice(r, collection), time_scope: quoteTime(r, at, now),
    superseded: collection.current.find(x => x.record_id === r.record_id).file !== r.file }));
  const reasons = [];
  const refs = [...new Set(records.map(r => r.details.product_ref))];
  if (refs.length !== 1) reasons.push('different_product_versions_or_variants');
  if (new Set(records.map(r => r.subject)).size !== 1) reasons.push('different_buyer_subject');
  for (const ref of refs) { const p = productRecord(ref, collection), v = shoppingRecordView(p, collection);
    if (!v.usable_as_recorded_evidence || p.details.identity_status !== 'confirmed') reasons.push('unconfirmed_product_identity'); }
  if (new Set(prices.map(p => p.currency + '/' + p.scale)).size !== 1) reasons.push('different_currency_or_scale');
  if (new Set(prices.map(p => p.quantity_units)).size !== 1) reasons.push('different_order_quantity');
  if (prices.some(p => p.total_minor == null)) reasons.push('incomplete_or_conditional_quote');
  if (prices.some(p => p.superseded)) reasons.push('superseded_offer');
  if (prices.some(p => p.details.availability !== 'in_stock')) reasons.push('unconfirmed_availability');
  if (prices.some(p => p.details.quote_type === 'historical_report')) reasons.push('historical_quote_not_current');
  if (prices.some(p => p.time_scope !== 'observed_on_selected_date')) reasons.push('expired_or_needs_recheck');
  const eligible = !reasons.length, sorted = eligible ? [...prices].sort((a, b) => a.total_minor - b.total_minor) : null;
  return { at, comparable: eligible, reasons: [...new Set(reasons)], offers: prices, ranked: sorted?.map(p => ({ path: p.file, total_minor: p.total_minor, currency: p.currency, scale: p.scale })) ?? null,
    note: 'Ranking covers only saved comparable observations on the selected date; recheck before purchase. Seller/warranty/service differences remain decision criteria.' };
}
export function shoppingProduct(id, options = {}) {
  const collection = shoppingRecords(), p = productRecord(id, collection), subject = options.subject ?? 'self', at = dateOrNull(options.at ?? today());
  const records = collection.current.filter(r => r.state === 'active' && r.details.product_ref === p.file).map(r => shoppingRecordView(r, collection));
  const offers = records.filter(r => r.kind === 'offer' && r.subject === subject).map(r => ({ ...offerPrice(r, collection), time_scope: quoteTime(r, at, options.now) }));
  const identityUsable = shoppingRecordView(p, collection).usable_as_recorded_evidence && p.details.identity_status === 'confirmed';
  const minimums = new Map();
  for (const offer of offers.filter(o => identityUsable && o.total_minor != null && o.date_precision === 'day' && o.occurred_start <= at && o.details.availability === 'in_stock'
    && ['observed_page', 'observed_checkout', 'historical_report'].includes(o.details.quote_type))) {
    const key = offer.currency + '/' + offer.scale + '/' + offer.quantity_units;
    const group = minimums.get(key) ?? { currency: offer.currency, scale: offer.scale, quantity_units: offer.quantity_units, observed_count: 0, min_total_minor: offer.total_minor, paths: [] };
    group.observed_count++; if (offer.total_minor < group.min_total_minor) { group.min_total_minor = offer.total_minor; group.paths = []; }
    if (offer.total_minor === group.min_total_minor) group.paths.push(offer.file); minimums.set(key, group);
  }
  const quality = records.filter(r => r.kind === 'quality' && (!r.occurred_start || r.occurred_start <= at));
  const claims = [...new Set(quality.map(r => r.details.claim_key))].map(key => {
    const group = quality.filter(r => r.details.claim_key === key);
    const usable = group.filter(r => r.usable_as_recorded_evidence && r.details.applicability === 'exact_variant' && !['snippet', 'unread'].includes(r.details.read_scope));
    const units = [...new Set(usable.map(r => r.details.evidence_unit_key).filter(textValue))];
    return { claim_key: key, evidence: group, exact_variant_read_evidence: usable,
      known_original_unit_count: units.length, unknown_independence_count: usable.filter(r => !textValue(r.details.evidence_unit_key)).length,
      has_contrary_evidence: usable.some(r => ['contradicts', 'mixed'].includes(r.details.direction)), note: 'Known-unit count is provenance, not a certainty score or vote. Copies and overlapping tests need grouping.' };
  });
  const owned = records.filter(r => r.kind === 'ownership' && r.subject === subject);
  const ownerships = [...new Set(owned.map(r => r.details.ownership_id))].map(instance => {
    const events = owned.filter(r => r.details.ownership_id === instance);
    return { ownership_id: instance, current: shoppingOwnershipClaim(events, at), events, cash_history: ownershipCashHistory(events, at),
      note: 'Reported ownership/payment/refund/repair, not automatic financial accounting or verified resolution.' };
  });
  const otherVersions = collection.current.filter(r => r.bindings?.some(b => b.kind === 'product' && b.record_id === p.record_id) && r.details.product_ref !== p.file)
    .map(r => shoppingRecordView(r, collection));
  return { product: shoppingRecordView(p, collection), identity_history: collection.all.filter(r => r.record_id === p.record_id),
    other_version_records: otherVersions, at, offers, historical_recorded_minimums: [...minimums.values()], quality_claims: claims, ownerships,
    note: 'Historical minimum means among eligible recorded same-variant/currency/quantity quotes only, not all-market history. Proposed ownership and inferred causal explanations stay separate.' };
}
const textValue = value => typeof value === 'string' && value.trim().length > 0;
export function shoppingQueue(options = {}) {
  const collection = shoppingRecords(), at = dateOrNull(options.at ?? today()), subject = options.subject ?? 'self';
  const watches = collection.current.filter(r => r.kind === 'watch' && r.state === 'active' && r.subject === subject).map(r => {
    const view = shoppingRecordView(r, collection), d = r.details;
    const platforms = d.platforms ?? [];
    const observations = collection.current.filter(o => o.kind === 'offer' && o.state === 'active' && o.subject === subject && o.details.product_ref === d.product_ref && (!platforms.length || platforms.includes(o.details.platform)))
      .map(o => ({ ...offerPrice(o, collection), time_scope: quoteTime(o, at, options.now) }));
    const matches = observations.filter(o => o.total_minor != null && o.currency === d.target.currency && o.scale === d.target.scale && o.quantity_units === d.quantity_units
      && o.total_minor <= d.target.amount_minor && o.details.availability === 'in_stock' && ['observed_page', 'observed_checkout'].includes(o.details.quote_type) && o.time_scope === 'observed_on_selected_date');
    const p = productRecord(d.product_ref, collection), productUsable = shoppingRecordView(p, collection).usable_as_recorded_evidence && p.details.identity_status === 'confirmed';
    const active = view.usable_as_recorded_evidence && productUsable && d.status === 'accepted' && r.date_precision === 'day' && r.occurred_start <= at;
    return { ...view, due_for_check: active && Boolean(d.next_check_on && d.next_check_on <= at), unknown_check_date: active && !d.next_check_on,
      target_match_observations: active ? matches.map(o => o.file) : [], active, requires_runtime_search_or_notification: active,
      note: 'Queue uses saved observations only; a match or stored date sends no notification and performs no purchase.' };
  });
  return { at, subject, watches, note: 'Paused/cancelled/proposed watches do not dispatch. Runtime checks authorization/task control and current availability before searching or notifying.' };
}
