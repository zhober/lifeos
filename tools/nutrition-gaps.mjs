// Daily nutrition gaps: compares the journal's recorded totals with the user's daily targets and a few
// labelled general references, and suggests one food with a gram amount per real gap.
// Usage: node tools/nutrition-gaps.mjs [DATE]
// Totals come from the journal frontmatter written by tools/day.mjs sum. Unknown nutrients stay unknown, never 0;
// a total that is null because some items lack data is used only through its known subtotal, as a lower bound.
import { ROOT, normDate, journalPath, parseDoc, readIfExists, num } from './lib.mjs';
import { findFood, foods } from './food-data.mjs';

const date = normDate(process.argv[2]);
const file = journalPath(date);
const text = readIfExists(file);
if (!text) { console.log(JSON.stringify({ date, error: 'journal_missing', path: file }, null, 2)); process.exit(0); }
const data = parseDoc(text).data;
const targets = JSON.parse(readIfExists(`${ROOT}/records/nutrition/targets.json`) ?? '{}').daily ?? {};

// General adult references, not personal targets; a personal target of the same metric wins.
const REFERENCES = {
  fiber_g: { low: 25, note: 'general adult fibre reference' },
  vitamin_c_mg: { low: 100, note: 'general adult vitamin C reference' },
  potassium_mg: { low: 2000, note: 'general adult potassium adequate-intake reference' }
};
const round = value => Math.round(value * 10) / 10;

const metrics = {};
for (const key of new Set([...Object.keys(targets), ...Object.keys(REFERENCES)])) {
  const target = targets[key] ?? REFERENCES[key];
  const field = key === 'energy_kcal' ? 'kcal' : key;
  const value = num(data[field]), known = key === 'sleep_h' ? null : num(data[field + '_known']);
  const basis = value ?? known;
  if (basis === null) continue;
  const low = target.low ?? null, high = target.high ?? null;
  metrics[key] = { value, known_subtotal: known, status: data[field + '_status'] ?? null,
    basis: value === null ? 'known_subtotal_lower_bound' : 'recorded_total',
    target_low: low, target_high: high, target_source: targets[key] ? 'personal_target' : REFERENCES[key].note,
    gap_low: low === null ? null : round(low - basis), over_high: high !== null && basis > high };
}

// One suggestion per real gap. Candidates are tried in order; only a food found by name (not a fuzzy match)
// that carries a positive value for the nutrient is used, and the gram amount comes from that value.
const NUTRIENT_FOODS = {
  protein_g: { key: 'protein', min_gap: 12, foods: ['鸡胸脯肉', '鸡腿'], step: 10, min: 50, max: 250 },
  carb_g: { key: 'carb', min_gap: 20, foods: ['米饭（蒸，代表值）', '米饭'], step: 10, min: 80, max: 400 },
  fat_g: { key: 'fat', min_gap: 8, foods: ['花生（炒）', '花生仁（炒）'], step: 5, min: 10, max: 30 },
  fiber_g: { key: 'fiber', min_gap: 3, foods: ['菜花（白色）', '菠菜', '燕麦片', '甘薯（白心）'], step: 10, min: 100, max: 300 },
  vitamin_c_mg: { key: 'vitC', min_gap: 30, foods: ['中华猕猴桃', '橙', '冬枣'], step: 10, min: 80, max: 250 },
  potassium_mg: { key: 'K', min_gap: 500, foods: ['香蕉', '马铃薯', '菠菜'], step: 10, min: 100, max: 300 }
};
const database = foods();
const candidate = (names, key) => {
  for (const name of names) {
    const { food, match } = findFood(name, database);
    if (food && match !== 'fuzzy' && typeof food[key] === 'number' && food[key] > 0) return food;
  }
  return null;
};
const suggestions = [];
for (const [metric, rule] of Object.entries(NUTRIENT_FOODS)) {
  const gap = metrics[metric]?.gap_low;
  if (gap == null || gap < rule.min_gap) continue;
  const food = candidate(rule.foods, rule.key);
  if (!food) continue;
  const grams = Math.min(rule.max, Math.max(rule.min, Math.round(gap / (food[rule.key] / 100) / rule.step) * rule.step));
  const amount = key => typeof food[key] === 'number' ? round(food[key] * grams / 100) : null;
  suggestions.push({ for: metric, food: food.name, code: food.code, grams, kcal: amount('kcal'), protein_g: amount('protein'),
    carb_g: amount('carb'), fat_g: amount('fat'), fiber_g: amount('fiber'), vitamin_c_mg: amount('vitC'), potassium_mg: amount('K') });
}

console.log(JSON.stringify({ date, metrics, suggestions, basis: {
  summary_source: 'journal frontmatter written by tools/day.mjs sum (recorded items only)',
  nutrient_values: 'food composition table; unknown stays null and a suggested food is not recorded intake',
  scope: 'recorded items only; the day is not confirmed complete unless the journal says so'
} }, null, 2));
