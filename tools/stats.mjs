// Metrics with current canonical meal estimates, known subtotals, and intake coverage.
import fs from 'node:fs';
import { normDate, addDays, journalPath, parseDoc } from './lib.mjs';
import { NUTRIENTS } from './nutrients.mjs';
import { latestMeals } from './meal-data.mjs';
import { nutritionView } from './nutrition-view.mjs';
import { latestIndependent } from './nutrition-independent.mjs';
import { fitnessRecords } from './fitness-data.mjs';
import { fitnessDay } from './fitness-day.mjs';
import { journalConflicts } from './conflicts.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => { const index = args.indexOf('--' + name); return index < 0 ? fallback : args[index + 1]; };
if (args.includes('--help') || args.includes('-h')) {
  console.log('Usage: node tools/stats.mjs [--days N | --from YYYY-MM-DD] [--to YYYY-MM-DD] [--fields a,b,...] [--json]\n'
    + 'Default: the 7 days ending today. Ratings sleep_quality, mood, energy and stress use a 1-5 scale (5 = best; stress 5 = highest).\n'
    + 'Fields: weight_kg bed_time wake_time sleep_h sleep_quality mood energy stress kcal protein_g fat_g carb_g fiber_g sodium_mg\n'
    + '        water_ml exercise_min steps study_min work_h');
  process.exit(0);
}
const to = normDate(option('to'));
const from = option('from') ? normDate(option('from')) : addDays(to, -(Number(option('days', 7)) - 1));
const defaults = ['weight_kg', 'bed_time', 'wake_time', 'sleep_h', 'sleep_quality', 'mood', 'energy', 'stress',
  'kcal', 'protein_g', 'fat_g', 'carb_g', 'fiber_g', 'sodium_mg', 'water_ml', 'exercise_min', 'steps', 'study_min', 'work_h'];
const fields = option('fields') ? option('fields').split(',') : defaults;
const nutritionFields = new Set(Object.values(NUTRIENTS).map(item => item.field)), meals = latestMeals(), independent = latestIndependent(), rows = [];
const fitnessSessions = fitnessRecords('sessions').current;
// A date whose journal has a sync/backup duplicate may hold content written elsewhere.
// The original is still read normally; the conflict is reported so it cannot disappear.
const journalConflictsByDate = journalConflicts();
for (let date = from; date <= to; date = addDays(date, 1)) {
  const file = journalPath(date), exists = fs.existsSync(file);
  const doc = exists ? parseDoc(fs.readFileSync(file, 'utf8')) : { data: {}, body: '' };
  const nutrition = nutritionView(date, doc, meals, independent), data = { ...doc.data };
  const fitness = fitnessDay(date, doc, fitnessSessions); data.exercise_min = fitness.total_duration_min;
  const journalCopies = journalConflictsByDate.get(date) ?? [];
  if (!exists && !nutrition.derived && !fitness.derived && !journalCopies.length) { rows.push({ date, _missing: true }); continue; }
  for (const [key, item] of Object.entries(NUTRIENTS)) {
      data[item.field] = nutrition.total[key];
      data[item.field + '_known'] = nutrition.known_subtotal[key];
  }
  rows.push({ date, ...Object.fromEntries(fields.map(key => [key, data[key] ?? null])), tags: data.tags ?? [],
    fitness,
    intake_day_status: nutrition.intake_day_status, nutrition_state: nutrition.nutrition_state,
    nutrition_quality: nutrition.nutrition_quality,
    nutrition_unknown_items: nutrition.missing_nutrition.length, _journal_missing: !exists,
    // A date can be recorded but hold no journal at all, when only a conflict copy of it
    // reached this machine; the row stays visible and says so instead of looking missing.
    _missing: !exists && !nutrition.derived && !fitness.derived,
    known_subtotals: Object.fromEntries(Object.entries(NUTRIENTS).filter(([, item]) => fields.includes(item.field))
      .map(([key, item]) => [item.field, nutrition.known_subtotal[key]])),
    known_subtotal_ranges: Object.fromEntries(Object.entries(NUTRIENTS).filter(([, item]) => fields.includes(item.field))
      .map(([key, item]) => [item.field, nutrition.known_ranges[key]])),
    nutrition_ranges: Object.fromEntries(Object.entries(NUTRIENTS).filter(([, item]) => fields.includes(item.field))
      .map(([key, item]) => [item.field, nutrition.ranges[key]])),
    complete_day_eligible: Object.fromEntries(Object.entries(NUTRIENTS).map(([key, item]) => [item.field, nutrition.complete_day_eligible[key]])),
    nutrient_quality: Object.fromEntries(Object.entries(NUTRIENTS).map(([key, item]) => [item.field, nutrition.nutrient_quality[key]])),
    nutrient_origins: Object.fromEntries(Object.entries(NUTRIENTS).map(([key, item]) => [item.field, nutrition.nutrient_origins[key]])),
    nutrition_flags: nutrition.flags, nutrition_conflicts: nutrition.conflicts,
    journal_conflict_copies: journalCopies.map(copy => ({ path: copy.path, client: copy.client, original_exists: copy.original_exists })),
    journal_conflict_count: journalCopies.length,
    recorded_claim: nutrition.recorded_claim, independent_claim: nutrition.independent_claim,
    reconciliation: nutrition.reconciliation, invalidated_links: nutrition.invalidated_links });
}
const summary = {};
for (const key of fields) {
  const values = rows.map(row => row[key]).filter(value => typeof value === 'number' && Number.isFinite(value));
  if (!values.length) continue;
  const complete = rows.filter(row => row.complete_day_eligible?.[key] && typeof row[key] === 'number' && Number.isFinite(row[key]));
  const mean = items => items.length ? Math.round(items.reduce((a, b) => a + b, 0) / items.length * 10) / 10 : null;
  summary[key] = { n: values.length, avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length * 10) / 10,
    min: Math.min(...values), max: Math.max(...values), first: values[0], last: values.at(-1),
    ...(nutritionFields.has(key) ? { complete_day_n: complete.length, complete_day_avg: mean(complete.map(row => row[key])),
      complete_day_range: complete.length ? { low: mean(complete.map(row => row.nutrition_ranges[key].low)),
        estimate: mean(complete.map(row => row[key])), high: mean(complete.map(row => row.nutrition_ranges[key].high)) } : null,
      complete_day_dates: complete.map(row => row.date),
      scope: 'Mean of available recorded totals; unconfirmed days are not known complete daily intake.' } : {}) };
}
const nutrition_coverage = { confirmed_complete_days: rows.filter(row => row.intake_day_status === 'confirmed_complete').length,
  partial_days: rows.filter(row => row.intake_day_status === 'partial' || row.nutrition_state === 'partial').length,
  unconfirmed_days: rows.filter(row => row.intake_day_status === 'unconfirmed').length,
  legacy_unverified_days: rows.filter(row => ['legacy_unverified', 'mixed_unverified'].includes(row.nutrition_quality)).length,
  conflict_days: rows.filter(row => row.nutrition_conflicts?.length > 0).length,
  missing_dates: rows.filter(row => row._missing && !row.journal_conflict_count).map(row => row.date) };
