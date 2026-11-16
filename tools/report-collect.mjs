// Minimal deterministic baseline. Mixed legacy material is gated before any content read.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, today, addDays, journalPath, parseDoc, sectionTable, timezone as configuredTimezone } from './lib.mjs';
import { walk, readJSON, vaultPath, currentHash, dateOrNull } from './store.mjs';
import { ensure } from './record-data.mjs';
import { getLanguagePreference } from './language.mjs';
import { reportSourcePermitted, REPORT_DOMAINS, REPORT_SCOPES } from './report-data.mjs';
import { status as requestStatus, events } from './work-state.mjs';

const descriptor = (id, relative) => ({ id, path: relative, sha256: currentHash(vaultPath(relative)), scopes: REPORT_SCOPES, fields: ['mixed_personal_records'], mixed: true, precision: 'detailed' });
const rawGate = () => reportSourcePermitted({ scopes: REPORT_SCOPES, fields: ['mixed_personal_records'], mixed: true, precision: 'detailed' });
const numeric = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
const sourceDay = (instant, timezone) => new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date(instant));
function endOfDay(date, timezone) {
  // Resolve the UTC instant of the next local midnight, including offset/DST changes.
  const next = addDays(date, 1), desired = Date.parse(next + 'T00:00:00Z'); let candidate = desired;
  for (let i = 0; i < 5; i++) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(candidate)).map(part => [part.type, part.value]));
    const local = Date.parse(parts.year + '-' + parts.month + '-' + parts.day + 'T' + parts.hour + ':' + parts.minute + ':' + parts.second + 'Z');
    const delta = desired - local; if (!delta) return candidate - 1; candidate += delta;
  }
  throw new Error('Unable to resolve this local-day boundary.');
}
const headings = { career: '工作', study: '学习', nutrition: '饮食', fitness: '运动', health: '睡眠与身体', psych: '心情与想法' };
function section(body, heading) {
  const lines = body.split(/\r?\n/), begin = lines.findIndex(line => line.trim() === '## ' + heading);
  if (begin < 0) return '';
  let end = lines.findIndex((line, index) => index > begin && /^## /.test(line)); if (end < 0) end = lines.length;
  return lines.slice(begin + 1, end).filter(line => !/^\s*<!--/.test(line) && !/^\s*\|\s*[-:]/.test(line)).join('\n').trim();
}
// One line per activity for the report's training block: counts and reported loads only, nothing derived.
const loadText = load => load && typeof load.value === 'number' ? load.value + ' ' + (load.unit ?? '') + (load.convention === 'per_implement' ? '/只' : '') : null;
function trainingActivity(activity) {
  const sets = Array.isArray(activity.sets) ? activity.sets : [];
  const reps = [...new Set(sets.map(set => set.reps).filter(value => typeof value === 'number'))], loads = [...new Set(sets.map(set => loadText(set.external_load)).filter(Boolean))];
  return { name: String(activity.name ?? '').slice(0, 200), sets: sets.length || null, reps: reps.length ? reps.join('/') : null, load: loads.length ? loads.join('/') : null,
    minutes: typeof activity.duration_min === 'number' ? activity.duration_min : null };
}
export async function collectDailyReport(date = today(), options = {}) {
  dateOrNull(date); ensure(date, 'Supply a valid date.');
  const timezone = configuredTimezone();
  const input = { schema_version: 1, kind: 'daily_report_input', date, timezone, language: getLanguagePreference().interaction_language,
    basis: options.basis ?? (fs.existsSync(vaultPath('.lifeos-deploy.json')) ? 'personal' : 'fictional'), style: 'data_actions',
    sources: [], metrics: [], sections: REPORT_DOMAINS.map(domain => ({ domain, status: 'missing', items: [] })), actions: [], followups: [], summary: [], trends: [], gaps: [] };
  const sections = new Map(input.sections.map(section => [section.domain, section]));
  if (!rawGate()) {
    input.sections.forEach(section => { section.status = 'withheld'; });
    input.gaps.push({ code: 'mixed_sources_require_scoped_context', domain: null });
    return input;
  }
  const targetsFile = vaultPath('records/nutrition/targets.json');
  if (fs.existsSync(targetsFile)) { const stored = readJSON('records/nutrition/targets.json'); if (stored && stored.daily && typeof stored.daily === 'object') input.targets = stored.daily; }
  const sourceIds = new Map();
  const addSource = relative => {
    relative = relative.replaceAll('\\', '/'); if (sourceIds.has(relative)) return sourceIds.get(relative);
    const id = 'source_' + String(sourceIds.size + 1); input.sources.push(descriptor(id, relative)); sourceIds.set(relative, id); return id;
  };
  const file = journalPath(date), exists = fs.existsSync(file), relative = path.relative(ROOT, file).replaceAll('\\', '/');
  let doc = { data: {}, body: '' }, journalSource = null;
  if (exists) {
    journalSource = addSource(relative); doc = parseDoc(fs.readFileSync(file, 'utf8'));
    for (const [domain, heading] of Object.entries(headings)) {
      const body = section(doc.body, heading), tableOnly = body.split('\n').filter(line => line.trim()).every(line => /^\s*\|/.test(line));
      const hasData = body && (!tableOnly || body.split('\n').filter(line => /^\s*\|/.test(line)).length > 1);
      if (hasData) { sections.get(domain).status = 'recorded'; sections.get(domain).items.push({ text: body, evidence: 'reported', source_ids: [journalSource] }); }
    }
  } else input.gaps.push({ code: 'journal_missing', domain: null });
  const chinese = input.language.startsWith('zh');
  const metric = (id, domain, labelZh, labelEn, unit, value, options = {}) => {
    const invalid = numeric(value) != null && (unit === '1–5' ? value < 1 || value > 5 : value < 0);
    if (invalid) { input.gaps.push({ code: 'metric_unit_or_scale_unconfirmed', domain }); value = null; }
    input.metrics.push({ id, domain, label: chinese ? labelZh : labelEn, unit, value: numeric(value), range: invalid ? null : options.range ?? null,
      coverage: invalid ? 'unknown' : options.coverage ?? 'unconfirmed', evidence: options.evidence ?? 'reported', source_ids: invalid ? [] : options.source_ids ?? (journalSource && value != null ? [journalSource] : []) });
  };
  metric('work_h', 'career', '工作记录时长', 'Recorded work', 'h', doc.data.work_h, { evidence: 'legacy_unverified' });
  const studyRows = sectionTable(doc.body, '学习');
  const studyValues = studyRows.map(row => /^\d+(?:\.\d+)?$/.test(String(row['时长min']).trim()) ? Number(row['时长min']) : null);
  const study = studyValues.length ? studyValues.every(value => value != null) ? studyValues.reduce((sum, value) => sum + value, 0) : null : doc.data.study_min;
  metric('study_min', 'study', '学习记录时长', 'Recorded study', 'min', study, { evidence: 'legacy_unverified', coverage: studyValues.length && studyValues.some(value => value == null) ? 'partial' : 'unconfirmed' });
  for (const [id, labelZh, labelEn, unit] of [['sleep_h', '睡眠记录', 'Recorded sleep', 'h'], ['sleep_quality', '睡眠主观评分', 'Sleep self-rating', '1–5'], ['weight_kg', '体重记录', 'Recorded weight', 'kg'], ['steps', '步数记录', 'Recorded steps', 'steps'], ['water_ml', '饮水记录', 'Recorded water', 'ml']])
    metric(id, id === 'steps' ? 'fitness' : id === 'water_ml' ? 'nutrition' : 'health', labelZh, labelEn, unit, doc.data[id]);
  for (const [id, labelZh, labelEn] of [['mood', '心情自评', 'Mood self-rating'], ['energy', '精力自评', 'Energy self-rating'], ['stress', '压力自评', 'Stress self-rating']]) metric(id, 'psych', labelZh, labelEn, '1–5', doc.data[id]);
  // Reuse the canonical day resolvers only after the broad mixed-file disclosure gate.
  const [{ nutritionView }, { latestMeals }, { latestIndependent }, { fitnessDay }, { fitnessRecords }] = await Promise.all([
    import('./nutrition-view.mjs'), import('./meal-data.mjs'), import('./nutrition-independent.mjs'), import('./fitness-day.mjs'), import('./fitness-data.mjs')]);
  let nutrition;
  try { nutrition = nutritionView(date, doc, latestMeals(), latestIndependent()); }
  catch { input.gaps.push({ code: 'nutrition_records_unavailable', domain: 'nutrition' }); nutrition = { meal_records: [], complete_day_eligible: {}, nutrient_quality: {}, total: {}, ranges: {}, known_subtotal: {}, known_ranges: {}, conflicts: [], intake_day_status: 'unknown' }; }
  const mealRefs = [...nutrition.meal_records, ...(nutrition.coverage_record ? [nutrition.coverage_record] : []), ...(nutrition.independent_record ? [nutrition.independent_record] : [])].map(addSource);
  const nutritionRefs = [...new Set([...(journalSource ? [journalSource] : []), ...mealRefs])];
  const nutritionLabels = { kcal: ['热量记录', 'Recorded energy', 'kcal'], protein: ['蛋白质记录', 'Recorded protein', 'g'], fat: ['脂肪记录', 'Recorded fat', 'g'], carb: ['碳水记录', 'Recorded carbohydrate', 'g'], fiber: ['膳食纤维记录', 'Recorded fiber', 'g'], Na: ['钠记录', 'Recorded sodium', 'mg'] };
  for (const [key, labels] of Object.entries(nutritionLabels)) {
    const full = nutrition.complete_day_eligible[key], conflict = nutrition.nutrient_quality[key] === 'conflict', value = conflict ? null : full ? nutrition.total[key] : nutrition.known_subtotal[key];
    metric(key.toLowerCase(), 'nutrition', ...labels, value, { range: conflict ? null : full ? nutrition.ranges[key] : nutrition.known_ranges[key], coverage: conflict ? 'unknown' : full ? 'complete' : value == null ? 'unknown' : 'partial',
      evidence: nutrition.nutrient_quality[key]?.includes('unverified') ? 'legacy_unverified' : 'estimated', source_ids: value == null ? [] : nutritionRefs });
  }
  if (nutrition.conflicts.length) input.gaps.push({ code: 'nutrition_conflict', domain: 'nutrition' });
  if (nutrition.intake_day_status !== 'confirmed_complete') input.gaps.push({ code: 'nutrition_day_not_confirmed_complete', domain: 'nutrition' });
  let fitness;
  try { fitness = fitnessDay(date, doc, fitnessRecords('sessions').current); }
  catch { input.gaps.push({ code: 'fitness_records_unavailable', domain: 'fitness' }); fitness = { session_paths: [], total_duration_min: null, quality: 'unknown', invalidated_links: [] }; }
  const exerciseRefs = [...new Set([...(journalSource ? [journalSource] : []), ...fitness.session_paths.map(addSource)])];
  metric('exercise_min', 'fitness', '运动记录时长', 'Recorded exercise', 'min', fitness.total_duration_min, { evidence: fitness.quality === 'sourced_record' ? 'reported' : 'legacy_unverified', source_ids: fitness.total_duration_min == null ? [] : exerciseRefs });
  if (fitness.invalidated_links.length) input.gaps.push({ code: 'fitness_link_changed', domain: 'fitness' });
  const training = [];
  for (const sessionPath of fitness.session_paths) {
    const record = readJSON(sessionPath);
    if (record && Array.isArray(record.activities) && record.activities.length) training.push({ title: String(record.title ?? '').slice(0, 200) || '训练', activities: record.activities.map(trainingActivity) });
  }
  if (training.length) input.training = training;
  const cutoff = Math.min(endOfDay(date, timezone), Date.now());
  for (const definitionPath of walk('actions', '.json').filter(file => file.endsWith('/definition.json'))) {
    const definition = readJSON(definitionPath);
    if (!Number.isFinite(Date.parse(definition.recorded_at)) || Date.parse(definition.recorded_at) > cutoff) continue;
    const history = events(definitionPath.slice(0, -'definition.json'.length)).filter(event => Date.parse(event.recorded_at) <= cutoff);
    const latest = history.at(-1); let due = definition.due ?? null; for (const event of history) if (Object.hasOwn(event, 'due')) due = event.due;
    const status = latest?.status ?? 'proposed';
    const changedToday = latest && sourceDay(latest.recorded_at, timezone) === date;
    if (!changedToday && !['accepted', 'in_progress'].includes(status) && sourceDay(definition.recorded_at, timezone) !== date) continue;
    const refs = [addSource(definitionPath), ...(latest ? [addSource(latest.file)] : [])];
    let requestState = 'unknown';
    try { const task = requestStatus(definition.request_id); requestState = task.control_state === 'active' ? task.state.startsWith('completed') ? 'completed' : 'active' : task.control_state;
      refs.push(addSource(task.file)); for (const event of task.history ?? []) if (event.file) refs.push(addSource(event.file)); } catch { input.gaps.push({ code: 'linked_task_unavailable', domain: 'career' }); }
    input.actions.push({ id: definition.id, domain: 'career', text: definition.text, owner: definition.owner, due, status, status_recorded_at: latest?.recorded_at ?? definition.recorded_at,
      request_state: ['active', 'waiting', 'paused', 'cancelled', 'superseded', 'completed'].includes(requestState) ? requestState : 'unknown', source_ids: [...new Set(refs)] });
  }
  const { caseQueue, caseDefinitions } = await import('./case-data.mjs'); let definitions = [], queue = [];
  try { definitions = caseDefinitions(); queue = caseQueue(date); } catch { input.gaps.push({ code: 'coordination_records_unavailable', domain: null }); }
  for (const item of queue.filter(item => item.state !== 'closed' && item.request_binding.dispatch_allowed !== false)) {
    const definition = definitions.find(definition => definition.case_id === item.case_id), refs = [addSource(definition.file)];
    const domain = definition.domains.find(domain => REPORT_DOMAINS.includes(domain)) ?? 'career';
    // Include immutable case events, so a changed/answered thread invalidates the saved queue.
    for (const file of walk(definition.file.slice(0, -'definition.json'.length) + 'events', '.json')) refs.push(addSource(file));
    if (item.needs_reassessment) input.followups.push({ domain, text: (chinese ? '共享问题需要重新核对：' : 'Shared case needs reassessment: ') + item.title, kind: 'case_reassessment', dispatch_allowed: false, source_ids: refs });
    for (const question of item.pending_questions) input.followups.push({ domain, text: (chinese ? '专家问题待处理：' : 'Expert question pending: ') + item.title + ' / ' + question.to_expert,
      kind: 'pending_question', dispatch_allowed: question.dispatch_allowed, source_ids: refs });
    for (const followup of item.due_followups) input.followups.push({ domain, text: followup.description ?? followup.text ?? item.title, kind: 'case_followup', dispatch_allowed: false, source_ids: refs });
  }
  const trendFields = [['sleep_h', 'health', '睡眠记录趋势', 'Recorded sleep trend', 'h'], ['study_min', 'study', '学习记录趋势', 'Recorded study trend', 'min']];
  for (const [field, domain, zh, en, unit] of trendFields) {
    const points = [], refs = [];
    for (let day = addDays(date, -6); day <= date; day = addDays(day, 1)) {
      const file = journalPath(day); let value = null;
      if (fs.existsSync(file)) { const relative = path.relative(ROOT, file).replaceAll('\\', '/'); refs.push(addSource(relative)); const data = parseDoc(fs.readFileSync(file, 'utf8')).data; value = numeric(data[field]); }
      points.push({ date: day, value });
    }
    if (points.some(point => point.value != null)) input.trends.push({ metric_id: field, domain, label: chinese ? zh : en, unit, points, source_ids: [...new Set(refs)] });
  }
  return input;
}
