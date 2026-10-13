// Health records retain attributed evidence; this module performs no diagnosis or triage.
import fs from 'node:fs';
import path from 'node:path';
import { normDate } from './lib.mjs';
import { digest, stable, keyId, immutable, immutableBlob, withLock, readJSON, dateOrNull, walk } from './store.mjs';
import { ensure, textValue, strings, occurrence, versions, captureSources, sourceStatus } from './record-data.mjs';

export const healthRecords = () => versions('records/health/entries', 'record_id');
const kinds = ['symptom', 'measurement', 'report', 'visit', 'medication', 'diagnosis'];
const number = value => typeof value === 'number' && Number.isFinite(value);
function validateDetails(input) {
  const d = input.details;
  ensure(d && typeof d === 'object' && !Array.isArray(d), 'Health record needs typed details.');
  if (input.kind === 'symptom') {
    ensure(textValue(d.description) && ['onset', 'ongoing', 'recurrent', 'resolved', 'unknown'].includes(d.course), 'Symptom needs description and an explicit course.');
    for (const key of ['triggers', 'associated', 'measures']) strings(d[key] ?? [], key);
    if (d.severity?.value != null) ensure(number(d.severity.value) && d.severity.value >= 0 && d.severity.value <= 10
      && d.severity.scale === 'reported_0_to_10', 'Numeric severity requires an explicitly reported 0-to-10 scale.');
    dateOrNull(d.resolved_on);
    ensure(!d.resolved_on || d.course === 'resolved', 'A resolution date needs a sourced resolved course.');
  } else if (input.kind === 'measurement') {
    ensure(textValue(d.name) && (d.value == null || number(d.value) || textValue(d.value)), 'Measurement needs a name and numeric/text/unknown value.');
    ensure(!number(d.value) || textValue(d.unit), 'Numeric measurements require explicit units, including 1 for dimensionless results.');
    if (d.comparator != null) ensure(['<', '<=', '>', '>=', '='].includes(d.comparator), 'Invalid measurement comparator.');
    if (d.reference_range) {
      const r = d.reference_range;
      ensure((r.low == null || number(r.low)) && (r.high == null || number(r.high)) && (r.low == null || r.high == null || r.low <= r.high), 'Invalid report reference bounds.');
      ensure(r.low == null && r.high == null || textValue(r.unit), 'Numeric reference bounds require their reported unit.');
      ensure(!textValue(d.unit) || !textValue(r.unit) || d.unit === r.unit, 'Reference range unit differs from measurement; preserve the source and clarify before normalization.');
    }
  } else if (input.kind === 'report') {
    ensure(['lab', 'imaging', 'examination', 'other'].includes(d.type) && textValue(d.summary), 'Report needs type and attributed summary.');
  } else if (input.kind === 'visit') {
    ensure(textValue(d.reason), 'Visit needs its reported reason.'); strings(d.recommendations ?? [], 'clinician recommendations'); dateOrNull(d.follow_up_on);
  } else if (input.kind === 'medication') {
    ensure(textValue(d.name) && ['prescribed', 'reported_use', 'planned', 'unknown'].includes(d.statement_type)
      && ['taking', 'stopped', 'not_started', 'unknown'].includes(d.usage_status), 'Medication needs name, statement type, and actual-use status.');
    ensure(d.statement_type === 'reported_use' || !['taking', 'stopped'].includes(d.usage_status), 'A prescription or plan is not evidence of actual use.');
    if (d.dose?.value != null) ensure(number(d.dose.value) && d.dose.value > 0 && textValue(d.dose.unit), 'Dose needs a positive number and explicit unit.');
    const start = dateOrNull(d.actual_start), end = dateOrNull(d.actual_end); dateOrNull(d.prescribed_on);
    ensure(!start || !end || start <= end, 'Actual medication-use dates are reversed.');
    ensure(d.statement_type === 'reported_use' || !start && !end, 'Actual-use dates require a reported-use statement.');
  } else if (input.kind === 'diagnosis') {
    ensure(textValue(d.name) && ['clinician_confirmed', 'clinician_provisional', 'patient_reported', 'refuted', 'unknown'].includes(d.verification_status), 'Diagnosis needs an attributed verification status.');
    ensure(!d.verification_status.startsWith('clinician_') || input.evidence === 'documented' && textValue(d.clinician_context), 'Clinician status requires an attributed clinical document; patient recollections remain patient_reported.');
    ensure(input.evidence !== 'estimated', 'Model estimates cannot create a diagnosis record; use a case hypothesis.');
  }
}
// Validate a health original and derive its retained path without writing.
export function healthOriginal(input) {
  ensure(textValue(input.source_path), 'Provide a user-supplied local original path.');
  const file = path.resolve(input.source_path), stat = fs.statSync(file), maximum = readJSON('project.json')?.health?.original_max_bytes ?? 104857600;
  ensure(Number.isInteger(maximum) && maximum > 0 && stat.isFile() && stat.size > 0 && stat.size <= maximum, 'Original is empty or exceeds the shared size limit.');
  const ext = path.extname(file).slice(1).toLowerCase();
  ensure(['pdf', 'png', 'jpg', 'jpeg', 'webp', 'heic', 'avif', 'txt', 'md', 'csv', 'json', 'xml', 'doc', 'docx', 'xls', 'xlsx'].includes(ext), 'Unsupported original extension.');
  const date = dateOrNull(normDate(input.date)), bytes = fs.readFileSync(file), sha256 = digest(bytes);
  return { file, bytes, sha256, path: 'inbox/health/' + date + '/' + sha256 + '.' + ext };
}
export function retainHealthOriginal(input) {
  const { file, bytes, path: relative } = healthOriginal(input);
  return { ...immutableBlob(relative, bytes), original_name: path.basename(file), bytes: bytes.length,
    review_status: 'pending', note: 'Byte retention does not parse or validate the clinical content.' };
}
export function recordHealth(input) {
  ensure(textValue(input.operation_id), 'Health capture needs a stable operation_id.');
  return withLock('health-records', () => {
    const collection = healthRecords(), versionId = keyId('health-version', input.operation_id), fingerprint = digest(stable(input));
    const existing = collection.all.find(record => record.file.endsWith('/' + versionId + '.json'));
    if (existing) {
      ensure(existing.input_hash === fingerprint, 'Health operation ID reused with different input.');
      const current = collection.current.find(record => record.record_id === existing.record_id);
      return { record_id: existing.record_id, path: existing.file, current_path: current.file, version: existing.version,
        replay: true, superseded: existing.file !== current.file };
    }
    const id = input.record_id ?? keyId('health', input.operation_id);
    ensure(/^[a-z0-9][a-z0-9-]*$/.test(id), 'Invalid health record ID.');
    const previous = collection.current.find(record => record.record_id === id);
    ensure(!previous || input.supersedes === previous.file, 'Health changes must supersede the exact latest version.');
    ensure(previous || !input.supersedes, 'Cannot supersede an unknown health record.');
    ensure(kinds.includes(input.kind) && textValue(input.title) && textValue(input.subject), 'Supply kind, title, and an explicit subject identity.');
    ensure(!previous || previous.subject === input.subject && previous.kind === input.kind, 'A correction must retain record kind and subject; retract a misassigned record and create a new one.');
    ensure(['reported', 'documented', 'estimated'].includes(input.evidence), 'Health evidence must be reported, documented, or estimated; hypotheses belong in cases/memory.');
    ensure(['reviewed', 'pending'].includes(input.review_status) && ['high', 'medium', 'low', 'unknown'].includes(input.extraction_confidence), 'State actual source review and extraction confidence.');
    ensure(['active', 'retracted'].includes(input.state ?? 'active'), 'Invalid health record state.');
    const dates = occurrence(input), caseIds = strings(input.case_ids ?? [], 'case_ids'), linked = strings(input.related_record_ids ?? [], 'related_record_ids');
    for (const linkedId of linked) ensure(collection.current.some(record => record.record_id === linkedId), 'Unknown related health record: ' + linkedId);
    for (const caseId of caseIds) ensure(walk('records/cases', '.json').some(file => file.endsWith('/definition.json') && readJSON(file).case_id === caseId), 'Unknown case: ' + caseId);
    validateDetails(input);
    const captured = new Date().toISOString(), directory = previous ? previous.file.slice(0, previous.file.lastIndexOf('/'))
      : 'records/health/entries/' + captured.slice(0, 4) + '/' + id + '/versions';
    const file = directory + '/' + versionId + '.json';
    const saved = { ...input, schema_version: 1, record_id: id, version: (previous?.version ?? 0) + 1, ...dates,
      state: input.state ?? 'active', case_ids: caseIds, related_record_ids: linked, sources: captureSources(input.sources),
      recorded_at: captured, input_hash: fingerprint };
    if (input.kind === 'diagnosis' && input.details.verification_status.startsWith('clinician_'))
      ensure(saved.sources.some(source => textValue(source.quote) && source.quote.includes(input.details.clinician_context)),
        'Clinician diagnosis needs a captured exact clinical passage; preserve the original and extracted text before attribution.');
    immutable(file, saved);
    return { record_id: id, path: file, version: saved.version, replay: false,
      memory_entities: ['health-record:' + id, ...caseIds.map(caseId => 'case:' + caseId)],
      note: 'Capture selected sourced memory through the shared memory utility; do not infer a personal diagnosis or pattern.' };
  });
}
export function healthView(record) {
  const sources = record.sources.map(sourceStatus), reasons = [];
  if (record.state !== 'active') reasons.push('retracted');
  if (record.review_status !== 'reviewed') reasons.push('pending_source_review');
  if (['low', 'unknown'].includes(record.extraction_confidence)) reasons.push('uncertain_extraction');
  if (sources.some(source => !source.current)) reasons.push('source_not_current');
  return { ...record, source_status: sources, usable_as_recorded_evidence: !reasons.length, limitations: reasons };
}
export function healthTimeline(options = {}) {
  const from = dateOrNull(options.from), to = dateOrNull(options.to);
  ensure(!from || !to || from <= to, 'Timeline dates are reversed.');
  const collection = healthRecords(), caseLinked = new Set();
  if (options.case_id) {
    const definition = walk('records/cases', '.json').find(file => file.endsWith('/definition.json') && readJSON(file).case_id === options.case_id);
    ensure(definition, 'Unknown case.');
    for (const file of walk(definition.slice(0, definition.lastIndexOf('/')) + '/events', '.json')) {
      const event = readJSON(file);
      for (const ref of event.refs ?? []) {
        if (ref.path.startsWith('records/health/entries/')) { const linked = readJSON(ref.path); if (linked?.record_id) caseLinked.add(linked.record_id); }
      }
    }
  }
  const records = (options.history ? collection.all : collection.current)
    .filter(record => !options.subject || record.subject === options.subject)
    .filter(record => !options.case_id || record.case_ids.includes(options.case_id) || caseLinked.has(record.record_id))
    .map(record => ({ ...healthView(record), superseded: collection.current.find(current => current.record_id === record.record_id).file !== record.file }));
  const dated = records.filter(record => record.occurred_start && (!from || record.occurred_end >= from) && (!to || record.occurred_start <= to))
    .sort((a, b) => a.occurred_start.localeCompare(b.occurred_start) || a.recorded_at.localeCompare(b.recorded_at));
  return { from, to, subject: options.subject ?? null, case_id: options.case_id ?? null, history: Boolean(options.history),
    records: dated, unknown_date_records: records.filter(record => !record.occurred_start),
    note: 'Occurrence and recording time are distinct. Unknown-date evidence is retained separately; timeline links do not establish causation.' };
}
export function compareMeasurements(firstId, secondId) {
  const current = healthRecords().current;
  const find = id => { const record = current.find(item => item.record_id === id); ensure(record, 'Unknown health record: ' + id); return healthView(record); };
  const first = find(firstId), second = find(secondId), reasons = [];
  if (first.kind !== 'measurement' || second.kind !== 'measurement') reasons.push('not_measurements');
  for (const key of ['subject']) if (first[key] !== second[key]) reasons.push(key + '_differs');
  for (const key of ['name', 'unit', 'specimen', 'method']) if ((first.details[key] ?? null) !== (second.details[key] ?? null)) reasons.push(key + '_differs');
  if (![first, second].every(item => item.usable_as_recorded_evidence && item.evidence !== 'estimated'
    && number(item.details.value) && (!item.details.comparator || item.details.comparator === '='))) reasons.push('unusable_or_qualified_value');
  return { first, second, comparable: !reasons.length, reasons,
    delta: reasons.length ? null : Math.round((second.details.value - first.details.value) * 1e6) / 1e6,
    note: 'Arithmetic comparison only; preserve each report reference range and context. No unit conversion, normality classification, or clinical inference.' };
}
