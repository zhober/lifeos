// Mathematical screening estimate, not an automatic intake prescription.
import { finite, interval, rounded } from './nutrients.mjs';
import { readJSON } from './store.mjs';

const defaultBounds = { age_years: [0, 125], height_cm: [50, 260], weight_kg: [10, 500] };
const units = { height_cm: { cm: 1, m: 100 }, weight_kg: { kg: 1, g: 0.001 } };

function normalize(input) {
  const values = { age_years: input.age_years, height_cm: input.height_cm, weight_kg: input.weight_kg }, issues = [];
  for (const [field, factors] of Object.entries(units)) {
    const supplied = input[field === 'height_cm' ? 'height' : 'weight'];
    if (supplied === undefined) continue;
    if (!supplied || !finite(supplied.value) || !Object.hasOwn(factors, supplied.unit)) {
      issues.push({ field, code: 'invalid_explicit_unit', supplied }); values[field] = null; continue;
    }
    const converted = supplied.value * factors[supplied.unit];
    if (input[field] !== undefined && input[field] !== null && (!finite(input[field]) || Math.abs(input[field] - converted) > 1e-8)) {
      issues.push({ field, code: 'conflicting_measurements', supplied, canonical_value: input[field] }); values[field] = null;
    } else values[field] = converted;
  }
  return { values, issues };
}

export function energyNeeds(input) {
  const { values, issues } = normalize(input), bounds = readJSON('project.json')?.nutrition?.input_sanity_bounds ?? defaultBounds;
  for (const [field, fallback] of Object.entries(defaultBounds)) {
    const limits = bounds[field] ?? fallback;
    if (!Array.isArray(limits) || limits.length !== 2 || !limits.every(finite) || limits[0] > limits[1])
      throw new Error('Invalid shared input sanity bounds: ' + field);
    if (finite(values[field]) && (values[field] < limits[0] || values[field] > limits[1]))
      issues.push({ field, code: 'outside_input_sanity_bounds', supplied_value: values[field], bounds: limits });
  }
  const missing = ['age_years', 'height_cm', 'weight_kg'].filter(key => !finite(values[key]) || values[key] === 0);
  if (!['male', 'female'].includes(input.equation_sex)) missing.push('equation_sex');
  const dimensionsValid = !issues.some(issue => ['height_cm', 'weight_kg'].includes(issue.field));
  const bmi = dimensionsValid && finite(values.height_cm) && values.height_cm > 0 && finite(values.weight_kg)
    && values.weight_kg > 0 ? rounded(values.weight_kg / (values.height_cm / 100) ** 2) : null;
  const reasons = [...missing.map(key => 'missing_or_invalid:' + key), ...issues.map(issue => issue.code + ':' + issue.field)];
  if (input.population !== 'general_adult') reasons.push('population_not_confirmed_general_adult');
  if (['pregnant', 'lactating', 'requires_clinical_guidance'].some(key => typeof input[key] !== 'boolean'))
    reasons.push('special_population_screening_not_recorded');
  if (finite(values.age_years) && values.age_years < 18) reasons.push('adult_equation_not_applicable');
  if (input.pregnant === true || input.lactating === true || input.requires_clinical_guidance === true)
    reasons.push('special_population_requires_appropriate_assessment');
  if (reasons.length) return { method: 'Mifflin-St Jeor', bmi, applicable: false, reasons, input_issues: issues,
    normalized_inputs: values, resting_kcal: null, maintenance_kcal: null };
  const resting = 10 * values.weight_kg + 6.25 * values.height_cm - 5 * values.age_years + (input.equation_sex === 'male' ? 5 : -161);
  if (!Number.isFinite(resting) || resting <= 0) throw new Error('Inputs produce an invalid resting-energy estimate.');
  const factor = interval(input.activity_factor, 'Activity factor');
  if (factor && (factor.low < 1 || factor.high > 3)) throw new Error('Explicit activity-factor bounds must lie between 1 and 3.');
  return { method: 'Mifflin-St Jeor', source_url: 'https://pubmed.ncbi.nlm.nih.gov/2305711/', bmi,
    applicable: true, reasons: [], input_issues: [], normalized_inputs: values, resting_kcal: rounded(resting), activity_factor: factor,
    maintenance_kcal: factor ? Object.fromEntries(['low', 'estimate', 'high'].map(key => [key, rounded(resting * factor[key])])) : null,
    warnings: [...(!factor ? ['No activity factor supplied; daily energy need is unknown.'] : []),
      ...(values.age_years < 19 || values.age_years > 78 ? ['Outside the original study age range; applicability needs explicit review.'] : []),
      'Equation uncertainty is not covered by the activity-factor range. This is not a measured requirement or an intake target.'] };
}
