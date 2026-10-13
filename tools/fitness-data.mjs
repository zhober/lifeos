// Immutable training observations and plans. Execution, interpretation and review remain with the runtime.
import fs from 'node:fs';
import path from 'node:path';
import { normDate, today } from './lib.mjs';
import { keyId, digest, stable, immutable, immutableBlob, readJSON, walk, withLock, vaultPath, currentHash, dateOrNull } from './store.mjs';
import { ensure, textValue, strings, versions, captureSources, sourceStatus } from './record-data.mjs';
import { deriveSession, positive, numeric, quantity, rating, load } from './fitness-metrics.mjs';
import { healthRecords, healthView } from './health-data.mjs';

const identifiers = { sessions: 'session_id', plans: 'plan_id', recovery: 'recovery_id', assessments: 'assessment_id' };
export function fitnessRecords(kind) { ensure(Object.hasOwn(identifiers, kind), 'Unknown fitness record kind.'); return versions('records/fitness/' + kind, identifiers[kind]); }
export function fitnessRecordView(record) {
  const checks = record.sources.map(sourceStatus), limits = [];
  if (record.state !== 'active') limits.push('retracted');
  if (record.review_status !== 'reviewed') limits.push('pending_review');
  if (['low', 'unknown'].includes(record.extraction_confidence)) limits.push('uncertain_extraction');
  if (record.evidence === 'estimated' && record.record_kind !== 'plans') limits.push('estimated');
  if (checks.some(source => !source.current)) limits.push('source_changed');
  if (record.health_refs?.length) {
    const currentHealth = healthRecords().current;
    if (record.health_refs.some(ref => !sourceStatus(ref).current || !currentHealth.some(item => item.file === ref.path && item.state === 'active'
      && healthView(item).source_status.every(source => source.current))))
      limits.push('health_context_changed');
  }
  return { ...record, source_status: checks, usable_as_recorded_evidence: !limits.length, limitations: limits };
}
function planSpec(input) {
  ensure(textValue(input.goal) && Array.isArray(input.schedule), 'Plan needs a goal and schedule.');
  const start = dateOrNull(input.valid_from), end = dateOrNull(input.valid_to), ids = new Set();
  ensure(start && end && start <= end, 'Plan needs ordered validity dates.'); dateOrNull(input.review_on); strings(input.constraints ?? [], 'plan constraints');
  const schedule = input.schedule.map(slot => {
    ensure(textValue(slot.slot_id) && !ids.has(slot.slot_id), 'Plan slot IDs must be unique.'); ids.add(slot.slot_id);
    const date = dateOrNull(slot.date); ensure(date && date >= start && date <= end && textValue(slot.title), 'Plan slot needs a date within validity and title.');
    ensure(typeof slot.rest === 'boolean' && Array.isArray(slot.activities), 'Plan slot needs explicit rest and activities.');
    ensure(slot.target_duration_min == null || positive(slot.target_duration_min), 'Target duration must be nonnegative or unknown.');
    ensure(!slot.rest || !slot.target_duration_min && !slot.activities.length, 'A rest slot cannot contain prescribed exercise.');
    const activityIds = new Set();
    for (const activity of slot.activities) {
      ensure(textValue(activity.id) && !activityIds.has(activity.id), 'Plan activity IDs must be unique.'); activityIds.add(activity.id);
      ensure(textValue(activity.name) && textValue(activity.exercise_key) && textValue(activity.equipment_key)
        && ['resistance', 'endurance', 'mobility', 'sport', 'other'].includes(activity.type), 'Plan activity needs type and comparable exercise/equipment keys.');
      ensure(activity.target_work_sets == null || Number.isInteger(activity.target_work_sets) && activity.target_work_sets >= 0, 'Target sets must be a nonnegative integer.');
      if (activity.target_reps) ensure(Number.isInteger(activity.target_reps.low) && Number.isInteger(activity.target_reps.high)
        && activity.target_reps.low >= 0 && activity.target_reps.low <= activity.target_reps.high, 'Target repetitions require ordered integer bounds.');
      if (activity.target_reps) ensure(['total', 'per_side'].includes(activity.reps_basis), 'Plan repetition basis is required.');
      if (activity.target_reps && activity.reps_basis === 'per_side') ensure(Number.isInteger(activity.sides) && activity.sides > 0, 'Plan per-side repetitions need side count.');
      load(activity.target_external_load); quantity(activity.target_distance, ['m', 'km', 'mile'], 'Target distance'); rating(activity.target_rpe, 'Target RPE');
      ensure(activity.target_duration_min == null || positive(activity.target_duration_min), 'Activity target duration is invalid.');
    }
    return { ...slot, date };
  });
  return { goal: input.goal, valid_from: start, valid_to: end, review_on: input.review_on ?? null,
    constraints: input.constraints ?? [], rationale: input.rationale ?? null, schedule };
}
function requireRecord(kind, id) {
  const record = fitnessRecords(kind).current.find(item => item[identifiers[kind]] === id); ensure(record, 'Unknown linked fitness record: ' + id); return record;
}
function linkedPlan(link, subject) {
  if (!link) return null;
  ensure(textValue(link.path) && textValue(link.slot_id), 'Session plan link needs exact plan path and slot_id.');
  const record = fitnessRecords('plans').all.find(item => item.file === link.path);
  ensure(record && record.subject === subject && record.schedule.some(slot => slot.slot_id === link.slot_id), 'Invalid plan version, subject, or slot link.');
  if (link.sha256) ensure(currentHash(vaultPath(link.path)) === link.sha256, 'Linked plan bytes changed.');
  return { ...link, sha256: currentHash(vaultPath(link.path)), plan_id: record.plan_id };
}
export function recordFitness(kind, input) {
  ensure(textValue(input.operation_id), 'Fitness capture needs a stable operation_id.');
  return withLock('fitness-records', () => {
    const idField = identifiers[kind], collection = fitnessRecords(kind), fingerprint = digest(stable(input)), versionId = keyId('fitness-version', input.operation_id);
    const replay = collection.all.find(record => record.file.endsWith('/' + versionId + '.json'));
    if (replay) {
      ensure(replay.input_hash === fingerprint, 'Fitness operation ID reused with different input.');
      const current = collection.current.find(record => record[idField] === replay[idField]);
      return { [idField]: replay[idField], path: replay.file, current_path: current.file, version: replay.version, replay: true,
        superseded: replay.file !== current.file, journal_projection: kind === 'sessions' && replay.file === current.file ? sessionProjection(replay) : null };
    }
    const sourceKey = input.source_record_key;
    if (sourceKey) ensure(textValue(sourceKey.source) && textValue(sourceKey.id), 'External record key needs source and id.');
    const id = input[idField] ?? keyId('fitness-' + kind, sourceKey ? stable(sourceKey) : input.operation_id);
    ensure(/^[a-z0-9][a-z0-9-]*$/.test(id), 'Invalid fitness identifier.');
    const previous = collection.current.find(record => record[idField] === id);
    ensure(!previous || input.supersedes === previous.file, 'Fitness correction must supersede the exact latest version.');
    ensure(previous || !input.supersedes, 'Cannot supersede unknown fitness record.');
    ensure(!sourceKey || !collection.current.some(record => stable(record.source_record_key) === stable(sourceKey) && record[idField] !== id), 'External record already maps to another canonical record.');
    ensure(textValue(input.subject) && textValue(input.title), 'Fitness record needs explicit subject and title.');
    ensure(!previous || previous.subject === input.subject, 'Subject corrections require retraction and a new record.');
    ensure(['active', 'retracted'].includes(input.state ?? 'active') && ['reported', 'measured', 'estimated'].includes(input.evidence), 'State record validity and evidence method.');
    ensure(['reviewed', 'pending'].includes(input.review_status) && ['high', 'medium', 'low', 'unknown'].includes(input.extraction_confidence), 'Record review/extraction status.');
    const caseIds = strings(input.case_ids ?? [], 'case_ids');
    for (const caseId of caseIds) ensure(walk('records/cases', '.json').some(file => file.endsWith('/definition.json') && readJSON(file).case_id === caseId), 'Unknown linked case.');
    const date = dateOrNull(input.date), dateBasis = input.date_basis ?? (date ? 'supplied_date' : 'unknown');
    ensure(['supplied_date', 'capture_assumed', 'unknown'].includes(dateBasis) && Boolean(date) === (dateBasis !== 'unknown'), 'Keep unknown occurrence dates null and stated dates explicit.');
    if (dateBasis === 'capture_assumed') ensure(Array.isArray(input.assumptions) && input.assumptions.length > 0, 'An assumed date needs explicit assumptions.');
    let details = {}, derived;
    if (kind === 'sessions') {
      derived = deriveSession(input); details.plan_link = linkedPlan(input.plan_link, input.subject);
      if (details.plan_link) {
        const plan = readJSON(details.plan_link.path), slot = plan.schedule.find(item => item.slot_id === details.plan_link.slot_id);
        for (const activity of input.activities) if (activity.plan_activity_id) ensure(slot.activities.some(target => target.id === activity.plan_activity_id), 'Unknown linked plan activity.');
      }
    } else if (kind === 'plans') details = planSpec(input);
    else if (kind === 'recovery') {
      ensure(['before', 'during', 'after', 'follow_up'].includes(input.timing), 'Recovery needs timing relative to training.');
      ensure(input.sleep_h == null || positive(input.sleep_h), 'Sleep hours must be nonnegative or unknown.');
      for (const key of ['fatigue', 'soreness', 'readiness']) {
        if (input[key]) ensure(input[key].scale === 'reported_0_to_10' && numeric(input[key].value) && input[key].value >= 0 && input[key].value <= 10, 'Recovery ratings need explicitly reported 0-to-10 scales.');
      }
      if (input.session_id) ensure(requireRecord('sessions', input.session_id).subject === input.subject, 'Recovery belongs to another subject.');
    } else if (kind === 'assessments') {
      ensure(textValue(input.metric_key) && textValue(input.protocol_key) && textValue(input.equipment_key), 'Assessment needs explicit metric/protocol/equipment keys.');
      details.normalized_value = quantity(input.value, Object.keys({ kg: 1, lb: 1, m: 1, km: 1, mile: 1, s: 1, min: 1, count: 1, W: 1, bpm: 1 }), 'Assessment value');
      ensure(input.conditions == null || textValue(input.conditions), 'Record comparable test conditions or leave them unknown.');
      if (input.session_id) ensure(requireRecord('sessions', input.session_id).subject === input.subject, 'Assessment belongs to another subject.');
    }
    ensure(input.health_refs === undefined || Array.isArray(input.health_refs), 'Health references must be an array.');
    // A supplied record_id is resolved to its current version path; anything else must be a canonical entries path.
    const resolvedHealthRefs = (input.health_refs ?? []).map(source => {
      const ref = typeof source === 'string' ? { path: source } : { ...source };
      ensure(textValue(ref.path), 'Each health reference needs a records/health/entries/... path or a known health record ID.');
      if (!ref.path.startsWith('records/health/entries/')) {
        const resolved = healthRecords().current.find(record => record.record_id === ref.path);
        ensure(resolved, 'Health references need a records/health/entries/... path or an existing record_id; got: ' + ref.path);
        ref.path = resolved.file;
      }
      ensure(readJSON(ref.path)?.subject === input.subject, 'Health context must reference the same subject.');
      return ref;
    });
    details.health_refs = resolvedHealthRefs.length ? captureSources(resolvedHealthRefs) : [];
    const captured = new Date().toISOString(), directory = previous ? previous.file.slice(0, previous.file.lastIndexOf('/'))
      : 'records/fitness/' + kind + '/' + captured.slice(0, 4) + '/' + id + '/versions';
    const file = directory + '/' + versionId + '.json';
    const saved = { ...input, ...details, schema_version: 1, record_kind: kind, [idField]: id, version: (previous?.version ?? 0) + 1,
      state: input.state ?? 'active', date, date_basis: dateBasis, case_ids: caseIds, recorded_at: captured,
      sources: captureSources(input.sources), input_hash: fingerprint, ...(derived ? { derived } : {}) };
    immutable(file, saved);
    return { [idField]: id, path: file, version: saved.version, replay: false, derived,
      journal_projection: kind === 'sessions' ? sessionProjection({ ...saved, file }) : null,
      memory_entities: ['fitness-record:' + id, ...caseIds.map(caseId => 'case:' + caseId)] };
  });
}
export function sessionProjection(record) {
  const escape = value => String(value ?? '').replaceAll('|', '&#124;').replace(/[\r\n]/g, ' ');
  const duration = record.state === 'active' ? record.derived.duration_min : null, rpe = record.derived.session_rpe;
  return { session_id: record.session_id, date: record.date, subject: record.subject,
    row: '| ' + [record.time ?? '', record.title, duration ?? '', rpe ? 'RPE ' + rpe.value + ' (' + rpe.scale + ')' : '',
      'fitness:' + record.session_id + '; ' + (record.state === 'retracted' ? 'retracted' : record.completion) + '; [record](../../' + record.file + ')'].map(escape).join(' | ') + ' |',
    note: 'One organized projection per actual event. Do not project another subject or unknown date into the self journal.' };
}
export function planEvents(planId) {
  const events = walk('records/fitness/plan-events', '.json').map(file => ({ ...readJSON(file), file })).filter(event => event.plan_id === planId).sort((a, b) => a.sequence - b.sequence);
  events.forEach((event, index) => ensure(event.schema_version === 1 && event.sequence === index + 1, 'Invalid or branched fitness plan-state events.'));
  return events;
}
export function planStateFor(file) {
  const plan = readJSON(file), events = planEvents(plan.plan_id), latestForVersion = events.filter(event => event.plan_path === file).at(-1);
  const effective = events.at(-1);
  const current = fitnessRecords('plans').current.find(record => record.plan_id === plan.plan_id);
  const adopted = effective?.plan_path === file && effective.status === 'accepted' && current?.state === 'active'
    && latestForVersion.plan_sha256 === currentHash(vaultPath(file)) && latestForVersion.sources.every(source => sourceStatus(source).current);
  const applicable = plan.valid_from <= today() && today() <= plan.valid_to;
  return { status: latestForVersion?.status ?? 'proposed', event_path: latestForVersion?.file ?? null,
    effective_plan_path: effective?.plan_path ?? null, effective_status: effective?.status ?? 'proposed',
    adopted_version: Boolean(adopted), applicable_today: applicable, accepted_for_current_use: Boolean(adopted && applicable),
    note: 'Sourced user plan state is separate from review approval, actual execution and historical applicability.' };
}
export function setPlanState(input) {
  ensure(textValue(input.operation_id) && textValue(input.plan_id), 'Plan state needs operation and plan identifiers.');
  return withLock('fitness-plan-state/' + input.plan_id, () => {
    const events = planEvents(input.plan_id), id = keyId('fitness-state', input.operation_id), fingerprint = digest(stable(input));
    const existing = events.find(event => event.event_id === id);
    if (existing) { ensure(existing.input_hash === fingerprint, 'Plan-state operation ID reused.'); return { path: existing.file, replay: true }; }
    ensure(input.expected_sequence === events.length, 'Plan state changed; reread before mutation.');
    const plan = fitnessRecords('plans').all.find(item => item.file === input.plan_path && item.plan_id === input.plan_id);
    ensure(plan && plan.state === 'active', 'Unknown or retracted plan version.');
    if (input.status === 'accepted') ensure(fitnessRecords('plans').current.find(item => item.plan_id === input.plan_id).file === input.plan_path
      || events.at(-1)?.plan_path === input.plan_path && events.at(-1)?.status === 'paused', 'Accept the current exact plan version or explicitly resume its previously adopted paused version.');
    ensure(['accepted', 'paused', 'cancelled', 'reported_complete'].includes(input.status) && input.basis === 'user_report'
      && textValue(input.reason), 'Plan state requires explicit user-report basis, status and reason.');
    const previous = events.at(-1);
    ensure(input.status === 'accepted' || previous?.plan_path === input.plan_path && ['accepted', 'paused'].includes(previous.status), 'Only the effective accepted/paused version can be paused, cancelled or reported complete.');
    const directory = plan.file.split('/versions/')[0].replace('/plans/', '/plan-events/'), file = directory + '/' + String(events.length + 1).padStart(6, '0') + '-' + id + '.json';
    immutable(file, { ...input, schema_version: 1, event_id: id, sequence: events.length + 1, input_hash: fingerprint,
      recorded_at: new Date().toISOString(), sources: captureSources(input.sources), plan_sha256: currentHash(vaultPath(input.plan_path)) });
    return { path: file, replay: false };
  });
}
// Validate a fitness original and derive its retained path without writing.
export function fitnessOriginal(input) {
  ensure(textValue(input.source_path), 'Provide a user-supplied export/media path.');
  const file = path.resolve(input.source_path), stat = fs.statSync(file), maximum = readJSON('project.json')?.fitness?.original_max_bytes ?? 104857600;
  ensure(Number.isInteger(maximum) && maximum > 0 && stat.isFile() && stat.size > 0 && stat.size <= maximum, 'Fitness original is empty or exceeds size limit.');
  const ext = path.extname(file).slice(1).toLowerCase();
  ensure(['json', 'csv', 'gpx', 'tcx', 'fit', 'xml', 'txt', 'md', 'pdf', 'png', 'jpg', 'jpeg', 'webp', 'heic', 'avif'].includes(ext), 'Unsupported fitness original extension.');
  const bytes = fs.readFileSync(file), date = dateOrNull(normDate(input.date)), sha256 = digest(bytes);
  return { file, bytes, sha256, path: 'inbox/fitness/' + date + '/' + sha256 + '.' + ext };
}
export function retainFitnessOriginal(input) {
  const { file, bytes, path: relative } = fitnessOriginal(input);
  return { ...immutableBlob(relative, bytes), original_name: path.basename(file), bytes: bytes.length, review_status: 'pending',
    note: 'Retention does not parse FIT/GPX/media or verify a device measurement.' };
}
