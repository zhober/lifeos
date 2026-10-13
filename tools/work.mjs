// CLI facade: request control, immutable consultation archives, and action histories.
import fs from 'node:fs';
import { digest, stable, keyId, vaultPath, readJSON, inputJSON, immutable, walk, sourceRefs, dateOrNull } from './store.mjs';
import { locate, request, events, appendEvent, start, status, step, control, replan, capture, waive, terminalStates } from './work-state.mjs';
import { checkReview, reviewArchiveText } from './review-data.mjs';

function message(input) {
  const located = request(input.request_id);
  if (!['user', 'assistant'].includes(input.role) || typeof input.text !== 'string') throw new Error('Supply a user/assistant role and exact message text.');
  return appendEvent(located, input, () => ({ type: 'message', role: input.role, text: input.text }));
}

function archive(input) {
  const located = request(input.request_id), record = located.record;
  if (!input.operation_id || !/^[a-z0-9][a-z0-9-]*$/.test(input.expert ?? '') || typeof input.summary !== 'string' || !Array.isArray(input.responses))
    throw new Error('Supply request_id, expert, summary, and response artifacts.');
  const archiveId = keyId('archive', input.operation_id), snapshotFile = located.directory + 'archives/' + archiveId + '.json';
  const fingerprint = digest(stable(input)), previous = readJSON(snapshotFile);
  if (previous) {
    if (previous.input_hash !== fingerprint) throw new Error('Archive operation identifier reused with different content.');
    immutable(previous.path, previous.content);
    return { request_id: record.id, path: previous.path, missing_experts: previous.missing_experts,
      ...(previous.review_status ? { review_status: previous.review_status } : {}), replay: true };
  }
  const task = status(input.request_id), plannedExperts = [...new Set(task.plan_steps.filter(step => step.expert).map(step => step.expert))];
  if (input.provisional !== undefined && typeof input.provisional !== 'boolean') throw new Error('provisional must be a boolean.');
  if (input.audit_only !== undefined && typeof input.audit_only !== 'boolean') throw new Error('audit_only must be a boolean.');
  const gates = task.steps.filter(step => step.review_gate), provisional = input.provisional === true, auditOnly = input.audit_only === true;
  if (auditOnly && (input.expert !== 'critic' || gates.length || !input.review_packet || provisional))
    throw new Error('audit_only requires a critic audit packet, no release gate, and no provisional mode.');
  if (gates.length && !provisional && !input.review_packet) throw new Error('A final archive requires the declared review packet.');
  if (gates.length && !provisional && gates.some(step => step.status !== 'succeeded')) throw new Error('Declared review gates must succeed before final archival.');
  const review = input.review_packet ? checkReview(input.review_packet, { request_id: task.id,
    plan_revision: task.plan_revision, directory: located.directory, ...(provisional || auditOnly ? {} : { summary: input.summary }) }) : null;
  if (review?.gate === 'blocked' && !provisional && !auditOnly) throw new Error('Final review is blocked: ' + review.blocking.join('; '));
  if (review && !provisional && gates.some(gate => !gate.artifacts.some(ref => ref.path === input.review_packet
    && ref.sha256_at_capture === digest(fs.readFileSync(vaultPath(input.review_packet))))))
    throw new Error('The archive review packet differs from the successful gate artifact.');
  const reviewStatus = auditOnly ? 'audit_' + review.gate : provisional
    ? 'provisional_' + (review?.gate === 'blocked' ? 'blocked' : 'unapproved') : review?.gate ?? 'not_requested';
  const expected = input.expected_experts ?? (plannedExperts.length ? plannedExperts : input.responses.map(response => response.expert));
  const missing = input.missing_experts ?? [];
  if (!Array.isArray(expected) || !Array.isArray(missing)) throw new Error('Expert rosters must be arrays.');
  if (new Set(expected).size !== expected.length || new Set(missing).size !== missing.length || plannedExperts.some(expert => !expected.includes(expert)))
    throw new Error('The expected roster must disclose all experts in the current plan.');
  const responses = input.responses.map(response => ({ expert: response.expert, path: response.path,
    text: fs.readFileSync(vaultPath(sourceRefs([response.path])[0].path), 'utf8') }));
  if (new Set(responses.map(response => response.expert)).size !== responses.length) throw new Error('Duplicate expert response.');
  if (responses.some(response => !expected.includes(response.expert)) || missing.some(expert => !expected.includes(expert)))
    throw new Error('Response and missing-role identifiers must belong to the expected roster.');
  for (const name of expected)
    if (!responses.some(response => response.expert === name) && !missing.includes(name)) throw new Error('Missing expert response must be disclosed: ' + name);
  for (const name of missing) if (responses.some(response => response.expert === name)) throw new Error('An expert cannot be both present and missing.');
  const file = 'advice/' + record.date + '-' + input.expert + '-' + record.id + '-' + keyId('archive', input.operation_id) + '.md';
  const conversation = events(located.directory).filter(event => event.type === 'message');
  const header = ['---', 'date: ' + record.date, 'recorded_at: ' + JSON.stringify(record.recorded_at),
    'archived_at: ' + JSON.stringify(new Date().toISOString()), 'plan_revision: ' + task.plan_revision,
    'request_state_at_capture: ' + task.state, 'waived_steps: ' + JSON.stringify(task.waived_steps.map(item => item.step)),
    'review_status: ' + reviewStatus, 'provisional: ' + provisional,
    'request_id: ' + record.id, 'archive_id: ' + keyId('archive', input.operation_id), 'expert: ' + input.expert, 'question: ' + JSON.stringify(record.original_input),
    'experts: ' + JSON.stringify(expected), 'missing_experts: ' + JSON.stringify(missing), '---'].join('\n');
  let text = header + '\n\n# Consultation\n\n## Original request\n\n' + record.original_input;
  if (record.attachments?.length) text += '\n\n## Original attachments\n\n```json\n' + JSON.stringify(record.attachments, null, 2) + '\n```';
  for (const event of conversation) text += '\n\n## ' + event.role + ' at ' + event.recorded_at + '\n\n' + event.text;
  text += '\n\n## Final response\n\n' + input.summary;
  if (provisional) text += '\n\n## Provisional limitation\n\nThis archive is not an approved final plan.';
  if (auditOnly) text += '\n\n## Audit scope\n\nThis is a completed audit of a supplied proposal; completion does not approve that proposal.';
  if (review) text += reviewArchiveText(review);
  if (missing.length) text += '\n\n## Missing responses\n\n' + missing.join(', ');
  for (const response of responses) text += '\n\n## Original response: ' + response.expert + '\n\nSource: ' + response.path + '\n\n' + response.text;
  immutable(snapshotFile, { input_hash: fingerprint, path: file, missing_experts: missing, review_status: reviewStatus, content: text + '\n' });
  immutable(file, text + '\n');
  return { request_id: record.id, path: file, missing_experts: missing, review_status: reviewStatus, replay: false };
}

