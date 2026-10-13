// Immutable sourced financial worksheets with privacy metadata readable before contents.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, normDate } from './lib.mjs';
import { walk, readJSON, vaultPath, stable, digest, keyId, withLock, immutable, immutableBlob, currentHash, dateOrNull } from './store.mjs';
import { ensure, textValue, strings, occurrence, captureSources, sourceStatus } from './record-data.mjs';
import { disclosurePolicy } from './privacy.mjs';
import { FINANCE_KINDS, validateWorksheet, worksheetFields, calculateWorksheet } from './finance-calc.mjs';

const identifier = value => typeof value === 'string' && /^[a-z][a-z0-9_-]*$/.test(value);
const safeId = value => typeof value === 'string' && /^[a-z0-9][a-z0-9_-]*$/.test(value) && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(value);
const inside = file => {
  const target = vaultPath(file);
  return (fs.existsSync(target) ? path.relative(fs.realpathSync(ROOT), fs.realpathSync(target)) : path.relative(ROOT, target)).replaceAll('\\', '/');
};

export function financePrivacy(scopes, fields, basis = null) {
  const policy = disclosurePolicy(scopes);
  const blocked = fields.filter(field => policy.withheld_fields.includes('all') || policy.withheld_fields.includes(field));
  return { allowed: blocked.length === 0 && !(basis === 'personal' && policy.mode === 'general'), blocked_fields: blocked, mode: policy.mode };
}
function policyMetadata(input) {
  ensure(['personal', 'hypothetical'].includes(input.basis), 'Declare personal versus hypothetical worksheet basis.');
  ensure(input.basis !== 'hypothetical' || input.subject === 'example' && input.evidence === 'inferred', 'Hypothetical sheets use subject example and inferred evidence, not personal observations.');
  const scopes = [...new Set(['finance', ...(input.privacy_scopes ?? [])])].sort();
  ensure(scopes.every(scope => identifier(scope) && scope !== 'defaults'), 'Use explicit subject privacy scopes.');
  const extras = strings(input.privacy_fields ?? [], 'additional privacy fields'); ensure(extras.every(identifier), 'Privacy field identifiers must be lowercase.');
  validateWorksheet(input.kind, input.details);
  const fields = worksheetFields(input.kind, input.details, input.basis, extras);
  if (input.basis === 'personal' && (input.occurred_start || input.occurred_end)) fields.push('dates');
  if (input.subject === 'household' && input.basis === 'personal') { if (!scopes.includes('family')) scopes.push('family'); fields.push('household_finances'); }
  if (input.origin != null) ensure(identifier(input.origin.provider) && textValue(input.origin.record_key), 'Origin needs exact provider and canonical source key.');
  return { kind: input.kind, basis: input.basis, scopes: scopes.sort(), fields: [...new Set(fields)].sort(),
    origin_hash: input.origin == null ? null : digest(stable({ provider: input.origin.provider, key: input.origin.record_key, kind: input.kind, subject: input.subject })) };
}

export function financeMetadata() {
  const results = [], seen = new Set();
  for (const file of walk('records/finance/entries', '.meta.json'))
    ensure(fs.existsSync(vaultPath(file.slice(0, -10))), 'Financial version body is missing; preserve and review its exposure metadata.');
  for (const file of walk('records/finance/entries', '.json').filter(file => !file.endsWith('.meta.json'))) {
    const match = file.match(/^records\/finance\/entries\/\d{4}\/([a-z0-9][a-z0-9_-]*)\/versions\/(\d{6})\.(finance-version-[a-f0-9]{24})\.json$/);
    ensure(match, 'Unrecognized financial version filename; preserve and review it: ' + file);
    const header = readJSON(file + '.meta.json');
    ensure(header && header.schema_version === 1 && header.path === file, 'Financial write is incomplete; recover its original operation before continuing.');
    ensure(FINANCE_KINDS.includes(header.kind) && ['personal', 'hypothetical'].includes(header.basis)
      && Array.isArray(header.scopes) && header.scopes.includes('finance') && header.scopes.every(identifier)
      && Array.isArray(header.fields) && header.fields.every(identifier), 'Invalid financial exposure metadata.');
    const sequence = Number(match[2]), key = match[1] + '/' + sequence;
    ensure(sequence > 0 && !seen.has(key), 'Conflicting financial version sequence.'); seen.add(key);
    ensure(header.origin_hash == null || /^[a-f0-9]{64}$/.test(header.origin_hash), 'Invalid financial origin metadata.');
    results.push({ file, record_id: match[1], version: sequence, version_key: match[3], kind: header.kind, basis: header.basis, scopes: header.scopes, fields: header.fields, origin_hash: header.origin_hash ?? null });
  }
  for (const id of new Set(results.map(item => item.record_id))) {
    const list = results.filter(item => item.record_id === id).sort((a, b) => a.version - b.version);
    ensure(list.every((item, index) => item.version === index + 1), 'Financial version chain has a gap.');
  }
  return results;
}
const latestMetadata = list => [...new Map([...list].sort((a, b) => a.version - b.version).map(item => [item.record_id, item])).values()];

