// Request control is an append-only event history, independent of the model runtime.
import { today } from './lib.mjs';
import { getLanguagePreference } from './language.mjs';
import { digest, stable, keyId, readJSON, immutable, walk, sourceRefs, dateOrNull, withLock, currentHash, vaultPath } from './store.mjs';
import fs from 'node:fs';
import { checkReview } from './review-data.mjs';

export const terminalStates = new Set(['completed', 'completed_with_gaps', 'cancelled', 'superseded']);

export function locate(id, namespace, filename) {
  const suffix = '/' + id + '/' + filename;
  const file = walk(namespace, '.json').find(item => item.endsWith(suffix));
  if (!file) throw new Error('Unknown ' + namespace + ' identifier: ' + id);
  return { file, directory: file.slice(0, -filename.length), record: readJSON(file) };
}
export const request = id => locate(id, 'tasks', 'request.json');

export function events(directory) {
  return walk(directory + 'events', '.json').map(file => ({ ...readJSON(file), file }))
    .sort((a, b) => a.sequence - b.sequence || a.recorded_at.localeCompare(b.recorded_at) || a.id.localeCompare(b.id));
}

function normalizeSteps(input, captureInputs = true) {
  if (!Array.isArray(input) || !input.length) throw new Error('A plan needs at least one step.');
  const seen = new Set();
  const steps = input.map((step, index) => {
    const item = typeof step === 'string' ? { id: step } : { ...step };
    if (!/^[a-z0-9][a-z0-9-]*$/.test(item.id ?? '') || seen.has(item.id)) throw new Error('Step identifiers must be unique lowercase identifiers.');
    item.required = item.required !== false;
    item.waivable = item.waivable ?? !item.required;
    item.effect = item.effect ?? 'read';
    item.max_attempts = item.max_attempts ?? null;
    if (typeof item.waivable !== 'boolean' || !['read', 'write', 'external'].includes(item.effect)) throw new Error('Invalid waiver policy or effect.');
    if (item.review_gate !== undefined && (typeof item.review_gate !== 'boolean'
      || (item.review_gate && (!item.required || item.waivable || item.effect !== 'read' || item.expert))))
      throw new Error('A review gate must be a required non-waivable read validation step without an expert.');
    if (item.max_attempts !== null && (!Number.isInteger(item.max_attempts) || item.max_attempts < 1)) throw new Error('max_attempts must be a positive integer or null.');
    if (!Object.hasOwn(item, 'depends_on')) item.depends_on = index ? [typeof input[index - 1] === 'string' ? input[index - 1] : input[index - 1].id] : [];
    if (!Array.isArray(item.depends_on) || item.depends_on.some(id => typeof id !== 'string')) throw new Error('Step dependencies must be an array.');
    item.depends_on = [...new Set(item.depends_on)];
    if (item.expert !== undefined && !/^[a-z0-9][a-z0-9-]*$/.test(item.expert)) throw new Error('Invalid expert identifier.');
    if (item.inputs !== undefined) {
      if (!Array.isArray(item.inputs)) throw new Error('Step inputs must be source references.');
      if (captureInputs && item.inputs.length) item.inputs = sourceRefs(item.inputs);
    }
    seen.add(item.id);
    return item;
  });
  const byId = new Map(steps.map(step => [step.id, step])), visited = new Set(), visiting = new Set();
  const visit = id => {
    if (visiting.has(id)) throw new Error('Step dependencies contain a cycle.');
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of byId.get(id).depends_on) {
      if (!byId.has(dependency)) throw new Error('Unknown step dependency: ' + dependency);
      visit(dependency);
    }
    visiting.delete(id); visited.add(id);
  };
  for (const step of steps) visit(step.id);
  return steps;
}

export function appendEvent(located, input, build) {
  if (!input.operation_id) throw new Error('A stable operation_id is required.');
  return withLock(located.directory + 'event-sequence', () => {
    const previous = events(located.directory), id = keyId('event', input.operation_id), inputHash = digest(stable(input));
    const existing = previous.find(event => event.id === id);
    if (existing) {
      if (existing.input_hash !== inputHash) throw new Error('Event operation identifier reused with different content.');
      return { ...existing, replay: true };
    }
    const detail = build();
    const event = { id, input_hash: inputHash, sequence: previous.length ? Math.max(...previous.map(item => item.sequence)) + 1 : 1,
      recorded_at: new Date().toISOString(), ...detail };
    const file = located.directory + 'events/' + String(event.sequence).padStart(8, '0') + '-' + id + '.json';
    immutable(file, event);
    return { ...event, file, replay: false };
  });
}