function createAction(input) {
  const task = request(input.request_id).record;
  if (!input.action_key || typeof input.text !== 'string' || !input.text.trim()) throw new Error('Supply request_id, action_key, text, owner, and sources.');
  const id = keyId('action', task.id + '/' + input.action_key), inputHash = digest(stable(input));
  const file = 'actions/' + task.date.slice(0, 4) + '/' + id + '/definition.json';
  const previous = readJSON(file);
  if (previous) {
    if (previous.input_hash !== inputHash) throw new Error('An action identifier cannot be reused for a different proposal.');
    return actionStatus(id);
  }
  const taskState = status(input.request_id);
  if (['paused', 'waiting', 'cancelled', 'superseded'].includes(taskState.state))
    throw new Error('Do not create new action proposals for a stopped request.');
  if (taskState.steps.some(step => step.review_gate && step.status !== 'succeeded'))
    throw new Error('Do not create action proposals before the declared review gate succeeds.');
  immutable(file, { schema_version: 1, id, input_hash: inputHash, request_id: task.id, text: input.text,
    owner: input.owner ?? 'user', due: dateOrNull(input.due), recorded_at: new Date().toISOString(), sources: sourceRefs(input.sources) });
  return actionStatus(id);
}

function actionStatus(id) {
  const located = locate(id, 'actions', 'definition.json'), history = events(located.directory);
  let due = located.record.due;
  for (const event of history) if (Object.hasOwn(event, 'due')) due = event.due;
  return { ...located.record, file: located.file, status: history.at(-1)?.status ?? 'proposed',
    due, history };
}

function updateAction(input) {
  const located = locate(input.action_id, 'actions', 'definition.json');
  return appendEvent(located, input, () => {
    if (!['accepted', 'in_progress', 'completed', 'deferred', 'declined', 'cancelled', 'unknown'].includes(input.status)) throw new Error('Invalid action status.');
    if (!['user_report', 'record_observation'].includes(input.basis)) throw new Error('Action status needs an explicit evidence basis.');
    return { type: 'action-status', status: input.status, basis: input.basis,
      ...(Object.hasOwn(input, 'due') ? { due: dateOrNull(input.due) } : {}),
      sources: sourceRefs(input.sources), note: input.note ?? null };
  });
}

const [command, argument] = process.argv.slice(2);
try {
  let result;
  if (command === 'start') result = start(inputJSON(argument));
  else if (command === 'step') result = step(inputJSON(argument));
  else if (command === 'control') result = control(inputJSON(argument));
  else if (command === 'replan') result = replan(inputJSON(argument));
  else if (command === 'capture') result = capture(inputJSON(argument));
  else if (command === 'waive') result = waive(inputJSON(argument));
  else if (command === 'message') result = message(inputJSON(argument));
  else if (command === 'status') result = status(argument);
  else if (command === 'archive') result = archive(inputJSON(argument));
  else if (command === 'action-create') result = createAction(inputJSON(argument));
  else if (command === 'action-update') result = updateAction(inputJSON(argument));
  else if (command === 'action-status') result = actionStatus(argument);
  else if (command === 'actions') result = walk('actions', '.json').filter(file => file.endsWith('/definition.json')).map(file => actionStatus(readJSON(file).id));
  else if (command === 'requests') result = walk('tasks', '.json').filter(file => file.endsWith('/request.json'))
    .map(file => status(readJSON(file).id)).filter(item => process.argv.includes('--all') || !terminalStates.has(item.state))
    .filter(item => !process.argv.includes('--ready') || item.can_dispatch)
    .map(item => ({ id: item.id, date: item.date, original_input: item.original_input, state: item.state,
      plan_revision: item.plan_revision, resume_steps: item.resume_steps, ready_steps: item.ready_steps,
      in_flight_steps: item.in_flight_steps, reason: item.last_control?.reason ?? (item.replacement_blocked ? 'awaiting parent supersession' : null) }));
  else throw new Error('Usage: node tools/work.mjs start|step|control|replan|capture|waive|message|archive|action-create|action-update <input.json> | status|action-status <id> | actions | requests [--all|--ready]');
  console.log(JSON.stringify(result, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
