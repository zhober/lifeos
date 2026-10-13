// Interpret model-supplied observations through reference data; this module does not recognize images.
import fs from 'node:fs';
import path from 'node:path';
import { normDate } from './lib.mjs';
import { readJSON, walk, vaultPath, currentHash, sourceRefs, digest, dateOrNull } from './store.mjs';
import { NUTRIENTS, aggregate, finite, interval, rounded } from './nutrients.mjs';
import { foods, findFood, referenceTableInstalled } from './food-data.mjs';

const ensure = (value, message) => { if (!value) throw new Error(message); };
const nonempty = value => typeof value === 'string' && value.trim();
const confidence = value => ['low', 'medium', 'high', 'unknown'].includes(value);
export function calculateMeal(input) {
  ensure(['photo', 'text', 'mixed'].includes(input.input_method), 'Meal needs an input_method: photo, text, or mixed.');
  ensure(nonempty(input.observation) && Array.isArray(input.assumptions), 'Retain a textual observation and explicit assumptions.');
  ensure(Array.isArray(input.photos) && Array.isArray(input.components), 'Meal photos and components must be arrays.');
  ensure(['viewed', 'unavailable', 'not_applicable'].includes(input.image_review), 'Record image review capability/status honestly.');
  ensure(input.input_method !== 'photo' || input.photos.length > 0, 'A photo meal needs retained original images.');
  ensure(!input.photos.length || input.image_review !== 'not_applicable', 'Attached photos cannot be marked not applicable.');
  ensure(input.input_method !== 'photo' || input.image_review === 'viewed' || input.components.length === 0,
    'Unviewed photos cannot produce fabricated visual component estimates.');
  const seenPhotos = new Set();
  for (const photo of input.photos) {
    ensure(/^inbox\/meal-photos\/\d{4}-\d{2}-\d{2}\/[a-f0-9]{64}\.(png|jpg|webp|gif|heic|avif)$/.test(photo.path ?? '')
      && /^[a-f0-9]{64}$/.test(photo.sha256 ?? ''), 'Photo needs a canonical original inbox path and SHA-256.');
    ensure(currentHash(vaultPath(photo.path)) === photo.sha256, 'Original photo changed: ' + photo.path);
    ensure(['before', 'after', 'label', 'other'].includes(photo.stage), 'Photo needs a before/after/label/other stage.');
    ensure(!seenPhotos.has(photo.sha256), 'Duplicate images must be grouped once within the meal.'); seenPhotos.add(photo.sha256);
  }
  const database = foods(), ids = new Set(), flags = [];
  const components = input.components.map(component => {
    ensure(/^[a-z0-9][a-z0-9-]*$/.test(component.id ?? '') && !ids.has(component.id), 'Meal component IDs must be unique.'); ids.add(component.id);
    ensure(nonempty(component.name) && nonempty(component.cooking_state) && Array.isArray(component.assumptions), 'Component needs name, cooking_state, and assumptions.');
    ensure(['photo_estimate', 'recipe_estimate', 'weighed', 'label_quantity', 'user_reported', 'unknown'].includes(component.portion_method), 'Unknown portion method.');
    ensure(['visible', 'assumed', 'label', 'reported', 'unknown'].includes(component.visibility), 'Record component visibility.');
    ensure(component.confidence && ['identity', 'portion', 'recipe'].every(key => confidence(component.confidence[key])), 'Record separate identity, portion, and recipe confidence.');
    const grams = interval(component.grams, 'Component grams'), milliliters = interval(component.milliliters, 'Component milliliters'),
      servings = interval(component.servings, 'Component servings'), consumed = interval(component.consumed_fraction, 'Consumed fraction', 1);
    ensure(component.portion_method !== 'unknown' || (!grams && !milliliters && !servings), 'An unknown portion cannot have a known quantity.');
    ensure(['confirmed', 'assumed', 'unknown'].includes(component.basis_match), 'Record the edible-weight and preparation basis match.');
    ensure(component.basis_match !== 'assumed' || component.assumptions.length > 0, 'An assumed food/weight basis needs explicit assumptions.');
    ensure(['reported', 'assumed', 'unknown'].includes(component.consumption_basis), 'Record the consumption basis.');
    if (component.consumption_basis === 'unknown') ensure(consumed === null, 'Unknown consumption cannot be given a known eaten fraction.');
    for (const quantity of [grams, milliliters, servings].filter(Boolean))
      if (['photo_estimate', 'recipe_estimate'].includes(component.portion_method))
        ensure(quantity.low < quantity.high && component.assumptions.length > 0, 'Visual/recipe portion estimates require a nonzero range and explicit assumptions.');
    const sources = sourceRefs(component.sources);
    if (input.image_review === 'unavailable') {
      ensure(component.portion_method !== 'photo_estimate', 'Unviewed images cannot supply visual portion estimates.');
      ensure(sources.some(source => !source.path.startsWith('inbox/meal-photos/')), 'Unviewed-image fallback needs separate text evidence.');
    }
    const match = component.food_key ? findFood(component.food_key, database) : { food: null, match: null };
    const label = component.composition;
    let labelValues = null, labelSources = null;
    if (label) {
      ensure(['per_100g', 'per_100ml', 'per_serving'].includes(label.basis) && label.source_kind === 'package_label', 'Package composition needs an explicit label basis.');
      labelSources = sourceRefs(label.sources);
      labelValues = Object.fromEntries(Object.entries(NUTRIENTS).map(([key, specification]) => {
        const stated = label.nutrients?.[key];
        if (!stated || stated.value === null) return [key, null];
        if (stated.confidence !== undefined) {
          ensure(confidence(stated.confidence), 'Invalid label reading confidence.');
          if (['low', 'unknown'].includes(stated.confidence)) return [key, null];
        }
        ensure(finite(stated.value) && typeof stated.unit === 'string', 'Invalid label nutrient: ' + key);
        const convert = stated.unit === specification.unit ? 1
          : specification.unit === 'kcal' && stated.unit === 'kJ' ? 1 / 4.184
          : specification.unit === 'mg' && stated.unit === 'g' ? 1000
          : specification.unit === 'mg' && stated.unit === 'ug' ? 0.001
          : specification.unit === 'g' && stated.unit === 'mg' ? 0.001 : null;
        ensure(convert !== null, 'Unsupported nutrient-unit conversion: ' + key + ' ' + stated.unit);
        return [key, stated.value * convert];
      }));
    }
    const identityUsable = !['unknown', 'low'].includes(component.confidence.identity) && component.basis_match !== 'unknown';
    const usable = identityUsable && (label || match.match === 'exact');
    const quantity = label?.basis === 'per_100ml' ? milliliters : label?.basis === 'per_serving' ? servings : grams;
    const divisor = label?.basis === 'per_serving' ? 1 : 100;
    const composition = labelValues ?? match.food;
    const structuralZeros = {};
    if (component.structural_zeros !== undefined) {
      ensure(component.structural_zeros && typeof component.structural_zeros === 'object' && !Array.isArray(component.structural_zeros), 'Structural zeros must be keyed by nutrient.');
      for (const [key, proof] of Object.entries(component.structural_zeros)) {
        ensure(Object.hasOwn(NUTRIENTS, key), 'Unsupported structural-zero nutrient: ' + key);
        ensure(usable && component.confidence.identity === 'high' && component.basis_match === 'confirmed',
          'Structural zero needs a high-confidence identified food and confirmed basis.');
        ensure(composition[key] === 0 && nonempty(proof?.reason), 'Structural zero needs a zero reference and explicit reasoning: ' + key);
        const proofSources = sourceRefs(proof.sources);
        const referencePaths = new Set(label ? labelSources.map(source => source.path) : [match.food.source.path]);
        ensure(proofSources.some(source => !referencePaths.has(source.path) && !source.path.startsWith('inbox/meal-photos/')),
          'Structural zero needs durable evidence beyond the rounded table/label value or meal photograph.');
        structuralZeros[key] = { reason: proof.reason, sources: proofSources };
      }
    }
    if (!usable) flags.push(component.id + ': unknown or unconfirmed food identity');
    if (component.food_key && match.match !== 'exact' && !label && !referenceTableInstalled())
      flags.push(component.id + ': food_key not in custom.json and no food composition table is installed (see data/food/README.md)');
    if (!quantity || !consumed) flags.push(component.id + ': unquantified amount or actual intake');
    if (Object.values(component.confidence).includes('low')) flags.push(component.id + ': low confidence');
    if (component.consumption_basis === 'assumed') flags.push(component.id + ': consumption assumed');
    const nutrientRanges = Object.fromEntries(Object.keys(NUTRIENTS).map(key => {
      // A sourced report of zero consumption is genuine zero, even when composition is unknown.
      if (consumed?.high === 0 && component.consumption_basis === 'reported') return [key, { low: 0, estimate: 0, high: 0 }];
      if (structuralZeros[key]) return [key, { low: 0, estimate: 0, high: 0 }];
      if (!usable || !quantity || !consumed || !finite(composition[key])) return [key, null];
      return [key, Object.fromEntries(['low', 'estimate', 'high'].map(bound =>
        [bound, rounded(composition[key] * quantity[bound] * consumed[bound] / divisor)]))];
    }));
    const reference = label && usable ? { reference_type: 'package_label', basis: label.basis, normalized_values: labelValues,
      original_label: label, sources: labelSources } : usable ? { code: match.food.code, name: match.food.name, source: match.food.source,
      reference_type: match.food.custom ? 'custom_food' : 'food_composition_table', note: match.food.note ?? null,
      preparation: match.food.preparation ?? null, source_date: match.food.source_date ?? match.food.added ?? null,
      per_100g: Object.fromEntries(Object.keys(NUTRIENTS).map(key => [key, finite(match.food[key]) ? match.food[key] : null])) } : null;
    return { ...component, grams, milliliters, servings, consumed_fraction: consumed, sources, reference,
      structural_zeros: structuralZeros, nutrient_ranges: nutrientRanges };
  });
  const result = aggregate(components, (component, key) => component.nutrient_ranges[key]);
  if (!components.length) flags.push('No quantified components; pending image interpretation or intake information.');
  const estimated = components.some(component => ['photo_estimate', 'recipe_estimate'].includes(component.portion_method)
    || component.consumption_basis === 'assumed');
  const unquantified = components.some(component => !(component.reference?.basis === 'per_100ml' ? component.milliliters
    : component.reference?.basis === 'per_serving' ? component.servings : component.grams) || !component.consumed_fraction);
  return { components, ...result, units: Object.fromEntries(Object.entries(NUTRIENTS).map(([key, item]) => [key, item.unit])),
    quality: input.image_review === 'unavailable' ? 'pending_image_review' : result.total.kcal === null ? 'partial'
      : unquantified ? 'partially_quantified' : estimated ? 'estimated' : 'reported_quantity',
    flags, interval_meaning: 'Assumption/sensitivity bounds, not calibrated statistical confidence intervals.' };
}

