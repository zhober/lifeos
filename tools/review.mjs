// Read-only CLI for an evidence-bound critic packet.
import { readJSON } from './store.mjs';
import { request, status } from './work-state.mjs';
import { checkReview } from './review-data.mjs';

try {
  const [command, relative] = process.argv.slice(2);
  if (command !== 'check' || !relative) throw new Error('Usage: node tools/review.mjs check <vault-relative-packet.json>');
  const packet = readJSON(relative), located = request(packet?.request_id), task = status(packet.request_id);
  const { gate, blocking, notes, final_rounds, max_final_rounds } = checkReview(relative, {
    request_id: task.id, plan_revision: task.plan_revision, directory: located.directory });
  console.log(JSON.stringify({ request_id: task.id, plan_revision: task.plan_revision, gate, blocking, notes, final_rounds, max_final_rounds }, null, 2));
  process.exitCode = gate === 'blocked' ? 2 : 0;
} catch (error) { console.error(error.message); process.exitCode = 1; }
