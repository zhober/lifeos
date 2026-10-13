// Combine canonical meal versions and legacy rows without double-counting linked projections.
import fs from 'node:fs';
import { digest, stable, vaultPath } from './store.mjs';
import { aggregate, NUTRIENTS } from './nutrients.mjs';
import { latestMeals, dayCoverage } from './meal-data.mjs';
import { sectionTable } from './lib.mjs';
import { sourcesCurrent } from './nutrition-sources.mjs';

export const mealLink = row => String(row['来源'] ?? '').match(/\bmeal:([a-z0-9][a-z0-9-]*)/)?.[1] ?? null;
export const legacyMealHash = body => digest(stable(sectionTable(body, '饮食').filter(row => !mealLink(row))));
const cell = value => {
  const matched = String(value ?? '').trim().match(/^(?:~|≈|约)?\s*(\d+(?:\.\d+)?)\s*(?:kcal|g|mg)?$/i);
  return matched ? Number(matched[1]) : null;
};

export function nutritionDay(date, body, selected = latestMeals()) {
  const table = sectionTable(body, '饮食'), lookup = new Map(selected.map(meal => [meal.meal_id, meal]));
  const active = selected.filter(meal => meal.date === date && meal.state !== 'retracted');
  const rows = [], missing = [], flags = [], invalidated_links = [], conflicts = [];
  for (const meal of active) {
    const sourced = sourcesCurrent(meal.sources);
    if (meal.derived.components.length) {
      for (const component of meal.derived.components) rows.push({ label: meal.meal_name + '/' + component.name,
        ranges: component.nutrient_ranges, kind: 'record', sourced: sourced && sourcesCurrent(component.sources)
          && (!component.reference?.sources || sourcesCurrent(component.reference.sources)),
        nutrient_sources: Object.fromEntries(Object.keys(NUTRIENTS).map(key => [key,
          !component.structural_zeros?.[key] || sourcesCurrent(component.structural_zeros[key].sources)])),
        zero_consumption: component.consumed_fraction?.high === 0 && component.consumption_basis === 'reported' });
    } else rows.push({ label: meal.meal_name, ranges: {}, kind: 'record', sourced });
    flags.push(...meal.derived.flags.map(flag => meal.meal_id + ': ' + flag));
  }
  for (const row of table) {
    const id = mealLink(row);
    if (id && lookup.has(id)) {
      const current = lookup.get(id);
      if (current.date !== date || current.state === 'retracted') invalidated_links.push({ meal_id: id, current_path: current.file,
        reason: current.state === 'retracted' ? 'retracted' : 'moved', current_date: current.date });
      continue;
    }
    if (id) { rows.push({ label: row['食物'] || id, ranges: {}, kind: 'missing', sourced: false });
      invalidated_links.push({ meal_id: id, reason: 'missing_record' }); flags.push('Missing linked meal: ' + id); continue; }
    rows.push({ label: row['食物'] || 'legacy item', kind: 'legacy', sourced: false, ranges: Object.fromEntries(Object.entries(NUTRIENTS).map(([key, item]) =>
      [key, item.column ? cell(row[item.column]) : null])) });
  }
  let values = aggregate(rows, (row, key) => row.ranges[key] ?? null);
  const recorded_claim = structuredClone(values);
  let quality = rows.length ? rows.every(row => row.sourced) ? 'sourced_record'
    : rows.every(row => row.kind === 'legacy') ? 'legacy_unverified' : 'mixed_unverified' : 'unknown';
  if (rows.some(row => !row.sourced)) flags.push('Some nutrient values have unverified provenance; numeric completeness does not verify their source.');
  flags.push(...invalidated_links.map(link => 'Invalidated meal projection: ' + link.meal_id + ' (' + link.reason + ').'));
  const coverage = dayCoverage(date), snapshot = selected.filter(meal => meal.date === date)
    .map(meal => ({ path: meal.file, sha256: digest(fs.readFileSync(vaultPath(meal.file))) }));
  const coverageCurrent = coverage && sourcesCurrent(coverage.sources) && stable(snapshot.sort((a, b) => a.path.localeCompare(b.path)))
    === stable([...coverage.meal_versions].sort((a, b) => a.path.localeCompare(b.path))) && coverage.legacy_rows_hash === legacyMealHash(body);
  if (coverage && !coverageCurrent) flags.push('Intake completeness confirmation is stale after meal/legacy-row or source changes.');
  if (coverageCurrent && coverage.no_intake) {
    if (rows.some(row => !row.zero_consumption)) {
      conflicts.push({ code: 'zero_intake_conflicts_with_records', fields: Object.keys(NUTRIENTS),
        coverage_record: coverage.file, recorded_claim, zero_intake_claim: { value: 0, reason: coverage.reason, sources: coverage.sources } });
      for (const key of Object.keys(NUTRIENTS)) { values.total[key] = null; values.ranges[key] = null; values.coverage[key].status = 'conflict'; }
      quality = 'conflict'; flags.push('Confirmed zero intake conflicts with recorded meals; reconcile observations.');
    } else {
      values = aggregate([Object.fromEntries(Object.keys(NUTRIENTS).map(key => [key, 0]))]); quality = 'reported_zero';
    }
  }
  for (const row of rows) if (row.ranges.kcal === null || row.ranges.kcal === undefined) missing.push(row.label);
  const nutritionState = conflicts.length ? 'conflict' : values.coverage.kcal.status === 'complete_recorded'
    && quality.includes('unverified') ? quality : values.coverage.kcal.status;
  return { ...values, derived: rows.length > 0 || table.some(mealLink) || Boolean(coverageCurrent && coverage.no_intake), recorded_items: rows.length,
    missing_nutrition: missing, flags, meal_records: active.map(meal => meal.file),
    coverage_record: coverage?.file ?? null, coverage_current: Boolean(coverageCurrent), no_intake: Boolean(coverageCurrent && coverage.no_intake),
    recorded_claim, invalidated_links, conflicts, nutrition_quality: quality,
    nutrient_quality: Object.fromEntries(Object.keys(NUTRIENTS).map(key => [key, values.total[key] === null && !conflicts.length ? 'unknown'
      : quality === 'sourced_record' && rows.some(row => row.nutrient_sources?.[key] === false) ? 'mixed_unverified' : quality])),
    estimate_qualities: active.map(meal => ({ meal_id: meal.meal_id, quality: meal.derived.quality })),
    intake_day_status: conflicts.length ? 'conflict' : coverageCurrent ? coverage.complete ? 'confirmed_complete' : 'partial' : 'unconfirmed',
    nutrition_state: nutritionState };
}
