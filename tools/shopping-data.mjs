// Source-grounded shopping snapshots/history; no marketplace calls or transaction execution.
import fs from 'node:fs';
import path from 'node:path';
import { today, normDate, localDate } from './lib.mjs';
import { digest, stable, keyId, immutable, immutableBlob, withLock, readJSON, dateOrNull, vaultPath, currentHash } from './store.mjs';
import { ensure, textValue, strings, occurrence, versions, captureSources, sourceStatus } from './record-data.mjs';

export const SHOPPING_KINDS = ['product', 'offer', 'quality', 'ownership', 'watch'];
export const shoppingRecords = () => versions('records/shopping/entries', 'record_id');
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const safeId = value => textValue(value) && /^[a-z0-9][a-z0-9_-]*$/.test(value) && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(value);
const minor = value => Number.isSafeInteger(value) && value >= 0;
export function money(value) {
  ensure(object(value) && /^[A-Z]{3}$/.test(value.currency) && Number.isInteger(value.scale) && value.scale >= 0 && value.scale <= 4,
    'Money needs an explicit three-letter currency and minor-unit scale 0..4.');
  ensure(value.amount_minor == null || minor(value.amount_minor), 'Money amount must be a safe nonnegative integer minor value or null.');
  return value;
}
function timestamp(value, date = null) {
  if (value == null) return;
  ensure(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)), 'Timestamp needs explicit ISO timezone.');
  if (date != null) ensure(localDate(value) === date, 'Timestamp differs from the local occurrence day.');
}
function validate(input, collection) {
  const d = input.details, bindings = [];
  ensure(object(d), 'Shopping record needs typed details.');
  const bind = (file, kind) => {
    const r = collection.all.find(record => record.file === file);
    ensure(r && r.kind === kind && (input.state === 'retracted' || r.state === 'active' && collection.current.find(c => c.record_id === r.record_id)?.state === 'active'), 'Exact linked shopping record is missing, retracted or wrong kind.');
    bindings.push({ path: r.file, record_id: r.record_id, kind, sha256_at_capture: currentHash(vaultPath(r.file)) });
    return r;
  };
  if (input.kind === 'product') {
    ensure(textValue(d.name) && object(d.identity) && ['confirmed', 'tentative', 'unknown'].includes(d.identity_status), 'Product needs a name, explicit identity fields and identity status.');
    ensure(d.identity_status !== 'confirmed' || textValue(d.identity_basis), 'Confirmed identity needs a documented matching basis.');
    ensure(['new', 'used', 'refurbished', 'unknown'].includes(d.condition), 'Product condition must be explicit.');
    strings(d.specifications ?? [], 'specifications');
  } else {
    bind(d.product_ref, 'product');
    if (input.kind === 'offer') {
      ensure(textValue(d.platform) && textValue(d.merchant) && ['observed_page', 'observed_checkout', 'historical_report', 'scenario', 'snippet'].includes(d.quote_type), 'Offer needs platform, merchant and quote type.');
      ensure(['in_stock', 'out_of_stock', 'unknown'].includes(d.availability) && ['full_payment', 'deposit', 'installment', 'unknown'].includes(d.payment_basis), 'Declare stock and full-payment/deposit/installment basis.');
      ensure(['confirmed', 'conditional', 'unknown'].includes(d.purchase_eligibility) && textValue(d.eligibility_context), 'Declare buyer/region/promotion eligibility and its context.');
      ensure(d.quantity_units == null || Number.isSafeInteger(d.quantity_units) && d.quantity_units > 0, 'Offer quantity is a positive canonical-unit count or explicitly unknown.');
      money(d.price); ensure(d.price.amount_minor === undefined || d.price.amount_minor == null, 'Use listed_minor plus explicit charges for an offer, not a prefilled total.');
      for (const field of ['listed_minor', 'shipping_minor', 'tax_minor', 'other_fee_minor']) ensure(d.price[field] == null || minor(d.price[field]), 'Price components require safe nonnegative minor amounts or null.');
      ensure(Array.isArray(d.discounts) && ['confirmed', 'unknown'].includes(d.stacking), 'Discounts and their joint stacking status must be explicit.');
      const ids = d.discounts.map(x => x.id); ensure(ids.every(safeId) && new Set(ids).size === ids.length, 'Discount IDs must be unique.');
      for (const x of d.discounts) ensure(textValue(x.label) && (x.amount_minor == null || minor(x.amount_minor)) && ['confirmed', 'conditional', 'unknown', 'ineligible'].includes(x.eligibility)
        && (x.eligibility === 'confirmed' || textValue(x.conditions)), 'Discount needs amount/eligibility and conditions when unconfirmed.');
      for (const values of [ ['listed_minor', 'shipping_minor', 'tax_minor', 'other_fee_minor'].map(key => d.price[key] ?? 0), d.discounts.map(x => x.amount_minor ?? 0) ])
        ensure(Number.isSafeInteger(values.reduce((sum, value) => sum + value, 0)), 'Combined monetary components exceed safe integer arithmetic.');
      dateOrNull(d.valid_until); timestamp(d.expires_at); strings(d.rebates_or_extras ?? [], 'rebates_or_extras');
      ensure(!d.valid_until || !input.occurred_start || d.valid_until >= input.occurred_start, 'Offer validity ends before observation.');
      ensure(!d.expires_at || !input.occurred_at || Date.parse(d.expires_at) >= Date.parse(input.occurred_at), 'Offer expiry precedes its observation.');
      ensure(input.evidence !== 'inferred' || d.quote_type === 'scenario', 'Inferred prices must be scenarios, not observed quotes.');
    } else if (input.kind === 'quality') {
      ensure(textValue(d.claim_key) && textValue(d.claim) && ['supports', 'contradicts', 'mixed', 'uncertain'].includes(d.direction), 'Quality evidence needs a claim key/text and direction.');
      ensure(['official_spec', 'test', 'teardown', 'owner_report', 'merchant_review', 'promotion', 'snippet', 'other'].includes(d.source_type), 'Declare evidence type separately from channel.');
      ensure(['exact_variant', 'model_family', 'category', 'uncertain'].includes(d.applicability), 'Declare actual product applicability.');
      ensure(textValue(d.channel) && textValue(d.title) && textValue(d.author) && ['full', 'excerpt', 'caption_segment', 'snippet', 'unread'].includes(d.read_scope), 'Quality source needs channel/title/author and actual reading scope.');
      ensure(d.read_scope !== 'caption_segment' || textValue(d.location), 'Read captions require actual timestamp/segment location.');
      ensure(['disclosed', 'not_disclosed', 'unknown'].includes(d.sponsorship), 'Record sponsorship knowledge without equating undisclosed with independent.');
      if (d.sample_size != null) ensure(Number.isSafeInteger(d.sample_size) && d.sample_size > 0, 'Sample size must be an explicitly reported positive integer.');
      strings(d.conditions ?? [], 'quality conditions'); strings(d.limitations ?? [], 'quality limitations');
      ensure(input.evidence !== 'inferred', 'Model hypotheses are not original quality observations; use a case assessment.');
    } else if (input.kind === 'ownership') {
      ensure(safeId(d.ownership_id) && ['plan', 'observation'].includes(d.statement_type), 'Ownership events need stable instance ID and plan/observation distinction.');
      ensure(['planned', 'ordered', 'received', 'in_use', 'return_requested', 'returned', 'refund_reported', 'repair_requested', 'repaired', 'replaced', 'disposed', 'cancelled', 'unknown'].includes(d.status) && textValue(d.description), 'Declare actual ownership/after-sales status and description.');
      ensure(d.statement_type !== 'observation' || d.status !== 'planned', 'Planned purchase is not an observation.');
      if (d.money != null) money(d.money);
      ensure(d.money == null || ['purchase', 'refund', 'service_cost'].includes(d.money_role), 'Attribute a payment/refund/service amount separately.');
      ensure(input.evidence !== 'inferred' || d.statement_type === 'plan', 'Inferred purchase cannot become actual ownership.');
      const same = collection.current.filter(r => r.kind === 'ownership' && r.state === 'active' && r.subject === input.subject && r.record_id !== input.record_id && r.details.ownership_id === d.ownership_id);
      ensure(same.every(r => r.bindings.find(b => b.kind === 'product')?.record_id === bindings[0].record_id), 'A physical ownership instance cannot silently switch product; link a new replacement instance.');
    } else if (input.kind === 'watch') {
      ensure(['proposed', 'accepted', 'paused', 'cancelled'].includes(d.status) && textValue(d.reason), 'Watch needs sourced acceptance/state and reason.');
      money(d.target); ensure(d.target.amount_minor != null && Number.isSafeInteger(d.quantity_units) && d.quantity_units > 0, 'Watch requires a known target and canonical unit count.');
      dateOrNull(d.next_check_on); strings(d.platforms ?? [], 'watch platforms');
      ensure(input.evidence !== 'inferred' || d.status === 'proposed', 'Inferred watch is a proposal, not user acceptance.');
      if (input.record_id != null) {
        const previous = collection.current.find(r => r.record_id === input.record_id);
        ensure(!previous || previous.bindings.find(b => b.kind === 'product')?.record_id === bindings[0].record_id, 'A watch cannot silently change product identity; create another watch.');
      }
    }
  }
  return bindings;
}

