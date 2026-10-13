// Resolve canonical self sessions plus unlinked legacy rows for both day and stats.
import { sectionTable } from './lib.mjs';
import { fitnessRecords, fitnessRecordView } from './fitness-data.mjs';
import { round, numeric, totalKnown } from './fitness-metrics.mjs';
export const sessionLink = row => String(row['详情'] ?? '').match(/\bfitness:([a-z0-9][a-z0-9-]*)/)?.[1] ?? null;
const minutes = cell => {
  const match = String(cell ?? '').trim().match(/^(?:~|≈|约)?\s*(\d+(?:\.\d+)?)\s*(?:min|分钟)?$/i);
  return match ? Number(match[1]) : null;
};
export function fitnessDay(date, doc, selected = fitnessRecords('sessions').current) {
  const table = sectionTable(doc.body, '运动'), lookup = new Map(selected.map(record => [record.session_id, record]));
  const active = selected.filter(record => record.state === 'active' && record.subject === 'self' && record.date === date).map(fitnessRecordView);
  const values = active.map(record => record.derived.duration_min), invalidated_links = [], flags = [], legacy = [];
  for (const row of table) {
    const id = sessionLink(row), current = lookup.get(id);
    if (id && current) {
      if (current.date !== date || current.state !== 'active' || current.subject !== 'self') invalidated_links.push({ session_id: id, current_path: current.file,
        reason: current.subject !== 'self' ? 'different_subject' : current.state !== 'active' ? 'retracted' : 'moved' });
      continue;
    }
    if (id) { values.push(null); invalidated_links.push({ session_id: id, reason: 'missing_record' }); continue; }
    const value = minutes(row['时长min']); values.push(value); legacy.push(row);
  }
  const durations = totalKnown(values), recordSignal = values.length > 0 || table.some(sessionLink) || doc.data.fitness_derived === 1
    || doc.data.exercise_min_origin === 'fitness_records';
  const previous = doc.data.exercise_min, independent = doc.data.exercise_min_origin === 'independent';
  let total = durations.total, origin = recordSignal ? 'fitness_records' : 'unknown', quality = active.length && !legacy.length
    && active.every(record => record.usable_as_recorded_evidence) ? 'sourced_record' : values.length ? 'legacy_or_mixed_unverified' : 'unknown';
  if (independent) {
    total = numeric(doc.data.exercise_min_independent_value) ? doc.data.exercise_min_independent_value : numeric(previous) ? previous : null;
    origin = 'independent'; quality = total === null ? 'unknown' : 'independent_unverified';
    flags.push('Independent exercise total is retained separately from recorded session duration; never add them together.');
  } else if (!recordSignal && numeric(previous)) { total = previous; origin = 'legacy_unverified'; quality = 'legacy_unverified'; }
  flags.push(...invalidated_links.map(link => 'Invalidated exercise projection: ' + link.session_id + ' (' + link.reason + ').'));
  if (legacy.length) flags.push('Legacy rows retain numeric values without canonical source/completeness validation.');
  if (active.some(record => !record.usable_as_recorded_evidence)) flags.push('Some session sources/review/measurement states are unverified.');
  const reconciliation = numeric(previous) && previous !== total ? { previous_value: previous, previous_origin: doc.data.exercise_min_origin ?? 'ambiguous_legacy_or_cache',
    reason: invalidated_links.length ? 'invalidated_session_projection' : 'recomputed_from_current_evidence' } : null;
  return { total_duration_min: total, recorded_duration: durations, origin, quality, derived: recordSignal,
    recorded_sessions: active.length, session_paths: active.map(record => record.file), invalidated_links, flags, reconciliation,
    scope: 'Recorded self exercise or a separately identified daily import; no inference about unlogged activity or adherence.' };
}
