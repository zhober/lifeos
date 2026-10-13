// Checks explicitly supplied itinerary arithmetic. No route, source-content or booking access.
import { ensure, textValue } from './record-data.mjs';
import { dateOrNull, vaultPath, stable } from './store.mjs';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const alias = value => typeof value === 'string' && /^[a-z0-9][a-z0-9_-]{0,79}$/.test(value);
const safeMinor = value => Number.isSafeInteger(value) && value >= 0;
const number = value => { ensure(value >= 0n && value <= BigInt(Number.MAX_SAFE_INTEGER), 'Travel cost exceeds safe minor-unit range.'); return Number(value); };
const keys = (value, allowed, label) => ensure(object(value) && Object.keys(value).every(key => allowed.includes(key)), 'Unsupported ' + label + ' field.');
const zone = value => { ensure(textValue(value), 'Timed items need explicit IANA timezones.'); try { new Intl.DateTimeFormat('en-CA', { timeZone: value }); } catch { throw new Error('Unknown IANA timezone.'); } };
function instant(value, timezone = null) {
  if (value == null) return null;
  ensure(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value), 'Use an exact ISO timestamp with seconds and timezone offset.');
  dateOrNull(value.slice(0, 10)); const result = Date.parse(value);
  ensure(Number.isFinite(result), 'Invalid timestamp.');
  if (timezone != null) {
    zone(timezone);
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(result)).map(part => [part.type, part.value]));
    const local = parts.year + '-' + parts.month + '-' + parts.day + 'T' + parts.hour + ':' + parts.minute + ':' + parts.second;
    ensure(local === value.slice(0, 19), 'Timestamp offset does not match its declared local timezone.');
  }
  return result;
}
function reference(value) {
  keys(value, ['path', 'sha256'], 'source reference'); ensure(textValue(value.path), 'Source reference needs a vault-relative path.'); vaultPath(value.path);
  ensure(value.sha256 == null || /^[a-f0-9]{64}$/.test(value.sha256), 'Source hash must be SHA-256 or unknown.');
}

