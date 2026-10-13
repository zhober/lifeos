// Source-linked work/career facts and project designs. No automatic career or quality scores.
import fs from 'node:fs';
import path from 'node:path';
import { today, normDate, localDate } from './lib.mjs';
import { digest, stable, keyId, immutable, immutableBlob, withLock, readJSON, dateOrNull, sourceRefs } from './store.mjs';
import { ensure, textValue, strings, occurrence, versions, captureSources, sourceStatus } from './record-data.mjs';

export const CAREER_KINDS = ['project', 'project_state', 'work_session', 'milestone', 'evidence', 'opportunity', 'career_event'];
export const careerRecords = () => versions('records/career/entries', 'record_id');
const number = value => typeof value === 'number' && Number.isFinite(value);
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const identifier = value => textValue(value) && /^[a-z0-9][a-z0-9:_-]*$/.test(value);
const unique = values => new Set(values).size === values.length;

export function durationMinutes(duration) {
  if (!duration || duration.value == null) return null;
  ensure(number(duration.value) && duration.value >= 0 && ['min', 'h'].includes(duration.unit), 'Duration needs a nonnegative value and declared min/h unit.');
  const minutes = duration.value * (duration.unit === 'h' ? 60 : 1);
  ensure(number(minutes), 'Normalized duration must remain finite.'); return minutes;
}
function duration(input, planned = false) {
  ensure(object(input), 'Duration must be an object, with unknown value kept null.');
  if (input.value != null) durationMinutes(input);
  ensure(['active', 'elapsed', 'unspecified'].includes(input.basis), 'Declare active, elapsed or unspecified duration basis.');
  ensure(['measured', 'reported', 'estimated'].includes(input.quality), 'Declare measured, reported or estimated duration quality.');
  ensure(!planned || input.quality === 'estimated', 'Planned duration is an estimate, not measured work.');
}
function projectDetails(d) {
  ensure(textValue(d.objective) && Array.isArray(d.milestones), 'Project needs an objective and milestone list.');
  strings(d.constraints ?? [], 'constraints');
  const ids = d.milestones.map(m => m.id);
  ensure(ids.every(identifier) && unique(ids), 'Milestone IDs must be unique stable identifiers.');
  for (const m of d.milestones) {
    ensure(textValue(m.title) && textValue(m.acceptance_criteria), 'Milestones need a title and observable acceptance criteria.');
    dateOrNull(m.due_on);
    const deps = strings(m.depends_on ?? [], 'depends_on');
    ensure(unique(deps) && deps.every(id => ids.includes(id) && id !== m.id), 'Dependencies must name distinct milestones in this exact project.');
    if (m.planned_duration != null) duration(m.planned_duration, true);
  }
  const visiting = new Set(), visited = new Set();
  function visit(id) {
    ensure(!visiting.has(id), 'Milestone dependencies contain a cycle.');
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of d.milestones.find(m => m.id === id).depends_on ?? []) visit(dependency);
    visiting.delete(id); visited.add(id);
  }
  ids.forEach(visit); dateOrNull(d.review_on);
}
function validateDetails(input, collection) {
  const d = input.details, bindings = [];
  ensure(object(d), 'Career record needs typed details.');
  const bind = (file, kind, sameSubject = true) => {
    ensure(textValue(file), 'Supply an exact saved record path.');
    const record = collection.all.find(r => r.file === file);
    ensure(record && record.kind === kind && record.state === 'active', 'Linked record is missing, retracted or the wrong kind.');
    ensure(!sameSubject || record.subject === input.subject, 'Linked project belongs to another subject.');
    bindings.push({ ...sourceRefs([file])[0], record_id: record.record_id, kind }); return record;
  };
  const project = () => bind(d.project_ref, 'project');
  const milestone = p => {
    if (d.milestone_id != null) ensure(p.details.milestones.some(m => m.id === d.milestone_id), 'Milestone is absent from the exact linked project version.');
  };
  if (input.kind === 'project') projectDetails(d);
  else if (input.kind === 'project_state') {
    project();
    ensure(['accepted', 'paused', 'resumed', 'cancelled', 'reported_complete'].includes(d.status), 'Invalid project adoption/state report.');
    ensure(textValue(d.reason), 'Project state needs an attributed reason.');
  } else if (input.kind === 'work_session') {
    ensure(textValue(d.activity) && ['focus', 'meeting', 'admin', 'research', 'engineering', 'mixed', 'other', 'unknown'].includes(d.activity_type), 'Work session needs activity and declared type.');
    duration(d.duration);
    if (d.project_ref != null) milestone(project());
    else ensure(d.milestone_id == null, 'A milestone link needs an exact project reference.');
  } else if (input.kind === 'milestone') {
    const p = project(); ensure(textValue(d.milestone_id), 'Milestone event needs its stable slot ID.'); milestone(p);
    ensure(['not_started', 'in_progress', 'blocked', 'submitted', 'accepted', 'reported_complete', 'cancelled', 'unknown'].includes(d.status), 'Invalid observed milestone status.');
    ensure(textValue(d.description), 'Milestone event needs an attributed observation.');
    if (d.status === 'blocked') ensure(textValue(d.blocker), 'A blocked report needs its actual blocker or an explicit unknown-cause statement.');
    if (d.status === 'accepted') ensure(textValue(d.accepted_by), 'Acceptance needs the attributed reviewer/stakeholder.');
  } else if (input.kind === 'evidence') {
    ensure(['deliverable', 'feedback', 'skill_proof', 'assessment', 'result'].includes(d.type) && textValue(d.description), 'Evidence needs a type and actual attributed description.');
    strings(d.skills ?? [], 'skills');
    if (d.project_ref != null) milestone(project());
    else ensure(d.milestone_id == null, 'Evidence milestone needs an exact project.');
    ensure(Array.isArray(d.metrics ?? []), 'Metrics must be a list.');
    for (const m of d.metrics ?? []) {
      ensure(textValue(m.name) && (m.value == null || number(m.value)) && textValue(m.protocol), 'A metric needs a name, numeric/unknown value and measurement protocol.');
      ensure(m.value == null || textValue(m.unit), 'Numeric metrics need explicit units, including 1 for dimensionless values.');
    }
    if (d.type === 'feedback') ensure(textValue(d.author), 'Feedback needs actual author/role attribution.');
  } else if (input.kind === 'opportunity') {
    ensure(['job', 'academic', 'project', 'freelance', 'other'].includes(d.type) && textValue(d.description), 'Opportunity needs a type and source-grounded description.');
    dateOrNull(d.checked_on); dateOrNull(d.deadline_on);
    ensure(Array.isArray(d.requirements), 'Opportunity requirements must be a list, possibly empty.');
    const ids = d.requirements.map(r => r.id);
    ensure(ids.every(identifier) && unique(ids), 'Requirement IDs must be unique identifiers.');
    for (const requirement of d.requirements) {
      ensure(textValue(requirement.text) && ['required', 'preferred', 'gate', 'uncertain'].includes(requirement.category), 'Requirements need original meaning and an explicit category.');
      strings(requirement.skills ?? [], 'requirement skills');
    }
  } else if (input.kind === 'career_event') {
    ensure(identifier(d.process_id) && ['job_search', 'interview_practice', 'performance', 'promotion', 'transition', 'freelance'].includes(d.mode), 'Career events need stable process ID and declared mode.');
    ensure(['plan', 'observation'].includes(d.statement_type) && textValue(d.description), 'Separate proposed stages from observations.');
    ensure(['planned', 'prepared', 'contacted', 'submitted', 'interview', 'offer', 'accepted', 'declined', 'rejected', 'withdrawn', 'completed', 'unknown'].includes(d.stage), 'Invalid career stage.');
    ensure(d.statement_type !== 'observation' || d.stage !== 'planned', 'A planned stage is not observed execution.');
    if (d.opportunity_ref != null) bind(d.opportunity_ref, 'opportunity', false);
    const previous = collection.current.filter(r => r.state === 'active' && r.kind === 'career_event' && r.subject === input.subject && r.details.process_id === d.process_id && r.record_id !== input.record_id);
    ensure(previous.every(r => r.details.mode === d.mode), 'A process cannot silently switch mode.');
    const targetIds = new Set(previous.flatMap(r => r.bindings.filter(b => b.kind === 'opportunity').map(b => b.record_id)));
    for (const b of bindings.filter(b => b.kind === 'opportunity')) targetIds.add(b.record_id);
    ensure(targetIds.size <= 1, 'Different opportunities require distinct process IDs.');
  }
  const proposed = input.kind === 'project' || input.kind === 'career_event' && d.statement_type === 'plan';
  ensure(input.evidence !== 'inferred' || proposed, 'Inferred proposals cannot become actual work, adoption, skill proof or application history.');
  return bindings;
}

