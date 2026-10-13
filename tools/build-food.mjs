// 由 Sanotsu/china-food-composition-data 的 merged_*.json 生成 data/food/cn-fct6.json（以及可选的 gi.json）。
// 成分表原书有版权：生成的文件仅供个人使用，不随 LifeOS 分发，也不要提交或再分发（见 data/food/README.md）。
// 设置了 LIFEOS_FOOD_DIR 时写入该目录（与 tools/food-data.mjs 的读取位置一致）。
// 用法: node tools/build-food.mjs <原始 json 目录> [gi.json]
import fs from 'node:fs';
import path from 'node:path';
import { referenceFile } from './food-data.mjs';

const [srcDir, giFile] = process.argv.slice(2);
if (!srcDir) { console.error('用法: node tools/build-food.mjs <原始目录> [gi.json]'); process.exit(1); }

// 'Tr'(微量)记 0，'—'/空 记 null
const val = v => {
  const s = String(v ?? '').trim();
  if (/^tr$/i.test(s)) return 0;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};
const MAP = {
  kcal: 'energyKCal', protein: 'protein', fat: 'fat', carb: 'CHO', fiber: 'dietaryFiber',
  water: 'water', cholesterol: 'cholesterol', vitA: 'vitaminA', vitC: 'vitaminC', vitE: 'vitaminETotal',
  thiamin: 'thiamin', riboflavin: 'riboflavin', niacin: 'niacin',
  Ca: 'Ca', P: 'P', K: 'K', Na: 'Na', Mg: 'Mg', Fe: 'Fe', Zn: 'Zn', Se: 'Se',
};

const foods = [];
for (const f of fs.readdirSync(srcDir).filter(f => /^merged_.*\.json$/.test(f)).sort()) {
  const cat = f.replace(/^merged_|\.json$/g, '');
  for (const r of JSON.parse(fs.readFileSync(path.join(srcDir, f), 'utf8'))) {
    const item = { code: r.foodCode, name: r.foodName, cat, edible: val(r.edible) };
    for (const [k, src] of Object.entries(MAP)) item[k] = val(r[src]);
    foods.push(item);
  }
}

let gi = [];
if (giFile) {
  for (const g of JSON.parse(fs.readFileSync(giFile, 'utf8')))
    for (const x of g.list) gi.push({ name: x.foodName.replace(/^\*\s*/, ''), group: g.foodGroup, GI: x.GI });
}

if (!foods.length) { console.error('未在 ' + srcDir + ' 找到 merged_*.json 记录；未写入任何文件。'); process.exit(1); }
const out = path.dirname(referenceFile('cn-fct6.json').file);
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'cn-fct6.json'), JSON.stringify(foods));
if (gi.length) fs.writeFileSync(path.join(out, 'gi.json'), JSON.stringify(gi));
console.log(`食物 ${foods.length} 条，GI ${gi.length} 条 → ${out}（仅限个人使用，请勿再分发）`);