function blankStep(definition, previous, retain = false) {
  return { ...definition, status: retain ? previous.status : 'pending',
    attempts: previous?.attempts ?? 0, attempt_id: retain ? previous.attempt_id : null,
    worker_id: retain ? previous.worker_id ?? null : null,
    artifacts: retain ? previous.artifacts : [], error: retain ? previous.error : null,
    waiver: retain ? previous.waiver : null };
}

export function status(id) {
  const located = request(id), history = events(located.directory);
  let definitions = normalizeSteps(located.record.steps, false), revision = 1;
  let steps = definitions.map(item => blankStep(item));
  let lifecycle = 'active', lastControl = null;
  const plans = [{ revision: 1, steps: definitions, sources: [{ path: located.file }], reason: 'Original request' }];
  for (const event of history) {
    if (event.type === 'plan') {
      const previous = new Map(steps.map(step => [step.id, step]));
      const oldDefinitions = new Map(definitions.map(step => [step.id, step]));
      definitions = normalizeSteps(event.steps, false); revision = event.plan_revision;
      steps = definitions.map(definition => {
        const old = previous.get(definition.id), reused = event.reuse_steps.includes(definition.id);
        const same = oldDefinitions.has(definition.id) && stable(oldDefinitions.get(definition.id)) === stable(definition);
        const next = blankStep(definition, reused || same ? old : undefined, reused);
        if (reused && event.reused_artifacts?.[definition.id]) next.artifacts = event.reused_artifacts[definition.id];
        return next;
      });
      plans.push({ revision, steps: definitions, sources: event.sources, reason: event.reason,
        removed_steps: event.removed_steps, invalidated_steps: event.invalidate_steps });
    } else if (event.type === 'control') {
      lifecycle = event.control_state; lastControl = event;
    } else if (['step', 'waiver'].includes(event.type) && (event.plan_revision ?? 1) === revision) {
      const item = steps.find(step => step.id === event.step);
      if (!item) continue;
      if (event.type === 'waiver') {
        item.status = 'waived'; item.waiver = { reason: event.reason, basis: event.basis, sources: event.sources };
      } else {
        item.status = event.status; item.artifacts = event.artifacts ?? []; item.error = event.error ?? null;
        if (event.status === 'running') {
          item.attempts++; item.attempt_id = event.attempt_id ?? null; item.worker_id = event.worker_id ?? null;
        }
        if (event.status === 'skipped') item.waiver = { reason: event.reason, sources: event.sources };
      }
    }
  }
  const done = steps.filter(step => step.status === 'succeeded' || step.status === 'waived' || (step.status === 'skipped' && !step.required));
  const doneIds = new Set(done.map(step => step.id)), unfinished = steps.filter(step => !doneIds.has(step.id));
  const waived = steps.filter(step => ['waived', 'skipped'].includes(step.status));
  const failed = steps.some(step => step.status === 'failed');
  const executionState = done.length === steps.length ? (waived.length ? 'completed_with_gaps' : 'completed')
    : failed ? (done.length ? 'partial' : 'failed') : steps.some(step => step.status !== 'pending') ? 'in_progress' : 'pending';
  let replacementBlocked = false;
  if (located.record.parent_request && located.record.relation_to_parent === 'replaces') {
    const parent = request(located.record.parent_request), control = events(parent.directory).filter(item => item.type === 'control').at(-1);
    replacementBlocked = control?.control_state !== 'superseded' || control.replacement_request !== id;
  }
  const state = lifecycle !== 'active' ? lifecycle : replacementBlocked ? 'waiting' : executionState;
  const active = lifecycle === 'active' && !replacementBlocked && !terminalStates.has(state);
  const reasons = new Map();
  for (const step of unfinished) {
    const missing = step.depends_on.filter(dependency => !doneIds.has(dependency));
    if (missing.length) reasons.set(step.id, 'unfinished dependencies: ' + missing.join(', '));
    else if (step.status === 'running') reasons.set(step.id, 'attempt already running');
    else if (step.max_attempts !== null && step.attempts >= step.max_attempts) reasons.set(step.id, 'attempt budget exhausted');
  }
  const ready = active ? unfinished.filter(step => !reasons.has(step.id)).map(step => step.id) : [];
  return { ...located.record, file: located.file, state, execution_state: executionState, control_state: lifecycle,
    plan_revision: revision, plan_steps: definitions, plans, steps, last_control: lastControl,
    replacement_blocked: replacementBlocked,
    resume_steps: ['cancelled', 'superseded'].includes(state) ? [] : unfinished.map(step => step.id),
    ready_steps: ready, blocked_steps: unfinished.filter(step => !ready.includes(step.id)).map(step => step.id),
    blocking_reasons: Object.fromEntries(unfinished.filter(step => !ready.includes(step.id)).map(step => [step.id,
      !active ? (replacementBlocked ? 'awaiting parent supersession' : state) : reasons.get(step.id) ?? state])),
    in_flight_steps: unfinished.filter(step => step.status === 'running').map(step => ({ step: step.id, attempt_id: step.attempt_id, worker_id: step.worker_id ?? null })),
    waived_steps: waived.map(step => ({ step: step.id, expert: step.expert ?? null, ...step.waiver })),
    can_dispatch: ready.length > 0, history };
}