export function retainShoppingOriginal(input) {
  ensure(textValue(input.source_path), 'Provide an authorized local original.');
  const source = path.resolve(input.source_path), stat = fs.statSync(source), maximum = readJSON('project.json')?.shopping?.original_max_bytes ?? 104857600;
  ensure(Number.isInteger(maximum) && maximum > 0 && stat.isFile() && stat.size > 0 && stat.size <= maximum, 'Original is empty or exceeds the shared size limit.');
  const ext = path.extname(source).slice(1).toLowerCase();
  ensure(['pdf', 'png', 'jpg', 'jpeg', 'webp', 'txt', 'md', 'json', 'csv', 'html', 'docx', 'xlsx'].includes(ext), 'Unsupported shopping original extension.');
  const bytes = fs.readFileSync(source), date = dateOrNull(normDate(input.date)), file = 'inbox/shopping/' + date + '/' + digest(bytes) + '.' + ext;
  return { ...immutableBlob(file, bytes), original_name: path.basename(source), bytes: bytes.length, review_status: 'pending', note: 'Retention does not inspect images, execute HTML or read video.' };
}
export function recordShopping(input) {
  ensure(textValue(input.operation_id), 'Shopping capture needs stable operation_id.');
  return withLock('shopping-records', () => {
    const collection = shoppingRecords(), versionId = keyId('shopping-version', input.operation_id), fingerprint = digest(stable(input));
    const existing = collection.all.find(r => r.file.endsWith('/' + versionId + '.json'));
    if (existing) { ensure(existing.input_hash === fingerprint, 'Operation ID reused with different content.'); const current = collection.current.find(r => r.record_id === existing.record_id);
      return { record_id: existing.record_id, path: existing.file, current_path: current.file, version: existing.version, replay: true, superseded: current.file !== existing.file }; }
    const id = input.record_id ?? keyId('shopping', input.operation_id); ensure(safeId(id), 'Invalid filesystem-safe shopping ID.');
    const previous = collection.current.find(r => r.record_id === id);
    ensure(previous ? input.supersedes === previous.file : !input.supersedes, 'Corrections must supersede the exact latest record.');
    ensure(SHOPPING_KINDS.includes(input.kind) && textValue(input.title) && textValue(input.subject), 'Supply shopping kind, title and explicit subject.');
    ensure(!previous || previous.kind === input.kind && previous.subject === input.subject, 'Corrections retain kind/subject; retract a misassigned record.');
    ensure(['reported', 'documented', 'inferred'].includes(input.evidence) && ['reviewed', 'pending'].includes(input.review_status)
      && ['high', 'medium', 'low', 'unknown'].includes(input.extraction_confidence), 'Declare evidence class, actual source review and extraction confidence.');
    ensure(['active', 'retracted'].includes(input.state ?? 'active'), 'Invalid shopping record state.');
    const dates = occurrence(input); timestamp(input.occurred_at, dates.date_precision === 'day' ? dates.occurred_start : null);
    ensure(input.occurred_at == null || dates.date_precision === 'day', 'Timed observations need an exact occurrence day.');
    const bindings = validate({ ...input, record_id: id }, collection), captured = new Date().toISOString();
    if (input.origin != null) {
      ensure(object(input.origin) && textValue(input.origin.provider) && textValue(input.origin.record_key), 'Origin requires an exact provider/record key.');
      ensure(!collection.current.some(r => r.state === 'active' && r.kind === input.kind && r.subject === input.subject && r.record_id !== id
        && r.origin?.provider === input.origin.provider && r.origin?.record_key === input.origin.record_key), 'Source observation already exists; correct its canonical record_id.');
    }
    const directory = previous ? previous.file.slice(0, previous.file.lastIndexOf('/')) : 'records/shopping/entries/' + captured.slice(0, 4) + '/' + id + '/versions';
    const file = directory + '/' + versionId + '.json';
    const saved = { ...input, schema_version: 1, record_id: id, version: (previous?.version ?? 0) + 1, ...dates, state: input.state ?? 'active',
      bindings, sources: captureSources(input.sources), recorded_at: captured, input_hash: fingerprint };
    immutable(file, saved); return { record_id: id, path: file, version: saved.version, replay: false, memory_entities: ['shopping-record:' + id], note: 'Shared memory retains selected facts; recommendations do not imply purchases or outcomes.' };
  });
}

