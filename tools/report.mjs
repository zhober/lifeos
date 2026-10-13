// Model-neutral reporting CLI. All outputs are derived files; no model calls or clock tasks.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, normDate } from './lib.mjs';
import { inputJSON, checkedWrite, digest, stable, vaultPath } from './store.mjs';
import { collectDailyReport } from './report-collect.mjs';
import { afterSleepInput, reportedContent, hasReportedContent } from './report-sleep.mjs';
import { generateDailyReport, verifyDailyReport, readDailyReport } from './report-files.mjs';
const [command, argument, ...args] = process.argv.slice(2);
const option = name => { const index = args.indexOf('--' + name); return index < 0 ? undefined : args[index + 1]; };
const options = { runtime: option('runtime'), font: option('font'), font_family: option('font-family'), pdf: !args.includes('--no-pdf') };
try {
  let result;
  if (command === 'collect') {
    const input = await collectDailyReport(normDate(argument));
    if (option('out')) {
      const relative = option('out'); vaultPath(relative);
      result = checkedWrite({ operation_id: 'report-input/' + digest(stable(input)), path: relative, expected_hash: null, content: JSON.stringify(input, null, 2) + '\n' });
    } else result = input;
  } else if (command === 'generate') {
    const file = path.resolve(argument);
    const actual = path.relative(fs.realpathSync(ROOT), fs.realpathSync(file)).replaceAll('\\', '/');
    if (/^reports\//i.test(actual)) throw new Error('Recollect or use show/verify for a stored report; its body must not bypass disclosure checks.');
    result = await generateDailyReport(inputJSON(argument), options);
  } else if (command === 'after-sleep') {
    const prepared = await afterSleepInput(inputJSON(argument));
    // A date with no permitted content beyond the triggering sleep is not published: the archive
    // would only restate the morning's own record against a daytime date with nothing in it.
    // Decide before generating, so a skipped date leaves no archive behind at all.
    const counts = prepared.ready ? reportedContent(prepared.input) : null;
    if (!prepared.ready) result = prepared;
    else if (!hasReportedContent(counts)) result = { ready: true, status: 'skipped', reason: 'no_permitted_content_beyond_sleep',
      wake_date: prepared.wake_date, report_date: prepared.report_date, content: counts, archived: false, trace: 'none',
      note: 'Only the linked morning sleep was available for this date; no report archive was written. Manual reporting can still be requested.' };
    else {
      const report = await generateDailyReport(prepared.input, { ...options, trigger: 'after_sleep_analysis' });
      result = { ready: true, status: report.status, wake_date: prepared.wake_date, ...report,
        pdf_setup: report.pdf_unavailable ? 'node tools/report-setup.mjs <external-runtime-directory>' : null };
    }
  } else if (command === 'verify') result = verifyDailyReport(argument);
  else if (command === 'show') result = readDailyReport(argument, { historical: args.includes('--historical') });
  else throw new Error('Usage: report.mjs collect DATE [--out RELATIVE] | generate INPUT | after-sleep EVENT [--runtime DIR] [--font FILE] [--font-family NAME] [--no-pdf] | verify SELECTOR | show SELECTOR [--historical]');
  console.log(JSON.stringify(result, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