export function retainCareerOriginal(input) {
  ensure(textValue(input.source_path), 'Supply an authorized local source file.');
  const file = path.resolve(input.source_path), stat = fs.statSync(file), limit = readJSON('project.json')?.career?.original_max_bytes ?? 104857600;
  ensure(Number.isInteger(limit) && limit > 0 && stat.isFile() && stat.size > 0 && stat.size <= limit, 'Original is empty or exceeds the shared limit.');
  const ext = path.extname(file).slice(1).toLowerCase();
  ensure(['pdf', 'png', 'jpg', 'jpeg', 'webp', 'txt', 'md', 'csv', 'json', 'xml', 'doc', 'docx', 'xls', 'xlsx', 'py', 'js', 'mjs'].includes(ext), 'Unsupported original extension.');
  const date = dateOrNull(normDate(input.date)), bytes = fs.readFileSync(file);
  const relative = 'inbox/career/' + date + '/' + digest(bytes) + '.' + ext;
  return { ...immutableBlob(relative, bytes), original_name: path.basename(file), bytes: bytes.length, review_status: 'pending', note: 'Byte retention does not parse, execute or verify the source.' };
}

export function recordCareer(input) {
  ensure(textValue(input.operation_id), 'Career capture needs a stable operation_id.');
  return withLock('career-records', () => {
    const collection = careerRecords(), versionId = keyId('career-version', input.operation_id), fingerprint = digest(stable(input));
    const existing = collection.all.find(r => r.file.endsWith('/' + versionId + '.json'));
    if (existing) {
      ensure(existing.input_hash === fingerprint, 'Career operation ID reused with different input.');
      const current = collection.current.find(r => r.record_id === existing.record_id);
      return { record_id: existing.record_id, path: existing.file, current_path: current.file, version: existing.version, replay: true, superseded: existing.file !== current.file };
    }
    const id = input.record_id ?? keyId('career', input.operation_id);
    ensure(textValue(id) && /^[a-z0-9][a-z0-9_-]*$/.test(id) && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(id), 'Invalid filesystem-safe career record ID.');
    const previous = collection.current.find(r => r.record_id === id);
    ensure(previous ? input.supersedes === previous.file : !input.supersedes, 'Corrections must supersede the exact latest record.');
    ensure(CAREER_KINDS.includes(input.kind) && textValue(input.title) && textValue(input.subject), 'Supply kind, title and explicit subject.');
    ensure(!previous || previous.subject === input.subject && previous.kind === input.kind, 'Corrections retain subject/kind; retract a misassigned record and create a new one.');
    ensure(['reported', 'documented', 'inferred'].includes(input.evidence), 'Declare reported, documented or inferred evidence.');
    ensure(['reviewed', 'pending'].includes(input.review_status) && ['high', 'medium', 'low', 'unknown'].includes(input.extraction_confidence), 'Declare actual source review and extraction confidence.');
    ensure(['active', 'retracted'].includes(input.state ?? 'active'), 'Invalid record state.');
    const dates = occurrence(input), bindings = validateDetails({ ...input, record_id: id }, collection);
    if (input.occurred_at != null) {
      ensure(typeof input.occurred_at === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(input.occurred_at)
        && Number.isFinite(Date.parse(input.occurred_at)), 'Occurrence timestamp needs an explicit ISO timezone.');
      const day = localDate(input.occurred_at);
      ensure(dates.date_precision === 'day' && dates.occurred_start === day, 'Occurrence timestamp must match its explicitly recorded local date.');
    }
    const related = strings(input.related_record_ids ?? [], 'related_record_ids');
    ensure(related.every(link => collection.current.some(r => r.record_id === link)), 'Unknown related career record.');
    if (input.origin != null) {
      ensure(object(input.origin) && textValue(input.origin.provider) && textValue(input.origin.record_key), 'Origin needs provider and exact source record key.');
      ensure(!collection.current.some(r => r.state === 'active' && r.kind === input.kind && r.subject === input.subject && r.record_id !== id && r.origin?.provider === input.origin.provider && r.origin?.record_key === input.origin.record_key), 'Source record already exists; revise its canonical record_id rather than duplicate it.');
    }
    const captured = new Date().toISOString(), directory = previous ? previous.file.slice(0, previous.file.lastIndexOf('/'))
      : 'records/career/entries/' + captured.slice(0, 4) + '/' + id + '/versions';
    const file = directory + '/' + versionId + '.json';
    const saved = { ...input, schema_version: 1, record_id: id, version: (previous?.version ?? 0) + 1, ...dates,
      state: input.state ?? 'active', related_record_ids: related, bindings, sources: captureSources(input.sources), recorded_at: captured, input_hash: fingerprint };
    immutable(file, saved);
    return { record_id: id, path: file, version: saved.version, replay: false, memory_entities: ['career-record:' + id], note: 'Keep proposal, acceptance, actual work and outcomes separate; capture selected facts in shared memory.' };
  });
}

