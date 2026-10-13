// Descriptive arithmetic only. No universal targets, clinical risk score or inferred units.
import { ensure, textValue } from './record-data.mjs';
export const numeric = value => typeof value === 'number' && Number.isFinite(value);
export const positive = value => numeric(value) && value >= 0;
export const round = value => numeric(value) ? Math.round(value * 10000) / 10000 : null;
const units = { kg: ['kg', 1], lb: ['kg', 0.45359237], m: ['m', 1], km: ['m', 1000], mile: ['m', 1609.344],
  s: ['s', 1], min: ['s', 60], count: ['count', 1], W: ['W', 1], bpm: ['bpm', 1] };
export function quantity(item, allowed, label) {
  if (item == null) return null;
  ensure(item && typeof item === 'object' && positive(item.value) && allowed.includes(item.unit), label + ' needs a nonnegative value and supported explicit unit.');
  const [unit, factor] = units[item.unit];
  return { value: item.value * factor, unit };
}
export function rating(item, label = 'RPE') {
  if (item == null) return null;
  const bounds = { '0_to_10': [0, 10], 'borg_6_to_20': [6, 20] };
  ensure(item && Object.hasOwn(bounds, item.scale) && numeric(item.value) && item.value >= bounds[item.scale][0]
    && item.value <= bounds[item.scale][1], label + ' requires an explicit supported scale and an in-range value.');
  return { ...item };
}
export function load(item) {
  if (item == null) return null;
  const amount = quantity(item, ['kg', 'lb'], 'External load');
  ensure(['total', 'per_implement', 'assistance'].includes(item.convention), 'State total/per_implement/assistance load convention.');
  if (item.convention === 'per_implement') ensure(Number.isInteger(item.implements) && item.implements > 0, 'Per-implement load needs the actual implement count.');
  return { ...amount, convention: item.convention, implements: item.convention === 'per_implement' ? item.implements : 1,
    external_total_kg: item.convention === 'assistance' ? null : amount.value * (item.convention === 'per_implement' ? item.implements : 1) };
}
export function totalKnown(values) {
  const known = values.filter(numeric), subtotal = known.length ? round(known.reduce((sum, value) => sum + value, 0)) : null;
  return { total: values.length && known.length === values.length ? subtotal : null, known_subtotal: subtotal,
    known_n: known.length, missing_n: values.length - known.length, n: values.length };
}
export function deriveSession(input) {
  ensure(['completed', 'partial', 'not_performed', 'unknown'].includes(input.completion), 'Record actual session completion, not the plan status.');
  ensure(typeof input.recording_complete === 'boolean' && Array.isArray(input.activities), 'Session needs explicit recording_complete and activities.');
  ensure(input.duration_min == null || positive(input.duration_min), 'Session duration_min needs a nonnegative number or null.');
  const rpe = rating(input.session_rpe, 'Session RPE'), ids = new Set();
  const activities = input.activities.map(activity => {
    ensure(textValue(activity.id) && !ids.has(activity.id), 'Activity IDs must be unique.'); ids.add(activity.id);
    ensure(textValue(activity.name) && textValue(activity.exercise_key) && textValue(activity.equipment_key)
      && ['resistance', 'endurance', 'mobility', 'sport', 'other'].includes(activity.type), 'Activity needs name, stable exercise/equipment keys, and type.');
    ensure(activity.duration_min == null || positive(activity.duration_min), 'Activity duration_min needs a nonnegative number or null.');
    const distance = quantity(activity.distance, ['m', 'km', 'mile'], 'Distance'); rating(activity.rpe, 'Activity RPE');
    if (activity.type === 'resistance') ensure(typeof activity.sets_complete === 'boolean', 'Resistance activity needs explicit sets_complete.');
    const sets = activity.sets ?? []; ensure(Array.isArray(sets), 'Sets must be an array.'); const setIds = new Set();
    const normalizedSets = sets.map(set => {
      ensure(textValue(set.id) && !setIds.has(set.id), 'Set IDs must be unique within the activity.'); setIds.add(set.id);
      ensure(['work', 'warmup', 'unknown'].includes(set.kind) && ['completed', 'partial', 'not_performed', 'unknown'].includes(set.completion), 'Set needs explicit kind and actual completion.');
      ensure(set.reps == null || Number.isInteger(set.reps) && set.reps >= 0, 'Repetitions need a nonnegative integer or null.');
      ensure(set.reps == null || ['total', 'per_side'].includes(set.reps_basis), 'State total/per_side repetitions.');
      if (set.reps_basis === 'per_side' && set.reps != null) ensure(Number.isInteger(set.sides) && set.sides > 0, 'Per-side repetitions need the actual side count.');
      ensure(set.hold_s == null || positive(set.hold_s), 'Hold time needs nonnegative seconds.');
      ensure(set.rir == null || numeric(set.rir) && set.rir >= 0, 'Reported RIR must be nonnegative.'); rating(set.rpe, 'Set RPE');
      const normalizedLoad = load(set.external_load), reps = set.reps == null ? null : set.reps * (set.reps_basis === 'per_side' ? set.sides : 1);
      ensure(set.completion !== 'not_performed' || (!set.reps && !set.hold_s), 'A not-performed set cannot contain actual repetitions/hold time.');
      return { ...set, normalized_load: normalizedLoad, actual_reps: reps,
        external_volume_kg_reps: ['completed', 'partial'].includes(set.completion) && numeric(reps) && numeric(normalizedLoad?.external_total_kg)
          ? round(reps * normalizedLoad.external_total_kg) : null };
    });
    const knownWorking = normalizedSets.filter(set => set.kind === 'work' && ['completed', 'partial'].includes(set.completion)).length;
    const setsComplete = activity.type !== 'resistance' || activity.sets_complete && !normalizedSets.some(set => set.kind === 'unknown' || set.completion === 'unknown');
    const externalVolume = totalKnown(normalizedSets.filter(set => set.kind === 'work' && set.completion !== 'not_performed').map(set => set.external_volume_kg_reps));
    if (setsComplete && externalVolume.n === 0) { externalVolume.total = 0; externalVolume.known_subtotal = 0; }
    if (!setsComplete) externalVolume.total = null;
    return { ...activity, distance_m: distance?.value ?? null, normalized_sets: normalizedSets, sets_complete: setsComplete,
      working_sets_known: knownWorking, working_sets: setsComplete ? knownWorking : null,
      completed_working_sets: normalizedSets.filter(set => set.kind === 'work' && set.completion === 'completed').length,
      partial_working_sets: normalizedSets.filter(set => set.kind === 'work' && set.completion === 'partial').length, external_volume: externalVolume };
  });
  if (input.completion === 'not_performed') ensure(!input.duration_min && activities.every(activity => !activity.duration_min && !activity.distance_m
    && activity.normalized_sets.every(set => set.completion === 'not_performed')), 'Not-performed session conflicts with actual recorded activity.');
  const duration = input.completion === 'not_performed' ? 0 : input.duration_min ?? null;
  return { duration_min: duration, activities, session_rpe: rpe,
    duration_rpe_units: numeric(duration) && rpe?.scale === '0_to_10' ? round(duration * rpe.value) : null,
    proxy_method: 'reported session duration_min times reported session RPE on explicit 0_to_10 scale',
    scope: 'Descriptive recorded-session proxy, not a calibrated clinical load or injury score. Activity durations are not added to session elapsed time.' };
}