export function start(input) {
  if (!input.operation_id || typeof input.original_input !== 'string'
    || (!input.original_input.trim() && (!Array.isArray(input.attachments) || !input.attachments.length)))
    throw new Error('Supply operation_id, original_input, intents, and planned steps.');
  if (input.intents !== undefined && !Array.isArray(input.intents)) throw new Error('intents must be an array.');
  const id = keyId('req', input.operation_id), inputHash = digest(stable(input));
  const found = walk('tasks', '.json').find(file => file.endsWith('/' + id + '/request.json'));
  if (found) {
    if (readJSON(found).input_hash !== inputHash) throw new Error('Request operation identifier reused for another request.');
    return status(id);
  }
  const steps = normalizeSteps(input.steps), date = dateOrNull(input.date) ?? today();
  const attachments = input.attachments === undefined || (Array.isArray(input.attachments) && !input.attachments.length)
    ? [] : sourceRefs(input.attachments);
  const relation = input.parent_request ? input.relation_to_parent ?? 'follow_up' : null;
  if (input.relation_to_parent && !input.parent_request) throw new Error('A parent relationship requires a parent request.');
  if (relation && !['follow_up', 'replaces'].includes(relation)) throw new Error('Invalid parent relationship.');
  if (input.parent_request) {
    const parent = status(input.parent_request);
    if (relation === 'replaces' && terminalStates.has(parent.state)) throw new Error('Use a follow_up for an already closed request.');
  }
  immutable('tasks/' + date.slice(0, 4) + '/' + id + '/request.json', {
    schema_version: 2, id, operation_id: input.operation_id, input_hash: inputHash, attachments,
    recorded_at: new Date().toISOString(), date, original_input: input.original_input,
    intents: input.intents ?? [], steps, interaction_language: getLanguagePreference().interaction_language,
    parent_request: input.parent_request ?? null, relation_to_parent: relation
  });
  return status(id);
}

function checkRevision(input, task) {
  const supplied = input.plan_revision ?? (task.plan_revision === 1 ? 1 : null);
  if (supplied !== task.plan_revision) throw new Error('Stale or missing plan_revision; inspect the current plan.');
}
function ensureActive(task) {
  if (task.control_state !== 'active' || task.replacement_blocked || terminalStates.has(task.state))
    throw new Error('Request cannot execute steps while ' + task.state + '.');
}

