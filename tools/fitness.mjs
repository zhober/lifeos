// Model-neutral capture, descriptive summaries and training-plan comparison.
import { inputJSON } from './store.mjs';
import { ensure } from './record-data.mjs';
import { fitnessRecords, fitnessRecordView, recordFitness, retainFitnessOriginal, setPlanState, planStateFor, planEvents } from './fitness-data.mjs';
import { fitnessTimeline, fitnessSummary, comparePlan, compareFitnessAssessments } from './fitness-report.mjs';
const [command, argument, ...rest] = process.argv.slice(2), args = [argument, ...rest];
const option = name => { const index = args.indexOf('--' + name); return index < 0 ? undefined : args[index + 1]; };
try {
  let result;
  if (command === 'original') result = retainFitnessOriginal(inputJSON(argument));
  else if (['session', 'plan', 'recovery', 'assessment'].includes(command)) result = recordFitness(({ session: 'sessions', plan: 'plans', recovery: 'recovery', assessment: 'assessments' })[command], inputJSON(argument));
  else if (command === 'plan-state') result = setPlanState(inputJSON(argument));
  else if (command === 'timeline') result = fitnessTimeline({ subject: option('subject'), case_id: option('case'), from: option('from'), to: option('to'), history: args.includes('--history') });
  else if (command === 'summary') result = fitnessSummary({ subject: option('subject'), from: option('from'), to: option('to'), days: option('days') === undefined ? undefined : Number(option('days')) });
  else if (command === 'compare-plan') result = comparePlan(argument);
  else if (command === 'compare') result = compareFitnessAssessments(argument, rest[0]);
  else if (command === 'show') {
    const kind = option('kind') ?? 'sessions', idField = ({ sessions: 'session_id', plans: 'plan_id', recovery: 'recovery_id', assessments: 'assessment_id' })[kind];
    const record = fitnessRecords(kind).current.find(record => record[idField] === argument); ensure(record, 'Unknown fitness record.');
    result = { ...fitnessRecordView(record), ...(kind === 'plans' ? { plan_state: planStateFor(record.file), plan_events: planEvents(record.plan_id) } : {}) };
  } else throw new Error('Usage: node tools/fitness.mjs original|session|plan|recovery|assessment|plan-state <input.json> | timeline [--history --subject ID --case ID --from DATE --to DATE] | summary [--days N --from DATE --to DATE --subject ID] | compare-plan PATH | compare ID ID | show ID [--kind sessions|plans|recovery|assessments]');
  console.log(JSON.stringify(result, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
