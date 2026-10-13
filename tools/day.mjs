// 每日日志：new 新建 / path 路径 / sum 汇总表格到 frontmatter
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { checkedWrite, digest } from './store.mjs';
import { ROOT, normDate, weekday, journalPath, parseDoc, stringifyDoc, sectionTable, num, readIfExists } from './lib.mjs';
import { NUTRIENTS } from './nutrients.mjs';
import { nutritionView } from './nutrition-view.mjs';
import { fitnessDay } from './fitness-day.mjs';

const [cmd = 'path', dateArg] = process.argv.slice(2);
const date = normDate(dateArg);
const file = journalPath(date);

function create() {
  if (fs.existsSync(file)) return false;
  const tpl = fs.readFileSync(path.join(ROOT, 'templates', 'day.md'), 'utf8');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  checkedWrite({ operation_id: 'day-create/' + date + '/' + crypto.randomUUID(),
    path: path.relative(ROOT, file).replaceAll('\\', '/'), mode: 'replace', expected_hash: null,
    content: tpl.replaceAll('{{date}}', date).replaceAll('{{weekday}}', weekday(date)) });
  return true;
}

function sum() {
  const text = readIfExists(file);
  if (!text) throw new Error(`日志不存在：${file}`);
  const doc = parseDoc(text);
  const total = (rows, col) => {
    const vals = rows.map(r => num(r[col])).filter(v => v !== null);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) * 10) / 10 : null;
  };
  const nutrition = nutritionView(date, doc);
  const fitness = fitnessDay(date, doc);
  const study = sectionTable(doc.body, '学习');
  const updates = {
    exercise_min: fitness.total_duration_min,
    study_min: total(study, '时长min'),
  };
  // 表格为空时不覆盖手填/外部导入的值
  for (const [k, v] of Object.entries(updates)) if (v !== null) doc.data[k] = v;
  doc.data.exercise_min = fitness.total_duration_min;
  doc.data.exercise_min_known = fitness.recorded_duration.known_subtotal;
  doc.data.exercise_min_origin = fitness.origin;
  doc.data.fitness_quality = fitness.quality;
  if (fitness.derived) doc.data.fitness_derived = 1;
  if (fitness.reconciliation) {
    doc.data.exercise_min_previous_value = fitness.reconciliation.previous_value;
    doc.data.exercise_min_previous_origin = fitness.reconciliation.previous_origin;
    doc.data.exercise_min_previous_reason = fitness.reconciliation.reason;
  }
  for (const [field, previous] of Object.entries(nutrition.reconciliation)) {
    doc.data[field + '_previous_value'] = previous.previous_value;
    doc.data[field + '_previous_origin'] = previous.previous_origin;
    doc.data[field + '_previous_reason'] = previous.reason;
  }
  for (const [key, item] of Object.entries(NUTRIENTS)) {
      doc.data[item.field] = nutrition.total[key];
      doc.data[item.field + '_known'] = nutrition.known_subtotal[key];
      doc.data[item.field + '_known_low'] = nutrition.known_ranges[key]?.low ?? null;
      doc.data[item.field + '_known_high'] = nutrition.known_ranges[key]?.high ?? null;
      doc.data[item.field + '_low'] = nutrition.ranges[key]?.low ?? null;
      doc.data[item.field + '_high'] = nutrition.ranges[key]?.high ?? null;
      doc.data[item.field + '_status'] = nutrition.coverage[key].status;
      doc.data[item.field + '_quality'] = nutrition.nutrient_quality[key];
      doc.data[item.field + '_origin'] = nutrition.nutrient_origins[key];
      doc.data[item.field + '_complete_day_eligible'] = nutrition.complete_day_eligible[key] ? 1 : 0;
      const legacyConflict = nutrition.conflicts.find(claim => claim.code === 'zero_intake_conflicts_with_legacy_total' && claim.fields.includes(key));
      if (legacyConflict) doc.data[item.field + '_legacy_claim'] = legacyConflict.legacy_claim;
      if (nutrition.independent_claim?.ranges[key]) {
        doc.data[item.field + '_independent_value'] = nutrition.independent_claim.ranges[key].estimate;
        doc.data[item.field + '_independent_record'] = nutrition.independent_record;
      }
  }
  if (nutrition.derived) doc.data.nutrition_derived = 1;
  doc.data.nutrition_state = nutrition.nutrition_state;
  doc.data.nutrition_quality = nutrition.nutrition_quality;
  doc.data.nutrition_conflict_codes = [...new Set(nutrition.conflicts.map(conflict => conflict.code))];
  doc.data.intake_day_status = nutrition.intake_day_status;
  doc.data.nutrition_recorded_items = nutrition.recorded_items;
  doc.data.nutrition_unknown_items = nutrition.missing_nutrition.length;
  // Frontmatter must not read as a confirmed full day: state that the numbers above cover only
  // the items recorded today, and repeat the whole-day scope as an explicit flag.
  doc.data.recorded_scope = 'recorded_items_only';
  doc.data.nutrition_complete_day = nutrition.intake_day_status === 'confirmed_complete' ? 1 : 0;
  doc.data.nutrition_intake_scope = nutrition.intake_day_status === 'confirmed_complete' ? 'confirmed_complete_day'
    : nutrition.intake_day_status === 'conflict' ? 'conflicting_claims'
    : nutrition.intake_day_status === 'partial' ? 'recorded_day_not_complete'
    : 'whole_day_not_confirmed';
  checkedWrite({ operation_id: 'day-sum/' + date + '/' + crypto.randomUUID(),
    path: path.relative(ROOT, file).replaceAll('\\', '/'), mode: 'replace', expected_hash: digest(text),
    content: stringifyDoc(doc) });
  return { date, ...updates, ...Object.fromEntries(Object.values(NUTRIENTS).map(item => [item.field, doc.data[item.field] ?? null])),
    ...nutrition, fitness };
}

switch (cmd) {
  case 'new': console.log(create() ? `已创建 ${file}` : `已存在 ${file}`); break;
  case 'path': console.log(file); break;
  case 'sum': create(); console.log(JSON.stringify(sum(), null, 2)); break;
  default: console.error('用法: node tools/day.mjs new|path|sum [YYYY-MM-DD]'); process.exit(1);
}