export function checkTravelPlan(plan, asOf) {
  dateOrNull(asOf); ensure(asOf, 'Supply the assessment date.');
  keys(plan, ['schema_version', 'kind', 'plan_id', 'trip_id', 'version', 'supersedes', 'recorded_at', 'subject', 'basis', 'objective', 'from', 'to', 'origin_area', 'destinations', 'assumptions', 'constraints', 'source_references', 'cost_coverage', 'items', 'alternatives'], 'itinerary');
  ensure(plan.schema_version === 1 && plan.kind === 'travel_itinerary' && alias(plan.plan_id) && alias(plan.trip_id), 'Declare schema, kind and anonymous plan/trip IDs.');
  ensure(Number.isSafeInteger(plan.version) && plan.version > 0 && textValue(plan.subject) && textValue(plan.objective), 'Declare plan version, subject and objective.');
  ensure(['personal', 'hypothetical'].includes(plan.basis) && (plan.basis !== 'hypothetical' || plan.subject === 'example'), 'Hypothetical plans use subject example.');
  if (plan.version > 1) { ensure(plan.supersedes != null, 'A revised design needs its preceding exact artifact reference.'); reference(plan.supersedes); ensure(plan.supersedes.sha256 != null, 'A revised design needs the preceding exact SHA-256.'); }
  else ensure(plan.supersedes == null, 'The first design has no preceding version.');
  if (plan.recorded_at != null) instant(plan.recorded_at);
  dateOrNull(plan.from); dateOrNull(plan.to); ensure(!plan.from || !plan.to || plan.from <= plan.to, 'Trip date range is reversed.');
  for (const field of ['destinations', 'assumptions', 'constraints', 'alternatives']) ensure(Array.isArray(plan[field]) && plan[field].every(textValue), field + ' must contain nonempty strings.');
  ensure(plan.origin_area == null || textValue(plan.origin_area), 'Origin area is optional text, not inferred.');
  ensure(Array.isArray(plan.source_references) && plan.source_references.length > 0, 'Retain at least one original input/source pointer.'); plan.source_references.forEach(reference);
  ensure(['complete', 'partial', 'unknown'].includes(plan.cost_coverage) && Array.isArray(plan.items), 'Declare cost coverage and the selected itinerary items.');
  const ids = plan.items.map(item => item.id); ensure(ids.every(alias) && new Set(ids).size === ids.length, 'Item IDs must be unique anonymous identifiers.');
  const issues = [], gaps = [], timeline = [], prices = new Map();
  if (!plan.from || !plan.to) gaps.push({ reason: 'unknown_trip_dates' });
  if (!plan.items.length) gaps.push({ reason: 'no_selected_items' });
  const gap = (item, reason) => gaps.push({ item_id: item.id, reason });
  for (const item of plan.items) {
    keys(item, ['id', 'label', 'kind', 'place', 'track_id', 'timing', 'depends_on', 'buffer_before_min', 'verification', 'checked_on', 'valid_until', 'source_indexes', 'cost_status', 'included_in', 'price'], 'itinerary item');
    ensure(textValue(item.label) && ['activity', 'transport', 'lodging', 'meal', 'rest', 'other'].includes(item.kind) && alias(item.track_id), 'Items need label, kind and anonymous schedule track.');
    ensure(item.place == null || textValue(item.place), 'Place is optional text.');
    ensure(Array.isArray(item.depends_on) && new Set(item.depends_on).size === item.depends_on.length && item.depends_on.every(id => ids.includes(id) && id !== item.id), 'Dependencies must identify distinct items in this exact design.');
    ensure(item.buffer_before_min == null || Number.isSafeInteger(item.buffer_before_min) && item.buffer_before_min >= 0 && item.buffer_before_min <= 525600, 'Buffer is a stated nonnegative minute quantity or unknown.');
    ensure(['verified', 'estimated', 'unverified'].includes(item.verification), 'Declare verification state.'); dateOrNull(item.checked_on); dateOrNull(item.valid_until);
    ensure(Array.isArray(item.source_indexes) && item.source_indexes.every(index => Number.isSafeInteger(index) && index >= 0 && index < plan.source_references.length), 'Source index is outside the selected source list.');
    if (item.verification === 'verified') ensure(item.checked_on && item.source_indexes.length, 'Declared verification needs a check date and source pointers.');
    if (item.verification !== 'verified') gap(item, 'item_not_declared_verified');
    if (item.checked_on && item.checked_on > asOf) gap(item, 'future_check_date');
    if (item.valid_until && item.valid_until < asOf) gap(item, 'declared_evidence_expired');
    const t = item.timing;
    keys(t, ['start_at', 'end_at', 'start_timezone', 'end_timezone', 'window_start_at', 'window_end_at', 'blocks_time', 'basis'], 'timing');
    ensure(['fixed', 'estimated', 'unknown'].includes(t.basis) && (t.blocks_time === null || typeof t.blocks_time === 'boolean'), 'Declare timing basis and whether this item blocks its track.');
    if (t.start_at != null) zone(t.start_timezone); if (t.end_at != null) zone(t.end_timezone);
    const start = instant(t.start_at, t.start_timezone), end = instant(t.end_at, t.end_timezone), open = instant(t.window_start_at), close = instant(t.window_end_at);
    ensure(open == null || close == null || open <= close, 'Applicable operating window is reversed.');
    if (start == null || end == null) gap(item, 'unknown_item_times');
    if (t.blocks_time === null) gap(item, 'unknown_track_occupancy');
    if (t.basis !== 'fixed') gap(item, 'timing_not_fixed');
    if (start != null && end != null && end < start) issues.push({ item_id: item.id, reason: 'end_precedes_start' });
    if (start != null && (open != null && start < open || close != null && start > close) || end != null && (open != null && end < open || close != null && end > close)) issues.push({ item_id: item.id, reason: 'outside_declared_operating_window' });
    for (const value of [t.start_at, t.end_at].filter(Boolean)) if (plan.from && value.slice(0, 10) < plan.from || plan.to && value.slice(0, 10) > plan.to) issues.push({ item_id: item.id, reason: 'outside_trip_dates' });
    timeline.push({ item, start, end });
    ensure(['quoted', 'free', 'included', 'unknown'].includes(item.cost_status), 'Declare whether this cost is quoted, free, included or unknown.');
    if (item.cost_status === 'included') ensure(alias(item.included_in) && ids.includes(item.included_in) && item.included_in !== item.id && item.price == null, 'Included items point to their parent in this design, without another quoted charge.');
    else ensure(item.included_in == null, 'Only included costs name a parent.');
    if (item.cost_status !== 'quoted') { ensure(item.price == null, 'Only quoted costs have price cells.'); if (item.cost_status === 'unknown') gap(item, 'unknown_cost'); continue; }
    const p = item.price;
    keys(p, ['cost_id', 'currency', 'scale', 'amount_minor', 'quantity', 'unit', 'mandatory_charges_complete', 'eligibility', 'checked_on', 'valid_until'], 'price');
    ensure(alias(p.cost_id) && /^[A-Z]{3}$/.test(p.currency) && Number.isInteger(p.scale) && p.scale >= 0 && p.scale <= 4, 'Quote needs canonical cost ID, explicit currency and minor-unit scale.');
    ensure(p.amount_minor == null || safeMinor(p.amount_minor), 'Amount is a safe nonnegative minor integer or unknown.');
    ensure(p.quantity == null || Number.isSafeInteger(p.quantity) && p.quantity > 0, 'Quantity is a stated positive count or unknown.');
    ensure(['per_person', 'per_party', 'per_room', 'per_night', 'per_room_night', 'per_person_night', 'per_ticket'].includes(p.unit), 'Declare the quote unit and its explicit billable quantity.');
    ensure(typeof p.mandatory_charges_complete === 'boolean' || p.mandatory_charges_complete === null, 'Declare mandatory-charge completeness.');
    ensure(['confirmed', 'unknown', 'ineligible'].includes(p.eligibility), 'Declare quote eligibility; this does not verify availability.'); dateOrNull(p.checked_on); dateOrNull(p.valid_until);
    if (p.amount_minor == null || p.quantity == null) gap(item, 'unknown_quote_amount_or_quantity');
    if (p.mandatory_charges_complete !== true) gap(item, 'quote_missing_mandatory_charge_coverage');
    if (p.eligibility !== 'confirmed') gap(item, 'quote_eligibility_not_confirmed');
    if (!p.checked_on || p.checked_on > asOf) gap(item, 'unknown_or_future_quote_check');
    if (p.valid_until && p.valid_until < asOf) gap(item, 'quote_expired');
    const group = prices.get(p.cost_id) ?? []; group.push({ item, price: p }); prices.set(p.cost_id, group);
  }
  const visiting = new Set(), visited = new Set();
  const visit = id => { ensure(!visiting.has(id), 'Itinerary dependencies/included costs contain a cycle.'); if (visited.has(id)) return; visiting.add(id); const item = plan.items.find(item => item.id === id); for (const parent of [...item.depends_on, ...(item.included_in ? [item.included_in] : [])]) visit(parent); visiting.delete(id); visited.add(id); }; ids.forEach(visit);
  const tracks = new Map();
  for (const record of timeline) {
    const item = record.item;
    for (const dependency of item.depends_on) {
      const prior = timeline.find(record => record.item.id === dependency);
      if (prior.end == null || record.start == null || item.buffer_before_min == null) gap(item, 'dependency_time_or_buffer_unknown');
      else if (prior.end + item.buffer_before_min * 60000 > record.start) issues.push({ item_id: item.id, dependency, reason: 'dependency_or_buffer_conflict' });
    }
    if (item.timing.blocks_time === true && record.start != null && record.end != null && record.end >= record.start) {
      const track = tracks.get(item.track_id) ?? []; track.push(record); tracks.set(item.track_id, track);
    }
    if (item.cost_status === 'included') {
      let parent = plan.items.find(other => other.id === item.included_in);
      while (parent.cost_status === 'included') parent = plan.items.find(other => other.id === parent.included_in);
      if (!['quoted', 'free'].includes(parent.cost_status)) gap(item, 'included_cost_parent_unknown');
    }
  }
  for (const track of tracks.values()) {
    track.sort((a, b) => a.start - b.start);
    for (let i = 0; i < track.length; i++) for (let j = i + 1; j < track.length && track[j].start < track[i].end; j++) issues.push({ item_id: track[j].item.id, conflicts_with: track[i].item.id, reason: 'overlapping_track_items' });
  }
  const totals = new Map(), currencyScales = new Map(), duplicateCosts = [];
  for (const [costId, rows] of prices) {
    if (new Set(rows.map(row => stable(row.price))).size > 1) { rows.forEach(row => gap(row.item, 'conflicting_cost_identity')); continue; }
    if (rows.length > 1) duplicateCosts.push({ cost_id: costId, item_ids: rows.map(row => row.item.id) });
    const p = rows[0].price;
    if (currencyScales.has(p.currency)) ensure(currencyScales.get(p.currency) === p.scale, 'One currency must use one declared scale.'); currencyScales.set(p.currency, p.scale);
    if (p.amount_minor == null || p.quantity == null || p.eligibility === 'ineligible') continue;
    totals.set(p.currency, (totals.get(p.currency) ?? 0n) + BigInt(p.amount_minor) * BigInt(p.quantity));
  }
  const complete = plan.cost_coverage === 'complete' && !gaps.some(gap => /cost|quote|evidence_expired|future_check_date|not_declared_verified/.test(gap.reason));
  return { schema_version: 1, plan_id: plan.plan_id, trip_id: plan.trip_id, version: plan.version, basis: plan.basis, as_of: asOf,
    schedule_arithmetic_passed: issues.length === 0, schedule_inputs_complete: !gaps.some(gap => /time|dates|occupancy|selected_items/.test(gap.reason)), issues, gaps,
    recorded_quote_subtotals: [...totals].map(([currency, value]) => ({ currency, scale: currencyScales.get(currency), subtotal_minor: number(value), complete_selected_plan_total_minor: complete ? number(value) : null })),
    cost_coverage: plan.cost_coverage, duplicate_costs: duplicateCosts,
    evidence_status: 'supplied_plan_arithmetic_only', source_content_verified: false, route_verified: false, availability_verified: false,
    note: 'Selected proposed items only; no source reads, FX, booking, adoption or actual travel inferred. Check source truth/freshness, route feasibility, disclosure and user selection separately.' };
}