export function step(input) {
  const located = request(input.request_id);
  return appendEvent(located, input, () => {
    const task = status(input.request_id); checkRevision(input, task); ensureActive(task);
    const current = task.steps.find(item => item.id === input.step);
    if (!current || !['running', 'succeeded', 'failed', 'skipped'].includes(input.status)) throw new Error('Invalid planned step or status.');
    if (['succeeded', 'waived', 'skipped'].includes(current.status)) throw new Error('A successful or finalized step cannot be rerun; revise the plan or create new work.');
    if (input.status === 'running' && current.status === 'running') throw new Error('An attempt is already running.');
    if (['running', 'succeeded'].includes(input.status) && current.depends_on.some(id => !task.steps.some(step =>
      step.id === id && (step.status === 'succeeded' || step.status === 'waived' || (step.status === 'skipped' && !step.required)))))
      throw new Error('Step dependencies are not complete: ' + current.depends_on.join(', '));
    if (input.status === 'running' && current.max_attempts !== null && current.attempts >= current.max_attempts)
      throw new Error('Attempt budget exhausted; wait, waive an eligible step, or revise the plan.');
    if (current.status === 'running' && current.attempt_id !== null && input.status !== 'running' && input.attempt_id !== current.attempt_id)
      throw new Error('Attempt identifier does not match the running attempt.');
    if (current.status !== 'running' && input.attempt_id !== undefined)
      throw new Error('No matching running attempt; preserve a late result with capture.');
    if (input.status === 'succeeded' && current.status !== 'running' && (current.expert || current.effect === 'external' || current.max_attempts !== null))
      throw new Error('Asynchronous or budgeted work needs a matching running attempt.');
    if (input.status === 'failed' && !input.error) throw new Error('A failed step requires an error description.');
    if (input.status === 'skipped' && (current.required || !current.waivable)) throw new Error('A required or non-waivable step cannot be silently skipped.');
    if (input.status === 'skipped' && !input.reason) throw new Error('Skipped work needs a reason and sources.');
    const artifacts = input.status === 'succeeded' ? sourceRefs(input.artifacts) : input.artifacts ?? [];
    if (input.status === 'succeeded' && current.review_gate) {
      if (typeof input.review_packet !== 'string' || !artifacts.some(ref => ref.path === input.review_packet))
        throw new Error('A review gate needs its review_packet in the successful artifacts.');
      const reviewed = checkReview(input.review_packet, { request_id: task.id, plan_revision: task.plan_revision, directory: located.directory });
      if (reviewed.gate === 'blocked') throw new Error('Review gate blocked: ' + reviewed.blocking.join('; '));
    }
    return { type: 'step', plan_revision: task.plan_revision, step: input.step, status: input.status,
      attempt_id: input.status === 'running' ? keyId('attempt', input.operation_id) : current.attempt_id,
      worker_id: input.status === 'running' ? input.worker_id ?? null : current.worker_id ?? null,
      artifacts, error: input.error ?? null,
      ...(input.status === 'skipped' ? { reason: input.reason, sources: sourceRefs(input.sources) } : {}) };
  });
}

export function control(input) {
  const located = request(input.request_id);
  return appendEvent(located, input, () => {
    const task = status(input.request_id);
    if (!input.reason || !['pause', 'wait', 'resume', 'cancel', 'supersede'].includes(input.action)) throw new Error('Supply a supported control action, reason, basis, and sources.');
    if (terminalStates.has(task.state)) throw new Error('Closed requests are not reopened; create a linked follow_up.');
    const sources = sourceRefs(input.sources);
    if (['pause', 'cancel', 'supersede'].includes(input.action) && input.basis !== 'user_request')
      throw new Error('This control action requires a user_request basis.');
    if (input.action === 'wait' && !['missing_input', 'unavailable_tool', 'conflict', 'runtime_failure'].includes(input.basis))
      throw new Error('Waiting needs a concrete blocking basis.');
    if (input.action === 'resume') {
      if (!['paused', 'waiting'].includes(task.control_state)) throw new Error('Request is not paused or waiting.');
      if (!['user_request', 'input_received', 'condition_resolved'].includes(input.basis)) throw new Error('Resume needs new input or a resolved condition.');
    }
    let replacement = null;
    if (input.action === 'supersede') {
      const next = request(input.replacement_request).record;
      if (next.id === task.id || next.parent_request !== task.id || next.relation_to_parent !== 'replaces')
        throw new Error('Replacement must be a distinct child request with relation_to_parent=replaces.');
      const nextState = status(next.id);
      if (terminalStates.has(nextState.state)) throw new Error('Replacement request is already closed.');
      replacement = next.id;
    }
    const state = { pause: 'paused', wait: 'waiting', resume: 'active', cancel: 'cancelled', supersede: 'superseded' }[input.action];
    return { type: 'control', action: input.action, control_state: state, reason: input.reason,
      basis: input.basis, sources, replacement_request: replacement,
      in_flight_at_control: task.in_flight_steps };
  });
}

function unchangedArtifacts(refs) {
  return refs.map(reference => {
    const file = vaultPath(reference.path), hash = currentHash(file);
    if (hash === null) throw new Error('Reusable artifact is missing: ' + reference.path);
    if (hash !== reference.sha256_at_capture && !(reference.quote && fs.readFileSync(file, 'utf8').includes(reference.quote)))
      throw new Error('Reusable artifact changed: ' + reference.path);
    return { ...reference, sha256_at_capture: hash };
  });
}

