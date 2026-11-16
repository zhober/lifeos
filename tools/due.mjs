// Due items: accepted or in-progress actions whose due date has passed, falls today or within --days N,
// and requests that are ready to continue. Proposed, deferred and closed actions are not reminders.
// node tools/due.mjs [--days N] [--quiet]   --quiet prints nothing when nothing is due (for scheduled checks).
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { today, addDays } from './lib.mjs';
import { readJSON, walk } from './store.mjs';
import { actionStatus, status, terminalStates } from './work-state.mjs';

const OPEN = new Set(['accepted', 'in_progress']);

export function dueItems({ days = 0, date = today() } = {}) {
  if (!Number.isInteger(days) || days < 0 || days > 60) throw new Error('--days must be an integer from 0 to 60.');
  const horizon = addDays(date, days), overdue = [], due_today = [], upcoming = [];
  for (const file of walk('actions', '.json').filter(item => item.endsWith('/definition.json'))) {
    const action = actionStatus(readJSON(file).id);
    if (!OPEN.has(action.status) || !action.due || action.due > horizon) continue;
    const item = { id: action.id, text: action.text, owner: action.owner, status: action.status, due: action.due, request_id: action.request_id };
    (action.due < date ? overdue : action.due === date ? due_today : upcoming).push(item);
  }
  const byDue = (a, b) => a.due.localeCompare(b.due) || a.id.localeCompare(b.id);
  const ready_requests = walk('tasks', '.json').filter(file => file.endsWith('/request.json')).map(file => status(readJSON(file).id))
    .filter(item => !terminalStates.has(item.state) && item.can_dispatch).map(item => ({ id: item.id, date: item.date, state: item.state, original_input: item.original_input }));
  return { date, horizon, overdue: overdue.sort(byDue), due_today: due_today.sort(byDue), upcoming: upcoming.sort(byDue), ready_requests,
    total: overdue.length + due_today.length + upcoming.length + ready_requests.length };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    const args = process.argv.slice(2), at = args.indexOf('--days');
    const result = dueItems({ days: at < 0 ? 0 : Number(args[at + 1]) });
    if (!(args.includes('--quiet') && result.total === 0)) console.log(JSON.stringify(result, null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
