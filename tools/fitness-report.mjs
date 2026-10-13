// Recorded quantities and exact plan-version comparisons, without clinical inference.
import { today, addDays } from './lib.mjs';
import { readJSON, dateOrNull, currentHash, vaultPath, walk } from './store.mjs';
import { ensure, textValue } from './record-data.mjs';
import { fitnessRecords, fitnessRecordView, planStateFor, planEvents } from './fitness-data.mjs';
import { numeric, round, totalKnown, quantity, load } from './fitness-metrics.mjs';

export function fitnessTimeline(options = {}) {
  const kinds = ['sessions', 'plans', 'recovery', 'assessments'];
  const caseLinks = new Set();
  if (options.case_id) {
    const definition = walk('records/cases', '.json').find(file => file.endsWith('/definition.json') && readJSON(file).case_id === options.case_id);
    ensure(definition, 'Unknown case.');
    for (const file of walk(definition.slice(0, definition.lastIndexOf('/')) + '/events', '.json'))
      for (const ref of readJSON(file).refs ?? []) if (/^records\/fitness\/(sessions|plans|recovery|assessments)\//.test(ref.path)) {
        const record = readJSON(ref.path); caseLinks.add(record.session_id ?? record.plan_id ?? record.recovery_id ?? record.assessment_id);
      }
  }
  const records = kinds.flatMap(kind => {
    const collection = fitnessRecords(kind);
    return (options.history ? collection.all : collection.current).map(record => ({ ...fitnessRecordView(record), kind,
      superseded: collection.current.find(item => item[({ sessions: 'session_id', plans: 'plan_id', recovery: 'recovery_id', assessments: 'assessment_id' })[kind]]
        === record[({ sessions: 'session_id', plans: 'plan_id', recovery: 'recovery_id', assessments: 'assessment_id' })[kind]]).file !== record.file }));
  }).filter(record => (!options.subject || record.subject === options.subject) && (!options.case_id || record.case_ids.includes(options.case_id)
    || caseLinks.has(record.session_id ?? record.plan_id ?? record.recovery_id ?? record.assessment_id)));
  const from = dateOrNull(options.from), to = dateOrNull(options.to); ensure(!from || !to || from <= to, 'Timeline range is reversed.');
  return { from, to, records: records.filter(record => record.date && (!from || record.date >= from) && (!to || record.date <= to))
    .sort((a, b) => a.date.localeCompare(b.date) || a.recorded_at.localeCompare(b.recorded_at)),
    unknown_date_records: records.filter(record => !record.date), scope: 'All retained years unless filtered; dates and captured time remain distinct.' };
}
export function fitnessSummary(options = {}) {
  const to = dateOrNull(options.to) ?? today(), days = options.days ?? 14, from = dateOrNull(options.from) ?? addDays(to, -(days - 1));
  ensure(Number.isInteger(days) && days > 0 && from <= to, 'Summary needs a valid ordered range.');
  const all = fitnessRecords('sessions').current.filter(record => record.state === 'active' && record.subject === (options.subject ?? 'self')).map(fitnessRecordView);
  const sessions = all.filter(record => record.date && record.date >= from && record.date <= to);
  const groups = new Map(), strengths = new Map();
  for (const session of sessions) for (const activity of session.derived.activities) {
    if (!groups.has(activity.type)) groups.set(activity.type, []); groups.get(activity.type).push({ session, activity });
    if (activity.type === 'resistance') {
      const conventions = [...new Set(activity.normalized_sets.map(set => set.normalized_load?.convention ?? 'unknown'))].sort();
      const key = [activity.exercise_key, activity.equipment_key, conventions.join(',')].join('/');
      if (!strengths.has(key)) strengths.set(key, []); strengths.get(key).push({ session, activity });
    }
  }
  const quantities = selector => totalKnown(sessions.map(selector));
  return { from, to, subject: options.subject ?? 'self', recorded_sessions: sessions.length,
    completed_reports: sessions.filter(session => session.completion === 'completed').length,
    partial_reports: sessions.filter(session => session.completion === 'partial').length,
    explicitly_not_performed: sessions.filter(session => session.completion === 'not_performed').length,
    unknown_completion: sessions.filter(session => session.completion === 'unknown').length,
    usable_sessions: sessions.filter(session => session.usable_as_recorded_evidence).length,
    session_duration_min: quantities(session => session.derived.duration_min),
    duration_rpe_units: quantities(session => session.derived.duration_rpe_units),
    usable_session_duration_min: totalKnown(sessions.filter(session => session.usable_as_recorded_evidence).map(session => session.derived.duration_min)),
    usable_duration_rpe_units: totalKnown(sessions.filter(session => session.usable_as_recorded_evidence).map(session => session.derived.duration_rpe_units)),
    by_type: Object.fromEntries([...groups].map(([type, rows]) => [type, { activities: rows.length,
      activity_duration_min: totalKnown(rows.map(({ activity }) => activity.duration_min ?? null)),
      distance_m: totalKnown(rows.map(({ activity }) => activity.distance_m)) }])),
    resistance_groups: Object.fromEntries([...strengths].map(([key, rows]) => [key, {
      performed_work_sets: totalKnown(rows.map(({ session, activity }) => session.recording_complete ? activity.working_sets : null)),
      performed_work_sets_known: rows.reduce((sum, { activity }) => sum + activity.working_sets_known, 0),
      completed_work_sets_known: rows.reduce((sum, { activity }) => sum + activity.completed_working_sets, 0),
      partial_work_sets_known: rows.reduce((sum, { activity }) => sum + activity.partial_working_sets, 0),
      external_volume_kg_reps: totalKnown(rows.map(({ session, activity }) => session.recording_complete ? activity.external_volume.total : null)),
      external_volume_known: totalKnown(rows.map(({ activity }) => activity.external_volume.known_subtotal)) }])),
    unknown_date_sessions: all.filter(session => !session.date), sessions,
    scope: 'Available current session records, not complete weekly activity. Separate session time, activity time, set counts, external volume, distance and subjective proxy; no combined score or injury threshold.' };
}
export function comparePlan(path) {
  const plan = fitnessRecords('plans').all.find(record => record.file === path); ensure(plan, 'Provide an exact saved plan-version path.');
  const planView = fitnessRecordView(plan);
  const state = planStateFor(path), sessions = fitnessRecords('sessions').current.filter(session => session.state === 'active' && session.subject === plan.subject
    && session.plan_link?.path === path).map(fitnessRecordView), planHash = currentHash(vaultPath(path));
  const slots = plan.schedule.map(slot => {
    const actual = sessions.filter(session => session.plan_link.slot_id === slot.slot_id);
    const stalePlan = !planView.usable_as_recorded_evidence || actual.some(session => session.plan_link.sha256 !== planHash);
    const trusted = actual.filter(session => session.usable_as_recorded_evidence), performed = trusted.filter(session => ['completed', 'partial'].includes(session.completion));
    const skipped = trusted.filter(session => session.completion === 'not_performed');
    const conflict = skipped.length > 0 && performed.length > 0;
    const status = stalePlan || actual.some(session => !session.usable_as_recorded_evidence) ? 'unverified'
      : conflict ? 'conflicting_reports' : !actual.length ? slot.rest ? 'rest_planned' : 'missing_record'
      : skipped.length === actual.length ? 'reported_not_performed' : performed.length ? 'recorded_activity' : 'unknown';
    const duration = totalKnown(actual.map(session => session.derived.duration_min));
    const activities = slot.activities.map(target => {
      const linked = actual.flatMap(session => session.derived.activities.filter(activity => activity.plan_activity_id === target.id).map(activity => ({ session, activity })));
      const compatible = linked.every(({ activity }) => activity.exercise_key === target.exercise_key && activity.equipment_key === target.equipment_key && activity.type === target.type);
      const complete = linked.length > 0 && linked.every(({ session, activity }) => session.recording_complete && session.usable_as_recorded_evidence
        && (activity.type !== 'resistance' || activity.sets_complete));
      const working = totalKnown(linked.map(({ activity }) => activity.working_sets));
      const completedSets = linked.reduce((sum, { activity }) => sum + activity.completed_working_sets, 0);
      const actualDuration = totalKnown(linked.map(({ activity }) => activity.duration_min ?? null)), distance = totalKnown(linked.map(({ activity }) => activity.distance_m));
      const targetDistance = quantity(target.target_distance, ['m', 'km', 'mile'], 'Target distance')?.value ?? null, targetLoad = load(target.target_external_load);
      const sets = linked.flatMap(({ activity }) => activity.normalized_sets.filter(set => set.kind === 'work' && set.completion !== 'not_performed'));
      const repetitionsMatch = target.target_reps && sets.length && sets.every(set => numeric(set.actual_reps) && set.completion !== 'unknown') ? sets.every(set => {
        const low = target.target_reps.low * (target.reps_basis === 'per_side' ? target.sides : 1), high = target.target_reps.high * (target.reps_basis === 'per_side' ? target.sides : 1);
        return set.completion === 'completed' && numeric(set.actual_reps) && set.actual_reps >= low && set.actual_reps <= high;
      }) : null;
      const loadComparable = targetLoad && sets.length > 0 && sets.every(set => set.normalized_load && (set.normalized_load.convention === 'assistance') === (targetLoad.convention === 'assistance'));
      const loadMatch = loadComparable ? sets.every(set => Math.abs((targetLoad.convention === 'assistance' ? set.normalized_load.value : set.normalized_load.external_total_kg)
        - (targetLoad.convention === 'assistance' ? targetLoad.value : targetLoad.external_total_kg)) <= 0.0001) : null;
      const rpeMatch = target.target_rpe && linked.length && linked.every(({ activity }) => activity.rpe?.scale === target.target_rpe.scale)
        ? linked.every(({ activity }) => activity.rpe.value === target.target_rpe.value) : null;
      return { target, linked_activities: linked.map(({ session, activity }) => ({ session_path: session.file, activity_id: activity.id })),
        comparable: compatible && complete && !conflict && !stalePlan,
        performed_work_sets: working, completed_work_sets_known: completedSets,
        completed_sets_minus_target: compatible && complete && !conflict && !stalePlan && numeric(target.target_work_sets) ? completedSets - target.target_work_sets : null,
        repetitions_within_target: compatible && complete && !conflict && !stalePlan ? repetitionsMatch : null,
        external_load_matches_target: compatible && complete && !conflict && !stalePlan ? loadMatch : null,
        activity_rpe_matches_target: compatible && complete && !conflict && !stalePlan ? rpeMatch : null,
        activity_duration_min: actualDuration, distance_m: distance,
        distance_minus_target_m: compatible && complete && !conflict && !stalePlan && numeric(targetDistance) && numeric(distance.total) ? round(distance.total - targetDistance) : null };
    });
    return { slot_id: slot.slot_id, planned_date: slot.date, rest: slot.rest, status, target_duration_min: slot.target_duration_min ?? null,
      session_paths: actual.map(session => session.file), actual_dates: [...new Set(actual.map(session => session.date))],
      date_deviation: actual.some(session => session.date !== slot.date), observed_duration_min: duration,
      duration_minus_target_min: !conflict && !stalePlan && actual.every(session => session.usable_as_recorded_evidence)
        && numeric(duration.total) && numeric(slot.target_duration_min) ? round(duration.total - slot.target_duration_min) : null,
      activities, note: 'Recorded event completion does not establish that every planned target was met. Missing records are not skipped workouts.' };
  });
  return { plan_path: path, plan_id: plan.plan_id, version: plan.version, plan_state: state, slots,
    source_status: fitnessRecordView(plan).source_status, unlinked_session_count: fitnessRecords('sessions').current.filter(session => session.subject === plan.subject
      && session.state === 'active' && session.date >= plan.valid_from && session.date <= plan.valid_to && !session.plan_link).length,
    scope: 'Explicit links to this exact design version. Current user acceptance is reported separately; do not infer historical adherence or reassociate old events to a revised plan.' };
}
export function compareFitnessAssessments(firstId, secondId) {
  const records = fitnessRecords('assessments').current;
  const get = id => { const found = records.find(record => record.assessment_id === id); ensure(found, 'Unknown assessment.'); return fitnessRecordView(found); };
  const first = get(firstId), second = get(secondId), reasons = [];
  for (const key of ['subject', 'metric_key', 'protocol_key', 'equipment_key']) if (first[key] !== second[key]) reasons.push(key + '_differs');
  if (!textValue(first.conditions) || !textValue(second.conditions) || first.conditions !== second.conditions) reasons.push('conditions_unknown_or_different');
  if (!first.usable_as_recorded_evidence || !second.usable_as_recorded_evidence || !first.normalized_value || !second.normalized_value) reasons.push('unusable_evidence');
  if (first.normalized_value?.unit !== second.normalized_value?.unit) reasons.push('incompatible_units');
  return { first, second, comparable: !reasons.length, reasons,
    delta: reasons.length ? null : round(second.normalized_value.value - first.normalized_value.value),
    unit: reasons.length ? null : first.normalized_value.unit,
    scope: 'Observed arithmetic change under declared matching conditions; no automatic improvement, 1RM estimate, fitness age or clinical significance.' };
}
