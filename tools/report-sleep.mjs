// User-submission/analysis event, not a clock schedule or a polling daemon.
import fs from 'node:fs';
import { addDays } from './lib.mjs';
import { readJSON, vaultPath, currentHash, dateOrNull } from './store.mjs';
import { ensure, textValue } from './record-data.mjs';
import { collectDailyReport } from './report-collect.mjs';
import { reportSourcePermitted, REPORT_SCOPES } from './report-data.mjs';

export async function afterSleepInput(event) {
  ensure(event && event.schema_version === 1 && event.kind === 'sleep_report_event' && ['personal', 'fictional'].includes(event.basis), 'Use a sourced sleep-report event.');
  dateOrNull(event.wake_date); ensure(event.wake_date, 'Sleep submission needs its actual waking date.');
  if (event.basis === 'personal' && !fs.existsSync(vaultPath('.lifeos-deploy.json'))) return { ready: false, reason: 'real_vault_not_initialized', input: null };
  const descriptors = [event.sleep_input, event.analysis];
  for (const source of descriptors) {
    ensure(source && textValue(source.path) && /^[a-f0-9]{64}$/.test(source.sha256), 'Sleep data and completed analysis need exact source pointers.');
    if (!reportSourcePermitted(source)) return { ready: false, reason: 'sleep_sources_withheld', input: null };
    ensure(currentHash(vaultPath(source.path)) === source.sha256, 'Sleep data or analysis changed; reassess before automatic reporting.');
  }
  const data = readJSON(event.sleep_input.path), analysis = readJSON(event.analysis.path);
  ensure(data?.schema_version === 1 && data.kind === 'sleep_input' && data.wake_date === event.wake_date && textValue(data.subject), 'Sleep input must identify actual subject and waking date.');
  if (data.subject !== 'self') return { ready: false, reason: 'different_sleep_subject', input: null };
  if (data.episode_type !== 'main_sleep') return { ready: false, reason: 'main_sleep_episode_not_confirmed', input: null };
  if (analysis?.status !== 'completed') return { ready: false, reason: 'sleep_analysis_pending', input: null };
  ensure(analysis.schema_version === 1 && analysis.kind === 'sleep_analysis' && analysis.wake_date === event.wake_date && analysis.subject === data.subject,
    'Completed sleep analysis must match the exact waking date and subject.');
  ensure(Array.isArray(analysis.input_sources) && analysis.input_sources.some(source => source.path === event.sleep_input.path && source.sha256 === event.sleep_input.sha256), 'Analysis must bind the exact sleep input bytes.');
  for (const source of analysis.input_sources) {
    if (source.path === event.sleep_input.path) continue;
    const exposure = { ...source, scopes: source.scopes ?? REPORT_SCOPES, fields: source.fields ?? ['mixed_personal_records'], mixed: source.mixed ?? true, precision: source.precision ?? 'detailed' };
    if (!reportSourcePermitted(exposure)) return { ready: false, reason: 'analysis_context_withheld', input: null };
    ensure(/^[a-f0-9]{64}$/.test(source.sha256) && currentHash(vaultPath(source.path)) === source.sha256, 'Material sleep-analysis context changed; reassess before reporting.');
  }
  ensure(Array.isArray(analysis.observations) && analysis.observations.every(item => textValue(item.text) && ['observation', 'hypothesis'].includes(item.kind)), 'Sleep analysis separates observations from hypotheses.');
  const reportDate = addDays(event.wake_date, -1), input = await collectDailyReport(reportDate, { basis: event.basis });
  ensure(data.timezone === input.timezone && analysis.timezone === input.timezone, 'Sleep data/analysis use the vault timezone without silent conversion.');
  const ids = ['source_' + (input.sources.length + 1), 'source_' + (input.sources.length + 2)];
  descriptors.forEach((source, index) => input.sources.push({ ...source, id: ids[index] }));
  input.sleep_context = { wake_date: event.wake_date, analysis_status: 'completed', source_ids: ids };
  for (const [id, field, zh, en, unit] of [['sleep_h', 'sleep_h', '昨夜睡眠记录', 'Last-night recorded sleep', 'h'], ['sleep_quality', 'sleep_quality', '昨夜睡眠主观评分', 'Last-night sleep self-rating', '1–5']]) {
    const value = data[field] ?? null;
    ensure(value == null || typeof value === 'number' && Number.isFinite(value) && value >= 0, 'Supplied sleep quantities remain finite nonnegative values or unknown.');
    ensure(field !== 'sleep_quality' || value == null || value >= 1 && value <= 5, 'Sleep self-rating uses the declared 1–5 scale; preserve incompatible source scales separately.');
    input.metrics = input.metrics.filter(item => item.id !== id);
    input.metrics.push({ id, domain: 'health', label: input.language.startsWith('zh') ? zh : en, unit, value, range: null, coverage: 'unconfirmed', evidence: 'reported',
      observation_date: event.wake_date, source_ids: value == null ? [] : ids, fields: [field, 'dates'] });
  }
  const health = input.sections.find(section => section.domain === 'health');
  health.status = 'recorded';
  for (const observation of analysis.observations) health.items.push({ text: (input.language.startsWith('zh') ? '昨夜睡眠分析（醒来日 ' : 'Morning sleep analysis (waking date ') + event.wake_date + '): ' + observation.text,
    evidence: observation.kind === 'hypothesis' ? 'inferred' : 'reported', source_ids: ids, fields: ['sleep_analysis', 'dates'] });
  const trend = input.trends.find(item => item.metric_id === 'sleep_h');
  if (trend) { trend.points.push({ date: event.wake_date, value: data.sleep_h ?? null }); trend.points = trend.points.slice(-7); trend.source_ids = [...new Set([...trend.source_ids, ...ids])]; }
  return { ready: true, report_date: reportDate, wake_date: event.wake_date, input };
}

// Content actually carried by the report beyond the triggering sleep episode: recorded daytime
// metrics, actions, follow-ups and summaries. The linked sleep contributes its own metric, health
// note and trend, and the collector's gaps describe what is missing rather than what was recorded, so
// neither counts. Trends are previous-day history rather than this date's record, so a lone trend
// does not make an otherwise empty date publishable. A date with none of this is skipped rather than
// published as an archive that only restates the morning's own record.
export function reportedContent(report) {
  const sleepSources = new Set(report.sleep_context?.source_ids ?? []),
    fromSleep = item => Array.isArray(item.source_ids) && item.source_ids.length > 0 && item.source_ids.every(id => sleepSources.has(id));
  return {
    metrics: report.metrics.filter(metric => metric.value != null && !/^sleep_/.test(metric.id)).length,
    sections: report.sections.filter(section => section.items.some(item => !fromSleep(item))).length,
    actions: report.actions.length,
    followups: report.followups.length,
    summary: report.summary.length,
    trends: 0
  };
}
export const hasReportedContent = counts => Object.values(counts).some(count => count > 0);
