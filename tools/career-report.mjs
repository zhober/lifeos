// Descriptive arithmetic and exact-source project/process views, not effectiveness judgments.
import { today, addDays } from './lib.mjs';
import { dateOrNull } from './store.mjs';
import { ensure } from './record-data.mjs';
import { careerRecords, careerRecordView, careerTimeline, durationMinutes, datedClaim } from './career-data.mjs';

function durationGroups(sessions) {
  return ['active', 'elapsed', 'unspecified'].map(basis => {
    const records = sessions.filter(r => r.state === 'active' && r.details.duration.basis === basis);
    const counted = records.filter(r => r.usable_as_recorded_evidence && r.date_precision === 'day' && r.details.duration.quality !== 'estimated' && durationMinutes(r.details.duration) != null);
    const missing = records.filter(r => !counted.includes(r));
    const subtotal = counted.reduce((sum, r) => sum + durationMinutes(r.details.duration), 0);
    const estimates = records.filter(r => r.usable_as_recorded_evidence && r.date_precision === 'day' && r.details.duration.quality === 'estimated' && durationMinutes(r.details.duration) != null);
    return { basis, record_count: records.length, usable_known_count: counted.length, known_subtotal_min: subtotal,
      recorded_total_min: records.length && !missing.length ? subtotal : null,
      gap_count: missing.length, gap_records: missing.map(r => ({ file: r.file, limitations: r.limitations, date_precision: r.date_precision, duration: r.details.duration })),
      estimated_subtotal_min: estimates.reduce((sum, r) => sum + durationMinutes(r.details.duration), 0), estimated_count: estimates.length };
  });
}

export function careerProject(id, at = today()) {
  dateOrNull(at);
  const collection = careerRecords(), designs = collection.all.filter(r => r.kind === 'project' && (r.record_id === id || r.file === id));
  ensure(designs.length, 'Unknown project ID or exact project path.');
  const projectId = designs[0].record_id, subject = designs[0].subject;
  const allDesigns = collection.all.filter(r => r.record_id === projectId).map(r => careerRecordView(r, collection));
  const states = collection.current.filter(r => r.kind === 'project_state' && r.subject === subject && r.bindings.some(b => b.record_id === projectId)).map(r => careerRecordView(r, collection));
  const adoption = datedClaim(states.filter(r => r.details.status === 'accepted'), r => r.details.project_ref, at);
  const adoptedPath = adoption.value;
  const state = datedClaim(states.filter(r => r.details.project_ref === adoptedPath), r => r.details.status, at);
  const reportedState = state.value;
  const eligibleDesigns = allDesigns.filter(r => r.date_precision === 'day' && r.occurred_start <= at).sort((a, b) => a.version - b.version);
  const exact = designs.find(r => r.file === id), design = exact ?? allDesigns.find(r => r.file === adoptedPath) ?? eligibleDesigns.at(-1) ?? collection.current.find(r => r.record_id === projectId);
  const observations = collection.current.filter(r => r.subject === subject && r.details.project_ref === design.file).map(r => careerRecordView(r, collection));
  const milestones = design.details.milestones.map(m => {
    const state = datedClaim(observations.filter(r => r.kind === 'milestone' && r.details.milestone_id === m.id), r => r.details.status, at);
    return { ...m, recorded_status: state.value, status_evidence: state,
      overdue_status_unknown: Boolean(m.due_on && m.due_on < at && state.value == null),
      past_due_with_incomplete_report: Boolean(m.due_on && m.due_on < at && state.value != null && !['accepted', 'reported_complete', 'cancelled'].includes(state.value)),
      work_records: observations.filter(r => r.kind === 'work_session' && r.details.milestone_id === m.id && (!r.occurred_start || r.occurred_start <= at)),
      outcome_records: observations.filter(r => r.kind === 'evidence' && r.details.milestone_id === m.id && (!r.occurred_start || r.occurred_start <= at)) };
  });
  for (const m of milestones) {
    m.duration_groups = durationGroups(m.work_records);
    m.planned_duration_min = m.planned_duration == null ? null : durationMinutes(m.planned_duration);
  }
  for (const m of milestones) m.dependency_reports = (m.depends_on ?? []).map(dep => ({ milestone_id: dep, recorded_status: milestones.find(item => item.id === dep).recorded_status }));
  return { project_id: projectId, subject, as_of: at, latest_proposed_design: eligibleDesigns.at(-1)?.file ?? null,
    latest_recorded_design: collection.current.find(r => r.record_id === projectId).file,
    selected_design_date_uncertain: design.date_precision !== 'day' || design.occurred_start > at,
    reported_project_state: reportedState, adopted_path: adoptedPath, active_adopted_path: ['accepted', 'resumed'].includes(reportedState) ? adoptedPath : null,
    adoption_evidence: adoption, project_state_evidence: state,
    project_state_history: states.filter(r => !r.occurred_start || r.occurred_start <= at),
    future_project_state_history: states.filter(r => r.occurred_start && r.occurred_start > at),
    selected_design: careerRecordView(design, collection), design_history: allDesigns,
    milestones, note: 'New designs do not silently replace an accepted version. Dates/status reports do not verify acceptance criteria, quality or project completion.' };
}

export function careerSummary(options = {}) {
  const subject = options.subject ?? 'self', to = dateOrNull(options.to ?? today()), days = options.days ?? 14;
  ensure(Number.isInteger(days) && days > 0, 'Summary days must be a positive integer.');
  const from = dateOrNull(options.from ?? addDays(to, -(days - 1))), collection = careerRecords();
  ensure(!from || from <= to, 'Summary dates are reversed.');
  const timeline = careerTimeline({ subject, from, to, project_ref: options.project_ref }, collection);
  const sessions = [...timeline.records, ...timeline.unknown_date_records].filter(r => r.kind === 'work_session');
  const groups = durationGroups(sessions);
  const outcomes = timeline.records.filter(r => r.kind === 'evidence');
  const eventRecords = [...timeline.records, ...timeline.unknown_date_records].filter(r => r.kind === 'career_event');
  const processIds = [...new Set(eventRecords.map(r => r.details.process_id))];
  const processes = processIds.map(id => {
    // Read full retained process history to keep a narrow reporting window from inventing a new current state.
    const all = collection.current.filter(r => r.kind === 'career_event' && r.subject === subject && r.details.process_id === id).map(r => careerRecordView(r, collection));
    return { process_id: id, mode: all[0].details.mode, stage: datedClaim(all.filter(r => r.details.statement_type === 'observation'), r => r.details.stage, to),
      proposals: all.filter(r => r.details.statement_type === 'plan'), history: all };
  });
  return { subject, from, to, duration_groups: groups, sessions, evidence_records: outcomes,
    evidence_counts: Object.fromEntries(['deliverable', 'feedback', 'skill_proof', 'assessment', 'result'].map(type => [type, outcomes.filter(r => r.details.type === type && r.usable_as_recorded_evidence && r.date_precision === 'day').length])),
    unknown_date_evidence: timeline.unknown_date_records.filter(r => r.kind === 'evidence'), processes,
    note: 'Recorded subtotals only. Duration bases, estimates, legacy work_h, outputs and impact are separate; no full-day coverage, efficiency, quality or hiring probability is inferred.' };
}