export function replan(input) {
  const located = request(input.request_id);
  return appendEvent(located, input, () => {
    const task = status(input.request_id);
    if (terminalStates.has(task.state) || task.replacement_blocked) throw new Error('Closed or unactivated replacement requests cannot be replanned.');
    if (input.expected_revision !== task.plan_revision) throw new Error('Stale expected_revision.');
    if (!input.reason || !['user_request', 'new_information', 'runtime_failure', 'source_change'].includes(input.basis))
      throw new Error('A revised plan needs a reason, basis, and sources.');
    if (task.in_flight_steps.length && task.control_state === 'active') throw new Error('Pause active workers before revising their plan.');
    const sources = sourceRefs(input.sources), definitions = normalizeSteps(input.steps);
    const reuse = input.reuse_steps ?? [], invalidate = input.invalidate_steps ?? [];
    if (!Array.isArray(reuse) || !Array.isArray(invalidate)) throw new Error('Reuse and invalidation declarations must be arrays.');
    const newById = new Map(definitions.map(item => [item.id, item]));
    const oldById = new Map(task.plan_steps.map(item => [item.id, item]));
    const oldState = new Map(task.steps.map(item => [item.id, item]));
    if (input.basis !== 'user_request' && task.steps.some(item => item.required && !item.waivable
      && !['succeeded', 'skipped', 'waived'].includes(item.status) && !newById.has(item.id)))
      throw new Error('Removing unfinished mandatory work requires an explicit user scope change.');
    const reusedArtifacts = {};
    for (const id of reuse) {
      const before = oldState.get(id), after = newById.get(id);
      if (!before || !after || before.status !== 'succeeded') throw new Error('Only successful existing steps may be reused: ' + id);
      if (invalidate.includes(id) || stable(oldById.get(id)) !== stable(after)) throw new Error('A reused step must keep the same definition and inputs: ' + id);
      if (after.depends_on.some(dependency => !reuse.includes(dependency))) throw new Error('Reused steps require reused dependencies: ' + id);
      reusedArtifacts[id] = unchangedArtifacts(before.artifacts);
    }
    for (const id of invalidate) {
      if (!oldState.has(id) || !newById.has(id) || oldState.get(id).status !== 'succeeded') throw new Error('Invalid completed-step invalidation: ' + id);
      if (oldById.get(id).effect !== 'read') throw new Error('Do not replay a completed side effect; create new authorized work.');
    }
    for (const before of task.steps.filter(item => item.status === 'succeeded'))
      if (newById.has(before.id) && !reuse.includes(before.id) && !invalidate.includes(before.id))
        throw new Error('Explicitly reuse or invalidate completed work: ' + before.id);
    return { type: 'plan', plan_revision: task.plan_revision + 1, previous_revision: task.plan_revision,
      steps: definitions, reuse_steps: reuse, invalidate_steps: invalidate, reused_artifacts: reusedArtifacts,
      removed_steps: task.plan_steps.filter(item => !newById.has(item.id)).map(item => item.id),
      reason: input.reason, basis: input.basis, sources };
  });
}

export function capture(input) {
  const located = request(input.request_id);
  return appendEvent(located, input, () => {
    const task = status(input.request_id), revision = input.plan_revision;
    const plan = task.plans.find(item => item.revision === revision);
    if (!plan?.steps.some(item => item.id === input.step)) throw new Error('Capture must identify a real step and plan revision.');
    if (!input.reason) throw new Error('Captured late evidence needs a reason.');
    if (input.attempt_id && !task.history.some(event => event.type === 'step' && event.status === 'running'
      && event.step === input.step && (event.plan_revision ?? 1) === revision && event.attempt_id === input.attempt_id))
      throw new Error('Unknown attempt identifier.');
    return { type: 'artifact-capture', plan_revision: revision, step: input.step, attempt_id: input.attempt_id ?? null,
      artifacts: sourceRefs(input.artifacts), reason: input.reason, advances_execution: false };
  });
}

export function waive(input) {
  const located = request(input.request_id);
  return appendEvent(located, input, () => {
    const task = status(input.request_id); checkRevision(input, task); ensureActive(task);
    const item = task.steps.find(step => step.id === input.step);
    if (!item?.waivable || ['succeeded', 'skipped', 'waived'].includes(item.status)) throw new Error('Step is not eligible for a waiver.');
    if (!input.reason || !['user_request', 'unavailable_tool', 'runtime_failure', 'not_applicable'].includes(input.basis))
      throw new Error('A waiver needs a reason, a supported basis, and sources.');
    return { type: 'waiver', plan_revision: task.plan_revision, step: input.step, reason: input.reason,
      basis: input.basis, sources: sourceRefs(input.sources) };
  });
}
