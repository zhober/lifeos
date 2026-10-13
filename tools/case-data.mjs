// Coordinator-mediated, file-based expert exchange. No agent or API is invoked here.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, today, localDate, timezone, parseDoc, journalPath } from './lib.mjs';
import { walk, readJSON, digest, stable, keyId, immutable, withLock, currentHash, vaultPath, dateOrNull } from './store.mjs';
import { ensure, textValue, strings, captureSources, sourceStatus } from './record-data.mjs';
import { healthRecords, healthView } from './health-data.mjs';
import { latestMeals } from './meal-data.mjs';
import { latestIndependent } from './nutrition-independent.mjs';
import { nutritionDay } from './nutrition-day.mjs';
import { sourcesCurrent } from './nutrition-sources.mjs';
import { fitnessRecords, fitnessRecordView, planEvents } from './fitness-data.mjs';
import { careerRecords, careerRecordView, careerProjectFingerprint } from './career-data.mjs';
import { shoppingRecords, shoppingRecordView } from './shopping-data.mjs';
import { financeRecord, financeSourceAllowed } from './finance-data.mjs';
import { status as requestStatus, terminalStates } from './work-state.mjs';

function roster() {
  const dir = readJSON('project.json').definitions.agents_directory;
  return walk(dir, '.md').flatMap(file => {
    const doc = parseDoc(fs.readFileSync(vaultPath(file), 'utf8'));
    return /lifeos:kind=system/.test(doc.body) || doc.data.name === 'critic' ? [] : [doc.data.name];
  });
}
export function caseDefinitions() {
  const ids = new Set();
  return walk('records/cases', '.json').filter(file => file.endsWith('/definition.json')).map(file => {
    const record = readJSON(file);
    ensure(record.schema_version === 1 && textValue(record.case_id) && !ids.has(record.case_id), 'Invalid or conflicting case definition: ' + file);
    ids.add(record.case_id); return { ...record, file };
  });
}
function locate(id) { const record = caseDefinitions().find(item => item.case_id === id); ensure(record, 'Unknown case: ' + id); return record; }
function caseEvents(definition) {
  const dir = definition.file.slice(0, definition.file.lastIndexOf('/')) + '/events';
  const events = walk(dir, '.json').map(file => ({ ...readJSON(file), file })).sort((a, b) => a.sequence - b.sequence);
  events.forEach((event, index) => ensure(event.schema_version === 1 && event.case_id === definition.case_id && event.sequence === index + 1, 'Invalid or branched case event sequence.'));
  return events;
}
const contextRevision = events => 1 + events.filter(event => ['evidence', 'state', 'bind', 'participants'].includes(event.type)).length;
const activeVersions = (events, type) => {
  const superseded = new Set(events.filter(event => event.type === type).map(event => event.supersedes).filter(Boolean));
  return events.filter(event => event.type === type && !superseded.has(event.event_id));
};
function requestBinding(definition, events) {
  const requestId = events.filter(event => event.type === 'bind').at(-1)?.request_id ?? definition.request_id;
  if (!requestId) return { dispatch_allowed: true, plan_revision: null };
  try {
    const request = requestStatus(requestId);
    return { request_id: request.id, plan_revision: request.plan_revision, control_state: request.control_state,
      dispatch_allowed: request.control_state === 'active' && !request.replacement_blocked && !terminalStates.has(request.state),
      note: 'The task ready-step/attempt checks still apply; this case does not advance task execution.' };
  } catch { return { request_id: requestId, dispatch_allowed: false, reason: 'unavailable_request' }; }
}
function normalizedFinancePath(relative) {
  try {
    const file = vaultPath(relative);
    return (fs.existsSync(file) ? path.relative(fs.realpathSync(ROOT), fs.realpathSync(file)) : path.relative(ROOT, file)).replaceAll('\\', '/');
  } catch { return relative ?? ''; }
}
function referenceInspector() {
  let health, meals, totals, memories, zone, career, shopping; const fitness = new Map();
  return ref => {
    const financialPath = normalizedFinancePath(ref.path);
    if (/^inbox\/finance\//i.test(financialPath)) {
      try { if (!financeSourceAllowed(financialPath)) return { path: ref.path, current: false, reason: 'finance_original_withheld' }; }
      catch { return { path: ref.path, current: false, reason: 'finance_original_unavailable' }; }
    }
    if (/^records\/finance\/entries\//i.test(financialPath)) {
      try {
        // Finance exposure is checked before even hashing/reading the worksheet body.
        const view = financeRecord(financialPath), status = sourceStatus(ref);
        if (!status.current) return status;
        if (view.superseded || view.state === 'retracted') return { ...status, current: false, reason: 'finance_record_superseded_or_retracted' };
        if (view.limitations.includes('source_missing_changed_or_withheld')) return { ...status, current: false, reason: 'finance_source_changed_or_withheld' };
        return { ...status, limitations: view.limitations, basis: view.basis };
      } catch { return { path: ref.path, current: false, reason: 'finance_unavailable_or_withheld' }; }
    }
    const status = sourceStatus(ref); if (!status.current) return status;
    try {
      let latest;
      if (ref.path.startsWith('records/health/entries/')) {
        health ??= healthRecords().current;
        const saved = readJSON(ref.path); latest = health.find(record => record.record_id === saved.record_id);
        if (latest?.file === ref.path && latest.state === 'active') {
          const view = healthView(latest);
          if (view.source_status.some(source => !source.current)) return { ...status, current: false, reason: 'health_source_changed' };
          return { ...status, limitations: view.limitations };
        }
      } else if (ref.path.startsWith('records/nutrition/meals/')) {
        meals ??= latestMeals(); const saved = readJSON(ref.path); latest = meals.find(record => record.meal_id === saved.meal_id);
      } else if (ref.path.startsWith('records/nutrition/totals/')) {
        totals ??= latestIndependent(); const saved = readJSON(ref.path); latest = totals.find(record => record.date === saved.date);
      } else if (ref.path.startsWith('records/nutrition/days/')) {
        const saved = readJSON(ref.path), journal = journalPath(saved.date);
        const body = fs.existsSync(journal) ? parseDoc(fs.readFileSync(journal, 'utf8')).body : '';
        meals ??= latestMeals(); const day = nutritionDay(saved.date, body, meals);
        if (day.coverage_record !== ref.path || !day.coverage_current) return { ...status, current: false, reason: 'nutrition_coverage_stale' };
      } else if (/^records\/fitness\/(sessions|plans|recovery|assessments)\//.test(ref.path)) {
        const kind = ref.path.split('/')[2], idField = ({ sessions: 'session_id', plans: 'plan_id', recovery: 'recovery_id', assessments: 'assessment_id' })[kind];
        if (!fitness.has(kind)) fitness.set(kind, fitnessRecords(kind).current);
        const saved = readJSON(ref.path); latest = fitness.get(kind).find(record => record[idField] === saved[idField]);
        if (!latest || latest.file !== ref.path || latest.state === 'retracted') return { ...status, current: false, reason: 'fitness_record_superseded_or_retracted', current_path: latest?.file ?? null };
        const observed = fitnessRecordView(latest);
        if (observed.limitations.some(limit => ['source_changed', 'health_context_changed'].includes(limit))) return { ...status, current: false, reason: 'fitness_context_changed' };
        if (kind === 'plans' && Object.hasOwn(ref, 'fitness_plan_sequence_at_capture') && planEvents(latest.plan_id).length !== ref.fitness_plan_sequence_at_capture)
          return { ...status, current: false, reason: 'fitness_plan_state_changed' };
        if (kind === 'plans') {
          const state = planEvents(latest.plan_id).at(-1);
          if (state && (state.sources.some(source => !sourceStatus(source).current) || state.plan_sha256 !== currentHash(vaultPath(state.plan_path))))
            return { ...status, current: false, reason: 'fitness_plan_state_source_changed' };
        }
        return { ...status, limitations: observed.limitations };
      } else if (ref.path.startsWith('records/fitness/plan-events/')) {
        const saved = readJSON(ref.path), latestState = planEvents(saved.plan_id).at(-1);
        if (latestState?.file !== ref.path || saved.plan_sha256 !== currentHash(vaultPath(saved.plan_path)) || saved.sources.some(source => !sourceStatus(source).current))
          return { ...status, current: false, reason: 'fitness_plan_state_changed' };
      } else if (ref.path.startsWith('records/career/entries/')) {
        career ??= careerRecords();
        const saved = readJSON(ref.path); latest = career.current.find(r => r.record_id === saved.record_id);
        if (!latest || latest.file !== ref.path || latest.state === 'retracted') return { ...status, current: false, reason: 'career_record_superseded_or_retracted', current_path: latest?.file ?? null };
        const observed = careerRecordView(latest, career);
        if (observed.limitations.some(limit => ['source_changed', 'linked_context_changed'].includes(limit))) return { ...status, current: false, reason: 'career_context_changed' };
        if (latest.kind === 'project' && Object.hasOwn(ref, 'career_project_state_at_capture')
          && ref.career_project_state_at_capture !== careerProjectFingerprint(latest.record_id, latest.subject, career))
          return { ...status, current: false, reason: 'career_project_state_changed' };
        if (latest.kind === 'project' && career.current.filter(r => r.kind === 'project_state' && r.bindings.some(b => b.record_id === latest.record_id))
          .some(r => careerRecordView(r, career).limitations.includes('source_changed'))) return { ...status, current: false, reason: 'career_project_state_source_changed' };
        return { ...status, limitations: observed.limitations };
      } else if (ref.path.startsWith('records/shopping/entries/')) {
        shopping ??= shoppingRecords(); const saved = readJSON(ref.path); latest = shopping.current.find(r => r.record_id === saved.record_id);
        if (!latest || latest.file !== ref.path || latest.state === 'retracted') return { ...status, current: false, reason: 'shopping_record_superseded_or_retracted', current_path: latest?.file ?? null };
        const view = shoppingRecordView(latest, shopping);
        if (view.limitations.some(x => ['source_changed', 'linked_product_changed'].includes(x))) return { ...status, current: false, reason: 'shopping_context_changed' };
        return { ...status, limitations: view.limitations };
      } else if (ref.path.startsWith('memory/entries/')) {
        memories ??= walk('memory/entries', '.json').map(file => readJSON(file)); zone ??= timezone();
        const saved = readJSON(ref.path);
        if (memories.some(entry => entry.supersedes?.includes(saved.id)
          && (entry.valid_from ?? entry.occurred_start ?? localDate(entry.recorded_at, zone)) <= today(zone)))
          return { ...status, current: false, reason: 'superseded_memory' };
      } else if (/^records\/cases\/.+\/events\/.+\.json$/.test(ref.path)) {
        const saved = readJSON(ref.path), events = caseEvents(locate(saved.case_id));
        if (events.some(event => event.supersedes === saved.event_id)) return { ...status, current: false, reason: 'superseded_case_artifact' };
      }
      if (latest && (latest.file !== ref.path || latest.state === 'retracted'))
        return { ...status, current: false, reason: 'superseded_or_retracted_record', current_path: latest.file };
      if (latest && ref.path.startsWith('records/nutrition/') && (!sourcesCurrent(latest.sources)
        || latest.derived?.components.some(component => !sourcesCurrent(component.sources)
          || component.reference?.sources && !sourcesCurrent(component.reference.sources)
          || Object.values(component.structural_zeros ?? {}).some(proof => !sourcesCurrent(proof.sources)))))
        return { ...status, current: false, reason: 'nutrition_source_changed' };
      if (ref.path.startsWith('records/health/entries/') && !latest) return { ...status, current: false, reason: 'missing_record' };
      return status;
    } catch { return { ...status, current: false, reason: 'invalid_linked_record' }; }
  };
}
export function showCase(id, at = today()) {
  dateOrNull(at);
  const definition = locate(id), events = caseEvents(definition), revision = contextRevision(events), inspect = referenceInspector();
  const assignment = events.filter(event => event.type === 'participants').at(-1) ?? definition;
  const state = events.filter(event => event.type === 'state').at(-1)?.state ?? 'open', binding = requestBinding(definition, events), enabled = roster();
  const definitionSourceStatus = definition.sources.map(inspect);
  const evidence = activeVersions(events, 'evidence').map(event => ({ ...event, source_status: event.refs.map(inspect) }));
  const unanswered = [];
  const questions = activeVersions(events, 'question').map(question => {
    const response = activeVersions(events, 'response').findLast(event => event.question_id === question.question_id);
    const sourceChecks = question.refs.map(inspect), changed = revision !== question.context_revision || sourceChecks.some(ref => !ref.current);
    const roleUnavailable = !enabled.includes(question.to_expert);
    const stale = changed || roleUnavailable || question.request_plan_revision !== binding.plan_revision
      || response && (response.accepted !== true || response.refs.some(ref => !inspect(ref).current));
    const status = stale ? 'needs_reassessment' : !response ? 'pending' : response.outcome === 'assessed' ? 'answered' : 'needs_input';
    const item = { ...question, response: response ?? null, status, source_status: sourceChecks,
      dispatch_allowed: status === 'pending' && state !== 'closed' && binding.dispatch_allowed && !roleUnavailable };
    if (status !== 'answered') unanswered.push(item); return item;
  });
  const claims = activeVersions(events, 'claim').map(event => ({ ...event, source_status: [...event.refs, ...event.contrary_refs].map(inspect),
    needs_reassessment: event.context_revision !== revision || [...event.refs, ...event.contrary_refs].map(inspect).some(ref => !ref.current),
    evidence: 'inferred', personal_fact: false }));
  const followups = activeVersions(events, 'followup').map(event => ({ ...event,
    due: ['planned', 'deferred'].includes(event.status) && Boolean(event.due_on && event.due_on <= at),
    unknown_due_date: !event.due_on }));
  const grouped = new Map();
  for (const claim of claims.filter(claim => claim.status !== 'withdrawn')) {
    if (!grouped.has(claim.topic_key)) grouped.set(claim.topic_key, []); grouped.get(claim.topic_key).push(claim);
  }
  const possibleDisagreements = [...grouped].filter(([, group]) => new Set(group.map(claim => claim.text)).size > 1)
    .map(([topic_key, group]) => ({ topic_key, claim_ids: group.map(claim => claim.claim_id), requires_comparison: true }));
  return { ...definition, participants: assignment.participants, lead: assignment.lead, state, context_revision: revision, request_binding: binding, definition_source_status: definitionSourceStatus, evidence, questions, claims, followups,
    possible_disagreements: possibleDisagreements,
    pending_questions: unanswered, unavailable_participants: assignment.participants.filter(role => !enabled.includes(role)),
    needs_reassessment: definitionSourceStatus.some(ref => !ref.current) || evidence.some(event => event.source_status.some(ref => !ref.current)) || questions.some(question => question.status === 'needs_reassessment')
      || claims.some(claim => claim.needs_reassessment),
    events, note: 'Case closure is coordination closure, not clinical resolution. Hypotheses and assessments do not become verified personal facts.' };
}
export function createCase(input) {
  ensure(textValue(input.operation_id), 'Case creation needs a stable operation_id.');
  return withLock('case-create', () => {
    const id = keyId('case', input.operation_id), fingerprint = digest(stable(input)), existing = caseDefinitions().find(record => record.case_id === id);
    if (existing) { ensure(existing.input_hash === fingerprint, 'Case operation ID reused with different input.'); return { case_id: id, path: existing.file, replay: true }; }
    ensure(textValue(input.title) && textValue(input.subject), 'Case needs a title and explicit subject identity.');
    const participants = strings(input.participants, 'participants'), domains = strings(input.domains, 'domains'), enabled = roster();
    ensure(participants.length > 0 && domains.length > 0 && new Set(participants).size === participants.length
      && participants.includes(input.lead) && participants.every(role => enabled.includes(role)), 'Choose a lead and unique enabled domain experts.');
    if (input.request_id) requestStatus(input.request_id);
    const sources = captureCaseSources(input.sources);
    ensure(sameSubject(sources, input.subject), 'Case evidence belongs to a different subject.');
    const captured = new Date().toISOString(), file = 'records/cases/' + captured.slice(0, 4) + '/' + id + '/definition.json';
    immutable(file, { ...input, schema_version: 1, case_id: id, participants, domains, sources,
      recorded_at: captured, input_hash: fingerprint });
    return { case_id: id, path: file, context_revision: 1, replay: false };
  });
}
function participant(view, role, allowMain = false) {
  ensure(allowMain && role === 'main-assistant' || view.participants.includes(role) && roster().includes(role), 'Expert is not an enabled participant: ' + role);
}
const uniqueRefs = refs => [...new Map(refs.map(ref => [stable(ref), ref])).values()];
const sameSubject = (refs, subject) => refs.every(ref => {
  if (ref.path.startsWith('records/fitness/plan-events/')) return readJSON(readJSON(ref.path).plan_path)?.subject === subject;
  if (ref.path.startsWith('records/career/entries/')) { const r = readJSON(ref.path); return r?.kind === 'opportunity' || r?.subject === subject; }
  if (ref.path.startsWith('records/shopping/entries/')) { const r = readJSON(ref.path); return ['product', 'quality'].includes(r?.kind) || r?.subject === subject; }
  if (/^records\/finance\/entries\//i.test(normalizedFinancePath(ref.path))) { const r = financeRecord(normalizedFinancePath(ref.path)); return r.basis === 'hypothetical' || r.subject === subject; }
  return !/^records\/(health\/entries|fitness\/(sessions|plans|recovery|assessments))\//.test(ref.path) || readJSON(ref.path)?.subject === subject;
});
const captureCaseSources = sources => {
  let career, shopping;
  for (const source of sources ?? []) {
    const relative = typeof source === 'string' ? source : source.path;
    const normalized = normalizedFinancePath(relative);
    if (/^records\/finance\/entries\//i.test(normalized)) financeRecord(normalized);
    if (/^inbox\/finance\//i.test(normalized)) ensure(financeSourceAllowed(normalized), 'Financial original is withheld by privacy preferences.');
  }
  return captureSources(sources).map(originalRef => {
  let ref = originalRef;
  const normalized = path.relative(ROOT, vaultPath(ref.path)).replaceAll('\\', '/');
  if (/^records\/career\/entries\//i.test(normalized)) {
    career ??= careerRecords();
    const canonical = career.all.find(r => r.file.toLowerCase() === normalized.toLowerCase());
    ensure(canonical, 'Unknown canonical career source.');
    if (ref.path !== canonical.file) ref = { ...ref, path: canonical.file, source_path_as_provided: ref.path };
  }
  if (/^records\/shopping\/entries\//i.test(normalized)) {
    shopping ??= shoppingRecords(); const canonical = shopping.all.find(r => r.file.toLowerCase() === normalized.toLowerCase());
    ensure(canonical, 'Unknown canonical shopping source.');
    if (ref.path !== canonical.file) ref = { ...ref, path: canonical.file, source_path_as_provided: ref.path };
  }
  if (ref.path.startsWith('records/fitness/plans/') && !Object.hasOwn(ref, 'fitness_plan_sequence_at_capture'))
    return { ...ref, fitness_plan_sequence_at_capture: planEvents(readJSON(ref.path).plan_id).length };
  if (ref.path.startsWith('records/career/entries/') && !Object.hasOwn(ref, 'career_project_state_at_capture')) {
    const r = readJSON(ref.path);
    if (r.kind === 'project') return { ...ref, career_project_state_at_capture: careerProjectFingerprint(r.record_id, r.subject, career ?? careerRecords()) };
  }
  return ref;
  });
};
export function caseEvent(type, input) {
  ensure(textValue(input.operation_id), 'Case event needs a stable operation_id.');
  return withLock('case/' + input.case_id, () => {
    const definition = locate(input.case_id), existingEvents = caseEvents(definition), fingerprint = digest(stable({ type, input }));
    const eventId = keyId('case-event', input.operation_id), existing = existingEvents.find(event => event.event_id === eventId);
    if (existing) {
      ensure(existing.input_hash === fingerprint, 'Case operation ID reused with different input.');
      return { case_id: input.case_id, event_id: eventId, path: existing.file, question_id: existing.question_id ?? null,
        question_sha256: existing.type === 'question' ? currentHash(vaultPath(existing.file)) : undefined, accepted: existing.accepted,
        context_revision: existing.context_revision, revision_after: existing.revision_after, replay: true };
    }
    const view = showCase(input.case_id), binding = view.request_binding, inspect = referenceInspector();
    ensure(['evidence', 'question', 'response', 'claim', 'followup', 'state', 'bind', 'participants'].includes(type), 'Unknown case event type.');
    let saved = { ...input, type, schema_version: 1, case_id: input.case_id, event_id: eventId,
      sequence: existingEvents.length + 1, recorded_at: new Date().toISOString(), input_hash: fingerprint,
      context_revision: view.context_revision, revision_after: view.context_revision + (['evidence', 'state', 'bind', 'participants'].includes(type) ? 1 : 0),
      coordinator: 'main-assistant' };
    if (type !== 'response') ensure(input.expected_revision === view.context_revision, 'Case context changed; reread before mutation.');
    if (!['response', 'state', 'bind'].includes(type)) ensure(view.state !== 'closed' && binding.dispatch_allowed, 'Case/request is closed, paused, or waiting.');
    if (type === 'evidence') {
      ensure(textValue(input.reason), 'Evidence needs an explicit reason.'); saved.refs = captureCaseSources(input.sources);
      ensure(sameSubject(saved.refs, view.subject), 'Health evidence belongs to a different subject.');
      if (input.supersedes) ensure(view.evidence.some(event => event.event_id === input.supersedes), 'Evidence correction must supersede the current evidence event.');
    } else if (type === 'question') {
      participant(view, input.from_expert, true); participant(view, input.to_expert);
      ensure(textValue(input.question), 'Question text is required.');
      const refs = uniqueRefs(captureCaseSources([...definition.sources, ...view.evidence.flatMap(event => event.refs), ...(input.sources ?? [])]));
      ensure(sameSubject(refs, view.subject), 'Question health evidence belongs to a different subject.');
      ensure(refs.every(ref => inspect(ref).current), 'Question evidence is stale; refresh the evidence before asking.');
      const previous = input.supersedes ? view.questions.find(question => question.event_id === input.supersedes) : null;
      ensure(!input.supersedes || previous, 'A follow-up question must supersede the current question in its thread.');
      const round = (previous?.round ?? 0) + 1, maximum = readJSON('project.json')?.collaboration?.max_question_rounds ?? 3;
      ensure(Number.isInteger(maximum) && maximum >= 1 && maximum <= 10 && round <= maximum, 'Question-thread round limit reached; preserve the gap instead of restarting silently.');
      saved = { ...saved, refs, question_id: keyId('question', input.operation_id), thread_id: previous?.thread_id ?? keyId('thread', input.operation_id),
        round, request_plan_revision: binding.plan_revision };
    } else if (type === 'response') {
      const question = existingEvents.find(event => event.type === 'question' && event.question_id === input.question_id);
      ensure(question, 'Unknown question.');
      ensure(input.expert === question.to_expert && textValue(input.response) && ['assessed', 'needs_input', 'unavailable'].includes(input.outcome), 'Response must come from the requested role with text and an outcome.');
      ensure(input.question_sha256 === currentHash(vaultPath(question.file)) && input.context_revision === question.context_revision,
        'Response must bind the exact question hash and its context revision.');
      const previous = activeVersions(existingEvents, 'response').findLast(event => event.question_id === question.question_id);
      ensure(previous ? input.supersedes === previous.event_id : !input.supersedes, 'A response correction must supersede the exact latest response.');
      const reasons = [];
      if (view.state === 'closed' || !binding.dispatch_allowed) reasons.push('case_or_request_stopped');
      if (view.context_revision !== question.context_revision) reasons.push('context_changed');
      if (!view.questions.some(item => item.question_id === question.question_id)) reasons.push('question_superseded');
      if (question.refs.some(ref => !inspect(ref).current)) reasons.push('source_changed');
      if (!roster().includes(input.expert)) reasons.push('expert_unavailable');
      if (question.request_plan_revision !== binding.plan_revision) reasons.push('request_replanned');
      // Retain late response text and submitted sources even when the old inputs vanished.
      ensure(Array.isArray(input.sources) && input.sources.length > 0, 'Response needs source references.');
      for (const source of input.sources) vaultPath(typeof source === 'string' ? source : source.path);
      let refs;
      try { refs = captureCaseSources(input.sources); } catch { reasons.push('response_sources_unavailable_or_changed'); refs = question.refs; }
      if (!sameSubject(refs, view.subject)) reasons.push('response_subject_mismatch');
      saved = { ...saved, refs, accepted: reasons.length === 0, stale_reasons: reasons,
        context_revision: question.context_revision, request_plan_revision: question.request_plan_revision };
    } else if (type === 'claim') {
      participant(view, input.expert);
      ensure(['hypothesis', 'assessment'].includes(input.kind) && textValue(input.text) && textValue(input.topic_key)
        && ['proposed', 'supported', 'refuted', 'withdrawn'].includes(input.status), 'Claim needs a typed assessment/hypothesis, topic, text, and status.');
      const previous = input.claim_id ? view.claims.find(claim => claim.claim_id === input.claim_id) : null;
      ensure(previous ? input.supersedes === previous.event_id : !input.supersedes && !input.claim_id, 'Claim changes must supersede the exact current claim.');
      ensure(!previous || previous.expert === input.expert, 'A claim correction retains its author; another expert records a separate assessment.');
      saved = { ...saved, claim_id: previous?.claim_id ?? keyId('claim', input.operation_id), evidence: 'inferred', personal_fact: false,
        refs: captureCaseSources(input.sources), contrary_refs: input.contrary_sources?.length ? captureCaseSources(input.contrary_sources) : [] };
    } else if (type === 'followup') {
      participant(view, input.owner);
      ensure(textValue(input.text) && ['planned', 'reported_complete', 'cancelled', 'deferred'].includes(input.status), 'Follow-up needs owner, text, and evidenced status.');
      const previous = input.followup_id ? view.followups.find(item => item.followup_id === input.followup_id) : null;
      ensure(previous ? input.supersedes === previous.event_id : !input.supersedes && !input.followup_id, 'Follow-up changes must supersede the current item.');
      saved = { ...saved, followup_id: previous?.followup_id ?? keyId('followup', input.operation_id), due_on: dateOrNull(input.due_on), refs: captureSources(input.sources) };
    } else if (type === 'participants') {
      const participants = strings(input.participants, 'participants'), enabled = roster();
      ensure(textValue(input.reason) && participants.length > 0 && new Set(participants).size === participants.length
        && participants.includes(input.lead) && participants.every(role => enabled.includes(role)), 'Participant revision needs unique enabled domain experts, a lead, and a reason.');
      saved = { ...saved, participants, lead: input.lead, refs: captureSources(input.sources) };
    } else if (type === 'bind') {
      ensure(textValue(input.request_id) && input.request_id !== binding.request_id && textValue(input.reason), 'Bind needs a distinct execution request and sourced reason.');
      const next = requestStatus(input.request_id);
      ensure(next.control_state === 'active' && !terminalStates.has(next.state) && !next.replacement_blocked, 'New execution request must be active.');
      if (binding.request_id) {
        const prior = requestStatus(binding.request_id);
        ensure(terminalStates.has(prior.state) && next.parent_request === prior.id
          && ['follow_up', 'replaces'].includes(next.relation_to_parent), 'Do not bypass an active/paused request; bind its activated replacement or a linked follow-up after closure.');
      }
      saved.refs = captureSources(input.sources);
    } else if (type === 'state') {
      ensure(['open', 'monitoring', 'closed'].includes(input.state) && input.state !== view.state && textValue(input.reason), 'State needs a genuine transition and sourced reason.');
      saved.refs = captureSources(input.sources);
    }
    if (type !== 'response') ensure(sameSubject(saved.refs ?? [], view.subject) && sameSubject(saved.contrary_refs ?? [], view.subject), 'Case health evidence belongs to a different subject.');
    const file = definition.file.slice(0, definition.file.lastIndexOf('/')) + '/events/' + String(saved.sequence).padStart(6, '0') + '-' + eventId + '.json';
    immutable(file, saved);
    return { case_id: input.case_id, event_id: eventId, path: file, question_id: saved.question_id ?? null,
      question_sha256: type === 'question' ? currentHash(vaultPath(file)) : undefined,
      context_revision: saved.context_revision, revision_after: saved.revision_after,
      accepted: saved.accepted, stale_reasons: saved.stale_reasons, claim_id: saved.claim_id, followup_id: saved.followup_id, replay: false };
  });
}
export function caseQueue(at = today()) {
  return caseDefinitions().map(definition => showCase(definition.case_id, at)).map(view => ({ case_id: view.case_id, title: view.title,
    state: view.state, subject: view.subject, context_revision: view.context_revision, request_binding: view.request_binding,
    pending_questions: view.pending_questions.map(question => ({ question_id: question.question_id, to_expert: question.to_expert,
      status: question.status, dispatch_allowed: question.dispatch_allowed })), needs_reassessment: view.needs_reassessment,
    due_followups: view.followups.filter(item => item.due), unavailable_participants: view.unavailable_participants }));
}