function load(item) {
  ensure(financePrivacy(item.scopes, item.fields, item.basis).allowed, 'Financial worksheet is withheld by saved disclosure preferences.');
  const record = readJSON(item.file);
  ensure(record?.schema_version === 1 && record.record_id === item.record_id && record.version === item.version, 'Financial record metadata is inconsistent.');
  const core = { ...record }; delete core.content_sha256;
  ensure(record.content_sha256 === digest(stable(core)), 'Financial version contents changed outside the record utility.');
  const meta = policyMetadata(record); ensure(stable(meta) === stable({ kind: item.kind, basis: item.basis, scopes: item.scopes, fields: item.fields, origin_hash: item.origin_hash }), 'Financial exposure metadata differs from its contents.');
  return { ...record, file: item.file };
}
function originalAllowed(file) {
  file = inside(file);
  if (/^records\/finance\/entries\//i.test(file)) {
    const item = financeMetadata().find(item => item.file.toLowerCase() === file.toLowerCase());
    ensure(item, 'Unknown financial worksheet source.');
    return financePrivacy(item.scopes, item.fields, item.basis).allowed;
  }
  if (!file.toLowerCase().startsWith('inbox/finance/')) return true;
  const meta = readJSON(file + '.meta.json');
  ensure(meta && meta.schema_version === 1 && inside(meta.path).toLowerCase() === file.toLowerCase(), 'Unrecognized financial original; recover/review its exposure before using it.');
  ensure(Array.isArray(meta.scopes) && Array.isArray(meta.fields), 'Original privacy metadata is invalid.');
  return financePrivacy(meta.scopes, meta.fields, 'personal').allowed;
}
export const financeSourceAllowed = file => originalAllowed(file);
export function retainFinanceOriginal(input) {
  const scopes = [...new Set(['finance', ...(input.privacy_scopes ?? [])])].sort();
  const fields = [...new Set(['raw_statements', ...(input.privacy_fields ?? ['account_details', 'income', 'expenses', 'assets', 'debts'])])].sort();
  ensure(scopes.every(identifier) && fields.every(identifier), 'Declare original disclosure metadata.');
  ensure(financePrivacy(scopes, fields, 'personal').allowed, 'Original financial material is withheld; use only permitted text/aggregates without requesting the declined information.');
  ensure(textValue(input.source_path), 'Supply an authorized local source path.');
  const source = path.resolve(input.source_path);
  const sourceRelative = path.relative(fs.realpathSync(ROOT), fs.realpathSync(source)).replaceAll('\\', '/');
  if (!sourceRelative.startsWith('../') && !path.isAbsolute(sourceRelative)) ensure(originalAllowed(sourceRelative), 'Stored financial source is withheld.');
  const stat = fs.statSync(source), limit = readJSON('project.json')?.finance?.original_max_bytes;
  ensure(Number.isInteger(limit) && limit > 0 && stat.isFile() && stat.size > 0 && stat.size <= limit, 'Original is empty or exceeds the configured size limit.');
  const ext = path.extname(source).slice(1).toLowerCase(); ensure(['csv', 'xlsx', 'xls', 'pdf', 'txt', 'md', 'json', 'png', 'jpg', 'jpeg', 'webp'].includes(ext), 'Unsupported financial original format.');
  const bytes = fs.readFileSync(source), date = dateOrNull(normDate(input.date));
  const file = 'inbox/finance/' + date + '/' + digest(bytes) + '.' + ext;
  const retained = immutableBlob(file, bytes);
  immutable(file + '.meta.json', { schema_version: 1, path: file, scopes, fields });
  return { ...retained, bytes: bytes.length, review_status: 'pending', note: 'Original byte retention only; no parsing, OCR, banking or upload is performed.' };
}

