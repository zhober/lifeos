// Shared reference-food lookup for CLI calculations and saved photo-meal estimates.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, readIfExists } from './lib.mjs';
import { currentHash } from './store.mjs';

// The reference tables (cn-fct6.json, gi.json) are optional, user-installed data: LifeOS does not distribute
// them (see data/food/README.md). Without them a lookup finds only custom.json foods and unknown stays unknown.
// LIFEOS_FOOD_DIR names another directory holding the tables (the tests point it at test/fixtures/food);
// custom.json is the user's own data and is always read from the vault.
export const FOOD_DIR_ENV = 'LIFEOS_FOOD_DIR';
export const FOOD_TABLE_HINT = 'No food composition table is installed (not distributed with LifeOS); see data/food/README.md to build one. data/food/custom.json still works.';
export function referenceFile(name) {
  const override = process.env[FOOD_DIR_ENV]?.trim();
  const file = override ? path.resolve(ROOT, override, name) : path.join(ROOT, 'data', 'food', name);
  const relative = path.relative(ROOT, file);
  const inside = relative && !relative.startsWith('..') && !path.isAbsolute(relative);
  return { file, label: inside ? relative.replaceAll('\\', '/') : '$' + FOOD_DIR_ENV + '/' + name };
}
export const referenceTableInstalled = () => fs.existsSync(referenceFile('cn-fct6.json').file);
export const giInstalled = () => fs.existsSync(referenceFile('gi.json').file);
const load = ({ file, label }) => {
  const values = JSON.parse(readIfExists(file) ?? '[]');
  if (!Array.isArray(values)) throw new Error('Food data must be an array: ' + label);
  const sha256 = currentHash(file);
  return values.map(value => ({ ...value, source: { path: label, sha256 } }));
};
export const foods = () => [...load({ file: path.join(ROOT, 'data/food/custom.json'), label: 'data/food/custom.json' })
  .map(value => ({ ...value, cat: value.cat ?? '自定义', custom: true })), ...load(referenceFile('cn-fct6.json'))];
const plain = value => String(value).replace(/[（）()\[\]［］，,、\s]/g, '');
function score(food, query) {
  const name = plain(food.name), key = plain(query);
  if (!key) return 0;
  let result = name === key ? 100 : name.startsWith(key) ? 80 : name.includes(key) ? 60
    : [...new Set(key)].filter(character => name.includes(character)).length / new Set(key).size * 40;
  if (result < 20) return 0;
  return result + (food.name.includes('代表值') ? 5 : 0) + (food.custom ? 3 : 0) - name.length * 0.2;
}
export function searchFoods(query, limit = 8, database = foods()) {
  return database.map(food => [score(food, query), food]).filter(([value]) => value > 0)
    .sort((a, b) => b[0] - a[0]).slice(0, limit).map(([, food]) => food);
}
export function findFood(key, database = foods()) {
  const exact = database.find(food => food.code === key || food.name === key);
  if (exact) return { food: exact, match: 'exact' };
  const food = searchFoods(key, 1, database)[0];
  return { food: food ?? null, match: !food ? null : plain(food.name).includes(plain(key)) ? 'contains' : 'fuzzy' };
}
export const loadGI = () => JSON.parse(readIfExists(referenceFile('gi.json').file) ?? '[]');
