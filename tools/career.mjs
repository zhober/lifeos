// Portable work/career record and report facade; no model, API or external action.
import { inputJSON } from './store.mjs';
import { ensure } from './record-data.mjs';
import { retainCareerOriginal, recordCareer, careerTimeline, careerRecords, careerRecordView } from './career-data.mjs';
import { careerProject, careerSummary } from './career-report.mjs';
const [command, argument, ...rest] = process.argv.slice(2), args = [argument, ...rest];
const option = name => { const i = args.indexOf('--' + name); return i < 0 ? undefined : args[i + 1]; };
try {
  let result;
  if (command === 'original') result = retainCareerOriginal(inputJSON(argument));
  else if (command === 'record') result = recordCareer(inputJSON(argument));
  else if (command === 'show') { const r = careerRecords().current.find(item => item.record_id === argument); ensure(r, 'Unknown career record.'); result = careerRecordView(r); }
  else if (command === 'timeline' || command === 'list') result = careerTimeline({ from: option('from'), to: option('to'), subject: option('subject'), kind: option('kind'), project_ref: option('project'), history: args.includes('--history') });
  else if (command === 'project') result = careerProject(argument, option('as-of'));
  else if (command === 'summary') result = careerSummary({ from: option('from'), to: option('to'), days: option('days') == null ? undefined : Number(option('days')), subject: option('subject'), project_ref: option('project') });
  else throw new Error('Usage: career.mjs original|record <input.json> | show ID | timeline [--subject ID --kind KIND --from DATE --to DATE --history] | project ID_OR_PATH [--as-of DATE] | summary [--subject ID --project PATH --from DATE --to DATE]');
  console.log(JSON.stringify(result, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
