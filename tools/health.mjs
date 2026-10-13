// Portable local health capture and retrieval facade.
import { inputJSON } from './store.mjs';
import { ensure } from './record-data.mjs';
import { retainHealthOriginal, recordHealth, healthTimeline, healthRecords, healthView, compareMeasurements } from './health-data.mjs';
const [command, argument, ...rest] = process.argv.slice(2), args = [argument, ...rest];
const option = name => { const index = args.indexOf('--' + name); return index < 0 ? undefined : args[index + 1]; };
try {
  let result;
  if (command === 'original') result = retainHealthOriginal(inputJSON(argument));
  else if (command === 'record') result = recordHealth(inputJSON(argument));
  else if (command === 'timeline' || command === 'list') result = healthTimeline({ from: option('from'), to: option('to'), subject: option('subject'),
    case_id: option('case'), history: args.includes('--history') });
  else if (command === 'show') { const found = healthRecords().current.find(record => record.record_id === argument); ensure(found, 'Unknown health record.'); result = healthView(found); }
  else if (command === 'compare') result = compareMeasurements(argument, rest[0]);
  else throw new Error('Usage: node tools/health.mjs original|record <input.json> | timeline [--case ID --subject ID --from DATE --to DATE --history] | show ID | compare ID ID');
  console.log(JSON.stringify(result, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