export function recordFinance(input) {
  const inputKeys = ['operation_id', 'record_id', 'supersedes', 'kind', 'basis', 'subject', 'title', 'privacy_scopes', 'privacy_fields', 'evidence', 'review_status', 'extraction_confidence', 'state', 'occurred_start', 'occurred_end', 'date_precision', 'sources', 'origin', 'details'];
  ensure(input && typeof input === 'object' && Object.keys(input).every(key => inputKeys.includes(key)), 'Unsupported financial capture field; preserve other details in permitted original artifacts.');
  ensure(textValue(input.operation_id) && FINANCE_KINDS.includes(input.kind), 'Financial capture needs a stable operation ID and supported kind.');
  ensure(textValue(input.subject) && textValue(input.title), 'Supply an anonymous subject and generic title.');
  ensure(['reported', 'documented', 'inferred'].includes(input.evidence) && ['reviewed', 'pending'].includes(input.review_status)
    && ['high', 'medium', 'low', 'unknown'].includes(input.extraction_confidence), 'Declare evidence/source review/extraction state.');
  ensure(['active', 'retracted'].includes(input.state ?? 'active'), 'Invalid financial record state.');
  ensure(input.evidence !== 'inferred' || input.basis === 'hypothetical' || ['budget', 'goal', 'debt', 'scenario'].includes(input.kind), 'Inferred values cannot be actual cash-flow/balance observations.');
  const meta = policyMetadata(input); ensure(financePrivacy(meta.scopes, meta.fields, input.basis).allowed, 'Financial fields are withheld; preserve unknowns or use a genuinely hypothetical example, never relabel hidden actuals.');
  return withLock('finance-records', () => {
    const versionKey = keyId('finance-version', input.operation_id), fingerprint = digest(stable(input));
    // Recover only an exact explicitly supplied operation, never guess a missing exposure declaration.
    const interrupted = walk('records/finance/entries', '.json').find(file => file.endsWith('.' + versionKey + '.json') && !fs.existsSync(vaultPath(file + '.meta.json')));
    if (interrupted) {
      const saved = readJSON(interrupted), core = { ...saved }; delete core.content_sha256;
      ensure(saved.input_hash === fingerprint && saved.content_sha256 === digest(stable(core)) && stable(policyMetadata(saved)) === stable(meta), 'Incomplete financial write differs from this operation; preserve and review it.');
      immutable(interrupted + '.meta.json', { schema_version: 1, path: interrupted, ...meta });
    }
    const list = financeMetadata();
    const replay = list.find(item => item.version_key === versionKey);
    if (replay) {
      const old = load(replay); ensure(old.input_hash === fingerprint, 'Financial operation ID reused with different content.');
      const latest = latestMetadata(list).find(item => item.record_id === old.record_id);
      return { record_id: old.record_id, path: old.file, version: old.version, superseded: latest.version !== old.version, replay: true };
    }
    const id = input.record_id ?? keyId('finance', input.operation_id); ensure(safeId(id), 'Use a filesystem-safe anonymous financial record ID.');
    const previousMeta = latestMetadata(list).find(item => item.record_id === id), previous = previousMeta ? load(previousMeta) : null;
    ensure(previous ? input.supersedes === previous.file : !input.supersedes, 'Financial corrections must supersede the exact latest version.');
    ensure(!previous || previous.kind === input.kind && previous.subject === input.subject && previous.basis === input.basis, 'Financial revisions retain kind, subject and personal/example basis; retract a misassigned record.');
    if (meta.origin_hash != null) ensure(!latestMetadata(list).some(item => item.record_id !== id && item.origin_hash === meta.origin_hash), 'This source worksheet already has a canonical record; revise its ID.');
    for (const row of [...(input.details.rows ?? []), ...(input.details.items ?? [])])
      ensure(!row.source_indexes || Array.isArray(input.sources) && row.source_indexes.every(index => index < input.sources.length), 'Row/item source index is outside the worksheet source list.');
    ensure(Array.isArray(input.sources) && input.sources.every(source => originalAllowed(inside(typeof source === 'string' ? source : source.path))), 'A financial original source is withheld.');
    const dates = occurrence(input), recorded = new Date().toISOString(), version = (previous?.version ?? 0) + 1;
    ensure(version <= 999999, 'Financial version sequence exceeds the current filename format.');
    const saved = { ...input, schema_version: 1, record_id: id, version, state: input.state ?? 'active', ...dates, privacy_scopes: meta.scopes,
      sources: captureSources(input.sources), recorded_at: recorded, input_hash: fingerprint };
    saved.content_sha256 = digest(stable(saved));
    const year = previous ? previous.file.split('/')[3] : recorded.slice(0, 4);
    const file = 'records/finance/entries/' + year + '/' + id + '/versions/' + String(version).padStart(6, '0') + '.' + versionKey + '.json';
    immutable(file, saved);
    immutable(file + '.meta.json', { schema_version: 1, path: file, ...meta });
    return { record_id: id, path: file, version, replay: false, memory_entities: ['finance-record:' + id] };
  });
}