const journalConflictsSummary = { conflict_days: rows.filter(row => row.journal_conflict_count > 0).length,
  conflict_dates: rows.filter(row => row.journal_conflict_count > 0).map(row => row.date),
  copies: rows.reduce((total, row) => total + (row.journal_conflict_count ?? 0), 0) };
if (args.includes('--json')) console.log(JSON.stringify({ from, to, rows, summary, nutrition_coverage, journal_conflicts: journalConflictsSummary }, null, 2));
else {
  const used = fields.filter(key => rows.some(row => row[key] != null));
  console.log('# ' + from + ' ~ ' + to + '（有记录 ' + rows.filter(row => !row._missing).length + '/' + rows.length + ' 天）\n');
  console.log('| 日期 | ' + used.join(' | ') + ' | 饮食覆盖 | 营养状态 | tags |\n|' + '---|'.repeat(used.length + 4));
  for (const row of rows) console.log('| ' + [row.date, ...used.map(key => row[key] ?? ''),
    row.intake_day_status ?? '', row.nutrition_state ?? '', (row.tags ?? []).join(',')].join(' | ') + ' |');
  console.log('\n| 指标 | 样本 | 均值 | 最小 | 最大 | 首→末 |\n|---|---|---|---|---|---|');
  for (const key of used.filter(key => summary[key])) {
    const item = summary[key]; console.log('| ' + [key, item.n, item.avg, item.min, item.max, item.first + '→' + item.last].join(' | ') + ' |');
  }
  console.log('\nNutrition coverage: ' + JSON.stringify(nutrition_coverage));
  if (journalConflictsSummary.conflict_days)
    console.log('\n⚠ Journal conflict copies: ' + journalConflictsSummary.copies + ' copy/copies on ' + journalConflictsSummary.conflict_days
      + ' date(s): ' + journalConflictsSummary.conflict_dates.join(', ')
      + '. Content written on another device may be missing from these rows; run "node tools/conflicts.mjs" to inspect and resolve manually.');
  const compared = Object.entries(summary).filter(([key]) => nutritionFields.has(key));
  if (compared.length) {
    console.log('\n| 指标 | 可比较完整日 | 完整日均值 | 完整日均值范围 |\n|---|---|---|---|');
    for (const [key, item] of compared) console.log('| ' + [key, item.complete_day_n, item.complete_day_avg ?? '',
      item.complete_day_range ? item.complete_day_range.low + '~' + item.complete_day_range.high : ''].join(' | ') + ' |');
  }
  console.log('Unknown nutrition remains blank; known subtotals and ranges are available through --json. Recorded totals are not automatically complete daily intake.');
}