export function careerRecordView(record, collection = careerRecords()) {
  const sources = record.sources.map(sourceStatus), limitations = [];
  if (record.state !== 'active') limitations.push('retracted');
  if (record.review_status !== 'reviewed') limitations.push('pending_source_review');
  if (['low', 'unknown'].includes(record.extraction_confidence)) limitations.push('uncertain_extraction');
  if (sources.some(s => !s.current)) limitations.push('source_changed');
  const bindings = (record.bindings ?? []).map(binding => {
    let current = sourceStatus(binding).current;
    try { const linked = readJSON(binding.path), latest = collection.current.find(r => r.record_id === binding.record_id);
      current &&= linked?.state === 'active' && latest?.state === 'active' && linked.sources.every(s => sourceStatus(s).current); }
    catch { current = false; }
    return { ...binding, current };
  });
  if (bindings.some(b => !b.current)) limitations.push('linked_context_changed');
  return { ...record, source_status: sources, binding_status: bindings, limitations, usable_as_recorded_evidence: !limitations.length && record.evidence !== 'inferred' };
}

export function careerTimeline(options = {}, collection = careerRecords()) {
  const from = dateOrNull(options.from), to = dateOrNull(options.to);
  ensure(!from || !to || from <= to, 'Timeline dates are reversed.');
  ensure(!options.kind || CAREER_KINDS.includes(options.kind), 'Invalid timeline kind.');
  const records = (options.history ? collection.all : collection.current)
    .filter(r => !options.subject || r.subject === options.subject)
    .filter(r => !options.kind || r.kind === options.kind)
    .filter(r => !options.project_ref || r.details.project_ref === options.project_ref || r.file === options.project_ref)
    .map(r => ({ ...careerRecordView(r, collection), superseded: collection.current.find(c => c.record_id === r.record_id).file !== r.file }));
  return { from, to, records: records.filter(r => r.occurred_start && (!from || r.occurred_end >= from) && (!to || r.occurred_start <= to))
    .sort((a, b) => a.occurred_start.localeCompare(b.occurred_start) || a.recorded_at.localeCompare(b.recorded_at)),
    unknown_date_records: records.filter(r => !r.occurred_start), note: 'Occurrence and capture times differ; unknown dates are retained, not assigned to today.' };
}