export function financeRecord(selector, ancestors = new Set()) {
  ensure(typeof selector === 'string' && selector.length > 0, 'Supply a financial worksheet selector.');
  const list = financeMetadata();
  const isPath = /[\\/]/.test(selector) || path.isAbsolute(selector);
  const normalized = isPath ? inside(path.isAbsolute(selector) ? path.relative(ROOT, selector) : selector).toLowerCase() : null;
  const item = isPath ? list.find(item => item.file.toLowerCase() === normalized) : latestMetadata(list).find(item => item.record_id === selector);
  ensure(item, 'Unknown financial worksheet ID/version.');
  ensure(!ancestors.has(item.file), 'Financial source references contain a cycle.');
  const sourceAncestors = new Set([...ancestors, item.file]);
  const record = load(item), latest = latestMetadata(list).find(meta => meta.record_id === record.record_id);
  const same = list.filter(meta => meta.record_id === record.record_id).sort((a, b) => a.version - b.version);
  ensure(record.version === 1 ? !record.supersedes : record.supersedes === same[record.version - 2].file, 'Financial revision chain is inconsistent.');
  const statuses = record.sources.map(source => {
    try {
      if (!originalAllowed(source.path)) return { path: source.path, current: false, reason: 'source_withheld' };
      const status = sourceStatus(source);
      if (!status.current || !/^records\/finance\/entries\//i.test(inside(source.path))) return status;
      const linked = financeRecord(source.path, sourceAncestors);
      return linked.usable_as_recorded_evidence ? status : { ...status, current: false, reason: 'financial_source_historical_conditional_or_unavailable' };
    } catch { return { path: source.path, current: false, reason: 'source_unavailable_or_invalid' }; }
  });
  const limitations = [];
  if (record.state !== 'active') limitations.push('retracted');
  if (record.basis === 'hypothetical') limitations.push('hypothetical_worksheet');
  if (record.evidence === 'inferred') limitations.push('inferred_values');
  if (record.review_status !== 'reviewed') limitations.push('pending_source_review');
  if (['low', 'unknown'].includes(record.extraction_confidence)) limitations.push('uncertain_extraction');
  if (statuses.some(source => !source.current)) limitations.push('source_missing_changed_or_withheld');
  const superseded = latest.version !== record.version;
  if (superseded) limitations.push('superseded_version');
  return { ...record, superseded, source_status: statuses, limitations, usable_as_recorded_evidence: limitations.length === 0 && record.basis === 'personal' && record.evidence !== 'inferred' };
}
export function listFinance(options = {}) {
  ensure(!options.kind || FINANCE_KINDS.includes(options.kind), 'Unknown financial worksheet kind.');
  const records = (options.history ? financeMetadata() : latestMetadata(financeMetadata()))
    .filter(item => (!options.kind || item.kind === options.kind) && financePrivacy(item.scopes, item.fields, item.basis).allowed)
    .map(item => financeRecord(item.file)).filter(record => !options.subject || record.subject === options.subject);
  return { records: records.map(record => ({ record_id: record.record_id, path: record.file, version: record.version, kind: record.kind, basis: record.basis, subject: record.subject,
      state: record.state, occurred_start: record.occurred_start, occurred_end: record.occurred_end, superseded: record.superseded, limitations: record.limitations, usable_as_recorded_evidence: record.usable_as_recorded_evidence })),
    note: 'Permitted worksheets only; no cross-sheet totals, private-record counts or old-version resurrection.' };
}
export function calculateFinance(input) {
  const record = typeof input === 'string' ? financeRecord(input) : input;
  const meta = policyMetadata(record); ensure(financePrivacy(meta.scopes, meta.fields, record.basis).allowed, 'Worksheet fields are withheld by saved preferences.');
  ensure(record.state !== 'retracted', 'Retracted financial evidence is not a current calculation.');
  const result = calculateWorksheet(record.kind, record.details);
  return { ...result, subject: record.subject, basis: record.basis, evidence_status: ['goal', 'debt', 'scenario'].includes(record.kind) ? 'conditional_projection' : record.file ? record.usable_as_recorded_evidence ? 'usable_recorded_subset' : 'conditional_or_historical_preview' : 'supplied_input_arithmetic_only',
    source_worksheet: record.file ?? null, limitations: record.limitations ?? [], note_scope: 'One selected worksheet; calculations do not certify source truth, full coverage, affordability or future outcomes.' };
}
