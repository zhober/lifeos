// Reference composition per 100 g edible portion; unknown is distinct from zero.
import { NUTRIENTS, aggregate, finite, rounded } from './nutrients.mjs';
import { foods, findFood, searchFoods, loadGI, referenceTableInstalled, giInstalled, FOOD_TABLE_HINT } from './food-data.mjs';

const [command, ...rest] = process.argv.slice(2);
const asJSON = rest.includes('--json'), acceptMatch = rest.includes('--accept-match');
const args = rest.filter(value => !['--json', '--accept-match'].includes(value));
// Without an installed table only custom.json foods resolve; with --json the hint goes to stderr so stdout stays parseable.
const hint = (installed = referenceTableInstalled()) => { if (!installed) (asJSON ? console.error : console.log)(FOOD_TABLE_HINT); };
try {
  if (command === 'search' && args[0]) {
    const result = searchFoods(args[0], Number(args[1]) || 8);
    if (asJSON) console.log(JSON.stringify(result, null, 2));
    else {
      console.log('| 编码 | 名称 | kcal | 蛋白g | 脂肪g | 碳水g | 纤维g | 钠mg |\n|---|---|---|---|---|---|---|---|');
      for (const food of result) console.log('| ' + [food.code ?? '', food.name, food.kcal ?? '', food.protein ?? '',
        food.fat ?? '', food.carb ?? '', food.fiber ?? '', food.Na ?? ''].join(' | ') + ' |');
      console.log('每 100g 可食部；候选名称和生熟状态需要核实。');
    }
    hint();
  } else if (command === 'calc' && args.length) {
    const database = foods();
    const rows = args.map(value => {
      const parsed = value.trim().match(/^(.+?)\s+~?(\d+(?:\.\d+)?)\s*g?$/i);
      if (!parsed) throw new Error('Use "<food name or code> <grams>": ' + value);
      const grams = Number(parsed[2]), { food, match } = findFood(parsed[1], database);
      if (!finite(grams)) throw new Error('Grams must be a finite nonnegative number.');
      const usable = food && (match === 'exact' || acceptMatch);
      return { query: parsed[1], grams, matched: food?.name ?? null, code: food?.code ?? null, match,
        status: !food ? 'not_found' : !usable ? 'unconfirmed_match' : 'calculated',
        source: usable ? food.source : null,
        ...Object.fromEntries(Object.keys(NUTRIENTS).map(key => [key,
          usable && finite(food[key]) ? rounded(food[key] * grams / 100) : null])) };
    });
    const result = { rows, ...aggregate(rows), units: Object.fromEntries(Object.entries(NUTRIENTS).map(([key, item]) => [key, item.unit])),
      warnings: rows.filter(row => row.status !== 'calculated').map(row => row.query + ': ' + row.status) };
    if (asJSON) console.log(JSON.stringify(result, null, 2));
    else {
      console.log('| 输入 | 匹配 | 状态 | 克数 | kcal | 蛋白g | 脂肪g | 碳水g |\n|---|---|---|---|---|---|---|---|');
      for (const row of rows) console.log('| ' + [row.query, row.matched ?? '', row.status, row.grams,
        row.kcal ?? '', row.protein ?? '', row.fat ?? '', row.carb ?? ''].join(' | ') + ' |');
      console.log('Recorded total: ' + JSON.stringify(result.total));
      console.log('Known subtotal: ' + JSON.stringify(result.known_subtotal));
      if (result.warnings.length) console.log(result.warnings.join('\n'));
    }
    if (result.warnings.length) hint();
  } else if (command === 'gi' && args[0]) {
    const result = loadGI().filter(item => item.name.includes(args[0]));
    if (asJSON) console.log(JSON.stringify(result, null, 2)); else result.forEach(item => console.log(item.name + ': GI=' + item.GI));
    hint(giInstalled());
  } else throw new Error('Usage: node tools/food.mjs search <food> [limit] [--json] | calc "<food> <grams>" ... [--json] [--accept-match] | gi <food>');
} catch (error) { console.error(error.message); process.exitCode = 1; }
