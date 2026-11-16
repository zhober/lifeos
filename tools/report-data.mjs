// Normalize a caller-prepared daily dataset, filter saved disclosure and verify used sources.
import { ROOT, addDays } from './lib.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { digest, stable, vaultPath, currentHash, dateOrNull, readJSON } from './store.mjs';
import { ensure, textValue } from './record-data.mjs';
import { disclosurePolicy } from './privacy.mjs';
import { financeSourceAllowed, financeRecord } from './finance-data.mjs';

export const REPORT_DOMAINS = readJSON('project.json')?.reporting?.domains ?? ['career', 'study', 'nutrition', 'fitness', 'health', 'finance', 'shopping', 'psych', 'travel'];
export const REPORT_SCOPES = [...REPORT_DOMAINS, 'relationships', 'family', 'identity', 'location'];
export const domainScopes = domain => domain === 'psych' ? ['psych', 'relationships'] : [domain];
const identifier = value => typeof value === 'string' && /^[a-z][a-z0-9_-]*$/.test(value);
const statuses = ['proposed', 'accepted', 'in_progress', 'completed', 'deferred', 'declined', 'cancelled', 'unknown'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const refs = value => Array.isArray(value) && value.every(identifier);
const text = (value, max = 12000) => textValue(value) && value.length <= max;
export function reportSourcePermitted(source) {
  ensure(Array.isArray(source.scopes) && source.scopes.every(identifier) && !source.scopes.includes('defaults'), 'Report sources need explicit subject scopes.');
  ensure(Array.isArray(source.fields) && source.fields.every(identifier), 'Report source fields must be identifiers.');
  ensure(typeof source.mixed === 'boolean' && ['detailed', 'summary', 'range'].includes(source.precision), 'Declare mixed source exposure and input precision.');
  const preferences = readJSON(readJSON('project.json').interaction.preferences_file);
  const scopes = source.mixed ? [...new Set([...source.scopes, ...Object.keys(preferences.privacy ?? {}).filter(scope => scope !== 'defaults')])] : source.scopes;
  const policy = disclosurePolicy(scopes);
  return policy.mode !== 'general' && !source.fields.some(field => policy.withheld_fields.includes('all') || policy.withheld_fields.includes(field))
    && !(source.mixed && (policy.withheld_fields.length || policy.mode === 'ranges')) && !(policy.mode === 'ranges' && source.precision === 'detailed');
}
const canonical = relative => {
  const file = vaultPath(relative);
  return (fs.existsSync(file) ? path.relative(fs.realpathSync(ROOT), fs.realpathSync(file)) : path.relative(ROOT, file)).replaceAll('\\', '/');
};
function sourceFresh(source) {
  try {
    if (!reportSourcePermitted(source)) return 'withheld';
    const file = canonical(source.path);
    // Finance-specific gates precede hashing even through path aliases.
    if (/^(inbox\/finance|records\/finance\/entries)\//i.test(file) && !financeSourceAllowed(file)) return 'withheld';
    if (/^records\/finance\/entries\//i.test(file)) {
      const record = financeRecord(file);
      if (record.superseded || record.state === 'retracted' || record.limitations.includes('source_missing_changed_or_withheld')) return 'stale';
    }
    return currentHash(vaultPath(file)) === source.sha256 ? 'current' : 'stale';
  } catch { return 'unavailable'; }
}
function itemPermitted(item, domain) {
  const policy = disclosurePolicy([...new Set([...domainScopes(domain), ...(item.scopes ?? [])])]);
  ensure(Array.isArray(item.fields ?? []) && (item.fields ?? []).every(identifier), 'Report item privacy fields are identifiers.');
  return policy.mode !== 'general' && !(item.fields ?? []).some(field => policy.withheld_fields.includes('all') || policy.withheld_fields.includes(field))
    && !(policy.mode === 'ranges' && item.precision === 'detailed');
}

export function normalizeDailyReport(input) {
  ensure(object(input) && input.schema_version === 1 && input.kind === 'daily_report_input', 'Use a normalized daily report input.');
  const allowed = ['schema_version', 'kind', 'date', 'timezone', 'language', 'basis', 'style', 'sources', 'metrics', 'sections', 'actions', 'followups', 'summary', 'trends', 'gaps', 'sleep_context', 'targets', 'training'];
  ensure(Object.keys(input).every(key => allowed.includes(key)), 'Unsupported report field; retain additional evidence in original records.');
  dateOrNull(input.date); ensure(input.date && text(input.timezone, 80) && text(input.language, 80), 'Report needs date, timezone and interaction language.');
  try { new Intl.DateTimeFormat('en-CA', { timeZone: input.timezone }); } catch { throw new Error('Invalid report timezone.'); }
  ensure(['personal', 'fictional'].includes(input.basis) && input.style === 'data_actions', 'Declare data/action style and personal versus fictional basis.');
  for (const key of ['sources', 'metrics', 'sections', 'actions', 'followups', 'summary', 'trends', 'gaps']) ensure(Array.isArray(input[key]), key + ' must be an array.');
  // Optional personal daily targets (low/high per metric); display compares recorded totals with them and never infers more.
  const TARGET_KEYS = ['energy_kcal', 'protein_g', 'fat_g', 'carb_g', 'fiber_g', 'sodium_mg', 'sleep_h'];
  const boundOk = n => n == null || (typeof n === 'number' && Number.isFinite(n) && n >= 0);
  let targets = null;
  if (input.targets != null) {
    ensure(object(input.targets) && Object.keys(input.targets).every(key => TARGET_KEYS.includes(key)), 'Targets use known metric keys.');
    targets = Object.fromEntries(Object.entries(input.targets).map(([key, value]) => {
      ensure(object(value) && boundOk(value.low) && boundOk(value.high) && (value.low != null || value.high != null) && (value.low == null || value.high == null || value.low <= value.high), 'Each target needs a bounded low and/or high.');
      return [key, { low: value.low ?? null, high: value.high ?? null }];
    }));
  }
  let training = null;
  if (input.training != null) {
    ensure(Array.isArray(input.training) && input.training.length <= 10, 'Training is a short list of sessions.');
    training = input.training.map(session => {
      ensure(object(session) && text(session.title, 200) && Array.isArray(session.activities) && session.activities.length <= 40, 'Each training session has a title and activities.');
      return { title: session.title, activities: session.activities.map(activity => {
        ensure(object(activity) && text(activity.name, 200) && (activity.sets == null || Number.isInteger(activity.sets) && activity.sets >= 0) && (activity.minutes == null || typeof activity.minutes === 'number' && activity.minutes >= 0)
          && (activity.reps == null || text(activity.reps, 40)) && (activity.load == null || text(activity.load, 60)), 'Training activities use bounded text and counts.');
        return { name: activity.name, sets: activity.sets ?? null, reps: activity.reps ?? null, load: activity.load ?? null, minutes: activity.minutes ?? null };
      }) };
    });
  }
  const sources = new Map();
  for (const source of input.sources) {
    ensure(object(source) && identifier(source.id) && !sources.has(source.id) && text(source.path, 1200) && /^[a-f0-9]{64}$/.test(source.sha256), 'Source IDs, exact relative paths and SHA-256 are required.');
    ensure(source.url == null || /^https?:\/\//.test(source.url), 'Source URL must use HTTP(S).');
    vaultPath(source.path); reportSourcePermitted(source); sources.set(source.id, source);
  }
  const statusesById = new Map(), used = new Set(), gaps = input.gaps.map(gap => {
    ensure(object(gap) && identifier(gap.code) && (gap.domain == null || REPORT_DOMAINS.includes(gap.domain)), 'Gaps use neutral codes/domain identifiers, not hidden values.');
    return { code: gap.code, domain: gap.domain ?? null };
  });
  const keep = (item, domain, allowEmpty = false) => {
    ensure(object(item) && REPORT_DOMAINS.includes(domain) && refs(item.source_ids ?? []), 'Items need a supported domain and source IDs.');
    if (!itemPermitted(item, domain)) { gaps.push({ code: 'privacy_excluded', domain }); return false; }
    const ids = item.source_ids ?? [];
    ensure(allowEmpty || ids.length, 'Factual items need durable source pointers.');
    let valid = true;
    for (const id of ids) {
      ensure(sources.has(id), 'Unknown source ID.');
      if (!statusesById.has(id)) statusesById.set(id, sourceFresh(sources.get(id)));
      const status = statusesById.get(id);
      if (status !== 'current') { gaps.push({ code: status === 'withheld' ? 'privacy_excluded' : 'source_changed_or_unavailable', domain }); valid = false; }
    }
    if (valid) ids.forEach(id => used.add(id));
    return valid;
  };
  const metrics = input.metrics.filter(item => keep(item, item.domain, item.value == null)).map(item => {
    ensure(identifier(item.id) && text(item.label, 160) && text(item.unit, 80) && (item.value == null || typeof item.value === 'number' && Number.isFinite(item.value)), 'Metrics need explicit finite values/unknowns and units.');
    ensure(['complete', 'partial', 'unknown', 'unconfirmed'].includes(item.coverage) && ['reported', 'documented', 'estimated', 'inferred', 'legacy_unverified'].includes(item.evidence), 'Declare metric coverage and evidence.');
    if (item.range != null) ensure(object(item.range) && ['low', 'estimate', 'high'].every(key => typeof item.range[key] === 'number' && Number.isFinite(item.range[key]))
      && item.range.low <= item.range.estimate && item.range.estimate <= item.range.high && item.value === item.range.estimate, 'Metric range must match its estimate.');
    return { id: item.id, domain: item.domain, label: item.label, unit: item.unit, value: item.value ?? null, range: item.range ?? null,
      coverage: item.coverage, evidence: item.evidence, source_ids: item.source_ids ?? [] };
  });
  ensure(new Set(metrics.map(item => item.id)).size === metrics.length, 'Metric IDs are unique.');
  const sectionMap = new Map();
  for (const section of input.sections) {
    ensure(object(section) && REPORT_DOMAINS.includes(section.domain) && !sectionMap.has(section.domain) && ['recorded', 'missing', 'withheld'].includes(section.status) && Array.isArray(section.items), 'Sections use one supported domain/status/items list.');
    const items = section.items.filter(item => keep(item, section.domain)).map(item => { ensure(text(item.text), 'Section item needs bounded text.'); ensure(['reported', 'documented', 'estimated', 'inferred', 'legacy_unverified'].includes(item.evidence ?? 'reported'), 'Section evidence remains attributed or explicitly inferred.'); return { text: item.text, evidence: item.evidence ?? 'reported', source_ids: item.source_ids }; });
    const restricted = !itemPermitted({ fields: [] }, section.domain) || gaps.some(gap => gap.domain === section.domain && gap.code === 'privacy_excluded');
    sectionMap.set(section.domain, { domain: section.domain, status: items.length ? 'recorded' : restricted || section.status === 'withheld' ? 'withheld' : 'missing', items });
  }
  const sections = REPORT_DOMAINS.map(domain => sectionMap.get(domain) ?? { domain, status: itemPermitted({ fields: [] }, domain) ? 'missing' : 'withheld', items: [] });
  const actions = input.actions.filter(item => keep(item, item.domain)).map(item => {
    ensure(identifier(item.id) && text(item.text, 4000) && statuses.includes(item.status) && text(item.owner, 100), 'Actions need identity, attributed text, owner and explicit status.');
    dateOrNull(item.due); ensure(['active', 'waiting', 'paused', 'cancelled', 'superseded', 'completed', 'unknown'].includes(item.request_state), 'Declare associated current task/control state.');
    ensure(item.status_recorded_at == null || Number.isFinite(Date.parse(item.status_recorded_at)), 'Status capture timestamp is explicit or unknown.');
    if (item.status_recorded_at) ensure(new Intl.DateTimeFormat('en-CA', { timeZone: input.timezone }).format(new Date(item.status_recorded_at)) <= input.date, 'A later captured status cannot silently become the report-day action state.');
    return { id: item.id, domain: item.domain, text: item.text, owner: item.owner, status: item.status, due: item.due ?? null,
      request_state: item.request_state, status_recorded_at: item.status_recorded_at ?? null, source_ids: item.source_ids,
      attention: ['accepted', 'in_progress'].includes(item.status) && ['active', 'completed'].includes(item.request_state) && item.due && item.due < input.date ? 'past_due_no_completion_evidence' : null };
  });
  const followups = input.followups.filter(item => keep(item, item.domain)).map(item => {
    ensure(text(item.text, 4000) && ['existing_action', 'case_followup', 'case_reassessment', 'pending_question'].includes(item.kind), 'Only sourced existing actions/case follow-ups enter the daily queue.');
    return { domain: item.domain, text: item.text, kind: item.kind, dispatch_allowed: item.dispatch_allowed === true, source_ids: item.source_ids };
  });
  const summary = input.summary.filter(item => keep(item, item.domain)).map(item => { ensure(text(item.text, 4000) && ['observation', 'hypothesis'].includes(item.kind), 'Summary separates observations and hypotheses.'); return { domain: item.domain, text: item.text, kind: item.kind, source_ids: item.source_ids }; });
  let sleepContext = null;
  if (input.sleep_context != null) {
    ensure(object(input.sleep_context) && input.sleep_context.wake_date === addDays(input.date, 1) && input.sleep_context.analysis_status === 'completed', 'Morning sleep is linked by its next-day waking date and completed analysis.');
    if (keep(input.sleep_context, 'health')) sleepContext = { wake_date: input.sleep_context.wake_date, analysis_status: 'completed', source_ids: input.sleep_context.source_ids };
  }
  for (const metric of metrics) {
    const original = input.metrics.find(item => item.id === metric.id);
    metric.observation_date = original.observation_date ?? input.date; dateOrNull(metric.observation_date);
    ensure(metric.observation_date <= input.date || sleepContext && /^sleep_/.test(metric.id) && metric.observation_date === sleepContext.wake_date, 'Next-day values are allowed only for linked morning sleep, never silently moved to the report day.');
  }
  const trends = input.trends.filter(item => keep(item, item.domain)).map(item => {
    ensure(identifier(item.metric_id) && text(item.label, 160) && text(item.unit, 80) && Array.isArray(item.points), 'Trends need identity/label/unit and dated points.');
    const lastDate = sleepContext && /^sleep_/.test(item.metric_id) ? sleepContext.wake_date : input.date;
    const points = item.points.map(point => { dateOrNull(point.date); ensure(point.date && point.date <= lastDate && (point.value == null || typeof point.value === 'number' && Number.isFinite(point.value)), 'Trend dates/values are explicit and bounded by the report date or linked sleep waking date.'); return { date: point.date, value: point.value ?? null }; });
    ensure(new Set(points.map(point => point.date)).size === points.length, 'Trend dates are unique.');
    return { metric_id: item.metric_id, domain: item.domain, label: item.label, unit: item.unit, points: points.sort((a, b) => a.date.localeCompare(b.date)), source_ids: item.source_ids };
  });
  const uniqueGaps = [...new Map(gaps.map(gap => [stable(gap), gap])).values()];
  return { schema_version: 1, kind: 'daily_report', date: input.date, timezone: input.timezone, language: input.language, basis: input.basis, style: input.style,
    metrics, sections, actions, followups, summary, trends, sleep_context: sleepContext, targets, training, gaps: uniqueGaps, sources: [...used].map(id => sources.get(id)),
    counts: { metrics_with_values: metrics.filter(item => item.value != null).length, recorded_domains: sections.filter(section => section.status === 'recorded').length,
      action_states: Object.fromEntries(statuses.map(status => [status, actions.filter(item => item.status === status).length])) },
    policy: disclosurePolicy(REPORT_SCOPES), source_verification: 'used_source_bytes_checked_after_disclosure',
    limits: ['Reported/estimated records and action-state evidence; not proof of unlogged activity or real-world outcome', 'No new consequential advice, account actions or automatic semantic privacy classification'] };
}

export function verifyReportSources(report) {
  const results = report.sources.map(source => ({ id: source.id, status: sourceFresh(source) }));
  return { current: results.every(item => item.status === 'current'), sources: results };
}
export const reportIdentity = report => digest(stable(report));