// Validate a user-supplied meal image and derive its retained path without writing (nutrition.mjs photo writes it).
export function mealPhotoOriginal(sourcePath, date) {
  ensure(typeof sourcePath === 'string', 'Provide the local path of a user-supplied image.');
  const file = path.resolve(sourcePath), stat = fs.statSync(file);
  const maximum = readJSON('project.json')?.nutrition?.photo_max_bytes ?? 52428800;
  ensure(Number.isInteger(maximum) && maximum > 0, 'nutrition.photo_max_bytes must be a positive integer.');
  ensure(stat.isFile() && stat.size > 0 && stat.size <= maximum, 'Image is empty or exceeds the shared photo size limit.');
  const bytes = fs.readFileSync(file), signature = bytes.subarray(0, 12);
  const type = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? ['png', 'image/png']
    : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? ['jpg', 'image/jpeg']
    : signature.toString('ascii', 0, 4) === 'RIFF' && signature.toString('ascii', 8, 12) === 'WEBP' ? ['webp', 'image/webp']
    : /^GIF8[79]a/.test(signature.toString('ascii', 0, 6)) ? ['gif', 'image/gif']
    : signature.toString('ascii', 4, 8) === 'ftyp' && /^(heic|heix|hevc|hevx|mif1|msf1|avif|avis)$/.test(signature.toString('ascii', 8, 12))
      ? [signature.toString('ascii', 8, 12).startsWith('avi') ? 'avif' : 'heic', 'image/' + (signature.toString('ascii', 8, 12).startsWith('avi') ? 'avif' : 'heic')] : null;
  ensure(type, 'Unsupported image signature; preserve a supported original image rather than treating arbitrary bytes as a photograph.');
  const sha256 = digest(bytes);
  return { file, bytes, sha256, mime_type: type[1], path: 'inbox/meal-photos/' + dateOrNull(normDate(date)) + '/' + sha256 + '.' + type[0] };
}