export function shoppingRecordView(record, collection = shoppingRecords()) {
  const sourceStatusList = record.sources.map(sourceStatus), limitations = [];
  if (record.state !== 'active') limitations.push('retracted');
  if (record.review_status !== 'reviewed') limitations.push('pending_source_review');
  if (['low', 'unknown'].includes(record.extraction_confidence)) limitations.push('uncertain_extraction');
  if (sourceStatusList.some(s => !s.current)) limitations.push('source_changed');
  const bindings = (record.bindings ?? []).map(b => {
    const latest = collection.current.find(r => r.record_id === b.record_id), linked = collection.all.find(r => r.file === b.path);
    return { ...b, current: sourceStatus(b).current && latest?.file === b.path && latest.state === 'active' && linked?.sources.every(s => sourceStatus(s).current) };
  });
  if (bindings.some(b => !b.current)) limitations.push('linked_product_changed');
  return { ...record, source_status: sourceStatusList, binding_status: bindings, limitations, usable_as_recorded_evidence: !limitations.length && record.evidence !== 'inferred' };
}
export function shoppingTimeline(options = {}, collection = shoppingRecords()) {
  const from = dateOrNull(options.from), to = dateOrNull(options.to);
  ensure(!from || !to || from <= to, 'Shopping timeline dates reversed.');
  ensure(!options.kind || SHOPPING_KINDS.includes(options.kind), 'Unknown shopping kind.');
  const records = (options.history ? collection.all : collection.current).filter(r => !options.subject || r.subject === options.subject)
    .filter(r => !options.kind || r.kind === options.kind)
    .filter(r => !options.product_ref || r.file === options.product_ref || r.details.product_ref === options.product_ref)
    .map(r => ({ ...shoppingRecordView(r, collection), superseded: collection.current.find(c => c.record_id === r.record_id).file !== r.file }));
  return { records: records.filter(r => r.occurred_start && (!from || r.occurred_end >= from) && (!to || r.occurred_start <= to))
    .sort((a, b) => a.occurred_start.localeCompare(b.occurred_start) || a.recorded_at.localeCompare(b.recorded_at)),
    unknown_date_records: records.filter(r => !r.occurred_start), note: 'Recorded dates and capture dates differ. Unknown dates are retained separately.' };
}
export function shoppingOwnershipClaim(records, at = today()) {
  dateOrNull(at);
  const relevant = records.filter(r => r.state === 'active' && r.details.statement_type === 'observation' && (!r.occurred_start || r.occurred_start <= at));
  const unresolved = relevant.filter(r => !r.usable_as_recorded_evidence || r.date_precision !== 'day'), dated = relevant.filter(r => !unresolved.includes(r));
  const day = dated.map(r => r.occurred_start).sort().at(-1); let last = dated.filter(r => r.occurred_start === day);
  if (last.length && last.every(r => r.occurred_at)) { const time = Math.max(...last.map(r => Date.parse(r.occurred_at))); last = last.filter(r => Date.parse(r.occurred_at) === time); }
  const states = [...new Set(last.map(r => r.details.status))];
  return { status: !unresolved.length && states.length === 1 ? states[0] : null, unresolved, conflict: states.length > 1, claims: last };
}