export function careerProjectFingerprint(projectId, subject, collection = careerRecords()) {
  return digest(stable(collection.current.filter(r => r.kind === 'project_state' && r.subject === subject && r.bindings.some(b => b.record_id === projectId))
    .map(r => ({ id: r.record_id, version: r.version, file: r.file, state: r.state, status: r.details.status }))));
}

export function datedClaim(records, field, at = today()) {
  dateOrNull(at);
  const relevant = records.filter(r => r.state === 'active' && (!r.occurred_start || r.occurred_start <= at));
  const usable = relevant.filter(r => r.usable_as_recorded_evidence && r.date_precision === 'day');
  const unresolved = relevant.filter(r => r.date_precision !== 'day' || !r.usable_as_recorded_evidence);
  const day = usable.map(r => r.occurred_start).sort().at(-1);
  let last = usable.filter(r => r.occurred_start === day);
  if (last.length && last.every(r => r.occurred_at != null)) {
    const timestamp = Math.max(...last.map(r => Date.parse(r.occurred_at)));
    last = last.filter(r => Date.parse(r.occurred_at) === timestamp);
  }
  const values = [...new Set(last.map(field))];
  return { value: unresolved.length || values.length !== 1 ? null : values[0], as_of: at, evidence_date: day ?? null, claims: last,
    unresolved, conflict: values.length > 1, reason: unresolved.length ? 'unresolved_date_or_source' : values.length > 1 ? 'same_day_conflict' : !last.length ? 'missing_record' : null };
}
