// Resolve live records, independent claims, and old caches once for day and stats.
import { NUTRIENTS, finite, interval } from './nutrients.mjs';
import { nutritionDay } from './nutrition-day.mjs';
import { latestIndependent } from './nutrition-independent.mjs';
import { sourcesCurrent } from './nutrition-sources.mjs';

const usableQuality = quality => ['sourced_record', 'reported_zero', 'sourced_independent'].includes(quality);
const disjoint = (a, b) => a && b && (a.high + 0.01 < b.low || b.high + 0.01 < a.low);
export function nutritionView(date, doc, meals, independentRecords = latestIndependent()) {
  const view = nutritionDay(date, doc.body, meals), data = doc.data;
  const current = independentRecords.find(record => record.date === date);
  const independent = current?.state === 'active' ? current : null;
  const independentSourced = independent && sourcesCurrent(independent.sources);
  const recordDayComplete = view.intake_day_status === 'confirmed_complete';
  const recordSignal = view.derived || data.nutrition_derived === 1;
  const numericCoverage = structuredClone(view.coverage);
  view.nutrient_origins = {}; view.complete_day_eligible = {}; view.reconciliation = {};
  view.independent_record = current?.file ?? null;
  view.independent_claim = independent ? { path: independent.file, ranges: independent.ranges,
    complete: independent.complete, reason: independent.reason, sources: independent.sources } : null;
  const originalRecordConflict = view.conflicts.length > 0;
  for (const [key, item] of Object.entries(NUTRIENTS)) {
    const field = item.field, previous = data[field], origin = data[field + '_origin'];
    let total = view.total[key], range = view.ranges[key], quality = view.nutrient_quality[key],
      resolvedOrigin = origin === 'independent_record' && !independent ? 'independent_record'
        : recordSignal || origin === 'meal_records' ? 'meal_records' : 'unknown', fullDay = recordDayComplete;
    let independentRange = independent?.ranges[key] ?? null;
    // Explicit old independent values remain visible, but a label alone is not source verification.
    const manualIndependent = origin === 'independent';
    if (!independentRange && manualIndependent) {
      const value = data[field + '_independent_value'] ?? previous;
      if (finite(value)) independentRange = interval(value, key);
    }
    if (independentRange) {
      total = independentRange.estimate; range = independentRange;
      quality = independent?.ranges[key] && independentSourced ? 'sourced_independent' : 'independent_unverified';
      resolvedOrigin = independent?.ranges[key] ? 'independent_record' : 'independent';
      fullDay = Boolean(independent?.ranges[key] && independent.complete && independentSourced);
      if (view.no_intake && (independentRange.high > 0 || originalRecordConflict)) {
        view.conflicts.push({ code: 'zero_intake_conflicts_with_independent', fields: [key],
          coverage_record: view.coverage_record, independent_claim: view.independent_claim ?? { value: total, origin } });
      } else if (recordDayComplete && independent?.complete && disjoint(view.recorded_claim.ranges[key], independentRange)) {
        view.conflicts.push({ code: 'independent_and_complete_records_disagree', fields: [key],
          recorded_claim: view.recorded_claim.ranges[key], independent_claim: independentRange,
          independent_record: independent?.file ?? null });
      }
      view.known_subtotal[key] = total; view.known_ranges[key] = range;
      view.coverage[key] = { status: 'complete_recorded', known_items: 1, missing_items: 0, recorded_items: 1 };
    } else if (!view.derived && origin !== 'meal_records' && origin !== 'independent_record'
      && (!data.nutrition_derived || origin && origin !== 'unknown')) {
      total = finite(previous) ? previous : null; range = total === null ? null : interval(total, key);
      quality = total === null ? 'unknown' : 'legacy_unverified'; resolvedOrigin = quality;
      view.known_subtotal[key] = total; view.known_ranges[key] = range;
      view.coverage[key] = { status: total === null ? 'unknown' : 'complete_recorded', known_items: total === null ? 0 : 1,
        missing_items: 0, recorded_items: total === null ? 0 : 1 };
    }
    // A zero-intake report cannot silently replace an ambiguous independent old total.
    const legacyClaim = data[field + '_legacy_claim'] ?? previous;
    const ambiguousOld = view.no_intake && finite(legacyClaim) && legacyClaim > 0
      && (finite(data[field + '_legacy_claim']) || !data.nutrition_derived && !origin && !view.invalidated_links.length);
    if (ambiguousOld && !independentRange) view.conflicts.push({ code: 'zero_intake_conflicts_with_legacy_total', fields: [key],
      coverage_record: view.coverage_record, legacy_claim: legacyClaim });
    if (finite(previous) && previous !== total && (!origin || view.invalidated_links.length || origin === 'independent_record' && !independent)) {
      view.reconciliation[field] = { previous_value: previous, previous_origin: origin ?? 'ambiguous_legacy_or_cache',
        reason: view.invalidated_links.length ? 'invalidated_meal_projection' : origin === 'independent_record' ? 'independent_retracted_or_missing' : 'replaced_by_current_evidence' };
    }
    const conflict = view.conflicts.some(claim => claim.fields.includes(key));
    if (conflict) { total = null; range = null; quality = 'conflict'; view.coverage[key].status = 'conflict'; }
    view.total[key] = total; view.ranges[key] = range; view.nutrient_quality[key] = quality;
    view.nutrient_origins[key] = resolvedOrigin;
    view.complete_day_eligible[key] = total !== null && fullDay && usableQuality(quality) && !conflict;
  }
  if (view.conflicts.length) view.flags.push('Nutrition claims conflict; affected totals are unknown and excluded from complete-day comparisons.');
  if (independent && !independentSourced) view.flags.push('Independent total source is missing or changed; values remain unverified.');
  view.record_numeric_coverage = numericCoverage;
  view.derived = recordSignal || Boolean(current);
  view.intake_day_status = originalRecordConflict || view.conflicts.some(claim => claim.code.startsWith('zero_intake')) ? 'conflict'
    : independent?.complete && independentSourced ? 'confirmed_complete' : view.intake_day_status;
  const qualities = Object.values(view.nutrient_quality).filter(quality => quality !== 'unknown');
  view.nutrition_quality = qualities.includes('conflict') ? 'conflict' : qualities.some(quality => quality.includes('unverified'))
    ? qualities.every(quality => quality === 'legacy_unverified') ? 'legacy_unverified' : 'mixed_unverified'
    : qualities.includes('sourced_independent') ? 'sourced_independent' : qualities[0] ?? view.nutrition_quality;
  view.nutrition_state = view.nutrient_quality.kcal === 'conflict' ? 'conflict' : view.total.kcal !== null
    && view.nutrient_quality.kcal.includes('unverified') ? view.nutrient_quality.kcal : view.coverage.kcal.status;
  return view;
}
