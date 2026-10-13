// Generic cases are ordinary files; the runtime remains responsible for actual execution.
import { inputJSON } from './store.mjs';
import { createCase, caseEvent, showCase, caseQueue, caseDefinitions } from './case-data.mjs';
const [command, argument, ...rest] = process.argv.slice(2);
const atIndex = rest.indexOf('--at'), at = atIndex >= 0 ? rest[atIndex + 1] : undefined;
try {
  const result = command === 'create' ? createCase(inputJSON(argument))
    : ['evidence', 'question', 'response', 'claim', 'followup', 'state', 'bind', 'participants'].includes(command) ? caseEvent(command, inputJSON(argument))
    : command === 'show' ? showCase(argument, at) : command === 'list' ? caseDefinitions()
    : command === 'queue' ? caseQueue(argument === '--at' ? rest[0] : at) : undefined;
  if (result === undefined) throw new Error('Usage: node tools/cases.mjs create|evidence|question|response|claim|followup|state|bind|participants <input.json> | show ID [--at DATE] | list | queue [--at DATE]');
  console.log(JSON.stringify(result, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