export function latestMeals() {
  const selected = new Map(), versions = new Set();
  for (const file of walk('records/nutrition/meals', '.json')) {
    const record = readJSON(file);
    if (record?.schema_version !== 1 || !record.meal_id || !Number.isInteger(record.version)) throw new Error('Invalid saved meal record: ' + file);
    const versionKey = record.meal_id + '/' + record.version;
    if (versions.has(versionKey)) throw new Error('Conflicting meal versions: ' + record.meal_id);
    versions.add(versionKey);
    const previous = selected.get(record.meal_id);
    if (previous && previous.version === record.version && previous.file !== file) throw new Error('Conflicting meal versions: ' + record.meal_id);
    if (!previous || record.version > previous.version) selected.set(record.meal_id, { ...record, file });
  }
  return [...selected.values()];
}
export const mealsOn = (date, selected = latestMeals()) => selected.filter(meal => meal.date === date && meal.state !== 'retracted');

export function dayCoverage(date) {
  const candidates = walk('records/nutrition/days/' + date.slice(0, 4) + '/' + date, '.json').map(file => ({ ...readJSON(file), file }));
  if (!candidates.length) return null;
  const ordered = candidates.sort((a, b) => b.version - a.version);
  if (ordered.length > 1 && ordered[0].version === ordered[1].version) throw new Error('Conflicting intake-day coverage versions.');
  return ordered[0];
}
