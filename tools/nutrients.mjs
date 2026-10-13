// Supported source units; never convert unavailable composition data to zero.
export const NUTRIENTS = {
  kcal: { unit: 'kcal', field: 'kcal', column: 'kcal' },
  protein: { unit: 'g', field: 'protein_g', column: '蛋白g' },
  fat: { unit: 'g', field: 'fat_g', column: '脂肪g' },
  carb: { unit: 'g', field: 'carb_g', column: '碳水g' },
  fiber: { unit: 'g', field: 'fiber_g' },
  Na: { unit: 'mg', field: 'sodium_mg' },
  Ca: { unit: 'mg', field: 'calcium_mg' },
  Fe: { unit: 'mg', field: 'iron_mg' },
  K: { unit: 'mg', field: 'potassium_mg' },
  Mg: { unit: 'mg', field: 'magnesium_mg' },
  Zn: { unit: 'mg', field: 'zinc_mg' },
  vitC: { unit: 'mg', field: 'vitamin_c_mg' },
  thiamin: { unit: 'mg', field: 'vitamin_b1_mg' },
  riboflavin: { unit: 'mg', field: 'vitamin_b2_mg' },
  niacin: { unit: 'mg', field: 'niacin_mg' }
};
export const rounded = value => Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
export const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;

export function interval(value, label, maximum = Infinity) {
  if (value === null || value === undefined) return null;
  const object = typeof value === 'number' ? { low: value, estimate: value, high: value } : value;
  if (!object || !['low', 'estimate', 'high'].every(key => finite(object[key]))
    || object.low > object.estimate || object.estimate > object.high || object.high > maximum)
    throw new Error(label + ' needs nonnegative low <= estimate <= high.');
  return { low: object.low, estimate: object.estimate, high: object.high };
}

export function aggregate(rows, get = (row, key) => row[key]) {
  const total = {}, known_subtotal = {}, ranges = {}, known_ranges = {}, coverage = {};
  for (const key of Object.keys(NUTRIENTS)) {
    const values = rows.map(row => interval(get(row, key), key));
    const known = values.filter(value => value !== null);
    const sum = known.length ? Object.fromEntries(['low', 'estimate', 'high'].map(bound =>
      [bound, rounded(known.reduce((amount, value) => amount + value[bound], 0))])) : null;
    const complete = rows.length > 0 && known.length === rows.length;
    known_subtotal[key] = sum?.estimate ?? null;
    known_ranges[key] = sum;
    total[key] = complete ? sum.estimate : null;
    ranges[key] = complete ? sum : null;
    coverage[key] = { status: !known.length ? 'unknown' : complete ? 'complete_recorded' : 'partial',
      known_items: known.length, missing_items: rows.length - known.length, recorded_items: rows.length };
  }
  return { total, known_subtotal, ranges, known_ranges, coverage };
}
