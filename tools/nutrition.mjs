// Portable photo retention, model-observation calculation, and immutable meal/coverage versions.
import fs from 'node:fs';
import path from 'node:path';
import { normDate, journalPath, parseDoc } from './lib.mjs';
import { digest, stable, keyId, inputJSON, immutable, immutableBlob, readJSON, sourceRefs, vaultPath, withLock, walk, dateOrNull } from './store.mjs';
import { calculateMeal, latestMeals, dayCoverage, mealPhotoOriginal } from './meal-data.mjs';
import { energyNeeds } from './energy-needs.mjs';
import { legacyMealHash } from './nutrition-day.mjs';
import { recordIndependent } from './nutrition-independent.mjs';

const ensure = (condition, message) => { if (!condition) throw new Error(message); };
function projection(saved, file) {
  const escape = value => String(value ?? '').replaceAll('|', '&#124;').replace(/[\r\n]/g, ' ');
  const withdrawn = saved.state === 'retracted', totals = withdrawn ? {} : saved.derived.total;
  const components = saved.derived.components;
  const grams = !withdrawn && components.length && components.every(item => item.grams && item.consumed_fraction)
    ? components.reduce((amount, item) => amount + item.grams.estimate * item.consumed_fraction.estimate, 0) : null;
  const cells = [saved.meal_time ?? '', saved.meal_name, saved.observation, grams === null ? '' : Math.round(grams * 10) / 10,
    totals.kcal ?? '', totals.protein ?? '', totals.fat ?? '', totals.carb ?? '',
    'meal:' + saved.meal_id + '; ' + (withdrawn ? 'retracted' : saved.derived.quality) + '; [record](../../' + file + ')'];
  return { meal_id: saved.meal_id, state: saved.state, row: '| ' + cells.map(escape).join(' | ') + ' |',
    note: 'One projection per eating event; canonical record supplies ranges and completeness.' };
}
function photo(input) {
  const original = mealPhotoOriginal(input.source_path, input.date);
  return { ...immutableBlob(original.path, original.bytes), original_name: path.basename(original.file),
    mime_type: original.mime_type, bytes: original.bytes.length };
}

function record(input) {
  ensure(input.operation_id && typeof input.meal_name === 'string' && input.meal_name.trim(), 'Supply a stable operation_id and meal_name.');
  const mealId = input.meal_id ?? keyId('meal', input.operation_id);
  ensure(typeof mealId === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(mealId), 'Invalid meal identifier.');
  return withLock('nutrition-meal/' + mealId, () => {
    const date = dateOrNull(normDate(input.date)), previous = latestMeals().find(item => item.meal_id === mealId);
    const versionId = keyId('meal-version', input.operation_id), inputHash = digest(stable(input));
    const existing = walk('records/nutrition/meals', '.json').find(file => file.endsWith('/' + versionId + '.json'));
    if (existing) {
      const saved = readJSON(existing); ensure(saved.input_hash === inputHash, 'Meal operation ID reused with different input.');
      const superseded = previous?.file !== existing;
      return { path: existing, meal_id: saved.meal_id, version: saved.version, derived: saved.derived,
        superseded, current_path: previous?.file ?? existing, journal_projection: superseded ? null : projection(saved, existing), replay: true };
    }
    ensure(!previous || input.supersedes === previous.file, 'A meal correction must supersede the exact latest version.');
    ensure(previous || !input.supersedes, 'Cannot supersede an unknown meal.');
    ensure(['active', 'retracted'].includes(input.state ?? 'active'), 'Meal state must be active or retracted.');
    const derived = calculateMeal(input), sources = sourceRefs(input.sources);
    const directory = previous ? previous.file.slice(0, previous.file.lastIndexOf('/'))
      : 'records/nutrition/meals/' + date.slice(0, 4) + '/' + mealId + '/versions';
    const file = directory + '/' + versionId + '.json';
    const saved = { schema_version: 1, ...input, date, meal_id: mealId, version: (previous?.version ?? 0) + 1,
      date_basis: input.date_basis ?? (input.date ? 'supplied_date' : 'capture_default'),
      state: input.state ?? 'active', input_hash: inputHash, recorded_at: new Date().toISOString(), sources, derived };
    immutable(file, saved);
    return { path: file, meal_id: mealId, version: saved.version, derived, journal_projection: projection(saved, file), replay: false };
  });
}

function coverage(input) {
  const date = dateOrNull(normDate(input.date));
  ensure(input.operation_id && typeof input.complete === 'boolean' && typeof input.reason === 'string' && input.reason.trim(), 'Coverage needs operation_id, complete, and a reason.');
  ensure(typeof input.no_intake === 'boolean', 'Explicitly state no_intake true or false.');
  ensure(!input.no_intake || input.complete, 'Zero intake needs a confirmed complete day.');
  return withLock('nutrition-coverage/' + date, () => {
    const file = 'records/nutrition/days/' + date.slice(0, 4) + '/' + date + '/' + keyId('coverage', input.operation_id) + '.json';
    const previous = readJSON(file), fingerprint = digest(stable(input));
    if (previous) { ensure(previous.input_hash === fingerprint, 'Coverage operation ID reused with different input.'); return { path: file, replay: true }; }
    const current = dayCoverage(date);
    ensure(!current || input.supersedes === current.file, 'Coverage changes must supersede the exact latest coverage version.');
    ensure(current || !input.supersedes, 'Cannot supersede unknown coverage.');
    // Bind completeness to the observed meal versions; adding/correcting a meal invalidates it.
    const meals = latestMeals().filter(meal => meal.date === date).map(meal => ({ path: meal.file, sha256: digest(fs.readFileSync(vaultPath(meal.file))) }));
    const journal = journalPath(date), body = fs.existsSync(journal) ? parseDoc(fs.readFileSync(journal, 'utf8')).body : '';
    immutable(file, { schema_version: 1, ...input, date, version: (current?.version ?? 0) + 1,
      input_hash: fingerprint, recorded_at: new Date().toISOString(), sources: sourceRefs(input.sources), meal_versions: meals,
      legacy_rows_hash: legacyMealHash(body) });
    return { path: file, replay: false };
  });
}

const [command, argument] = process.argv.slice(2);
try {
  const value = ['photo', 'calculate', 'record', 'coverage', 'independent', 'needs'].includes(command) ? inputJSON(argument) : null;
  const result = command === 'photo' ? photo(value) : command === 'calculate' ? calculateMeal(value)
    : command === 'record' ? record(value) : command === 'coverage' ? coverage(value)
    : command === 'independent' ? recordIndependent(value) : command === 'needs' ? energyNeeds(value)
    : command === 'meals' ? latestMeals().filter(meal => !argument || meal.date === normDate(argument)) : undefined;
  ensure(result !== undefined, 'Usage: node tools/nutrition.mjs photo|calculate|record|coverage|independent|needs <input.json> | meals [date]');
  console.log(JSON.stringify(result, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
