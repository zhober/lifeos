// Portable finance CLI; all mutations are local record retention, never account actions.
import fs from 'node:fs';
import path from 'node:path';
import { inputJSON, vaultPath } from './store.mjs';
import { ROOT } from './lib.mjs';
import { decimalMoney } from './finance-calc.mjs';
import { retainFinanceOriginal, recordFinance, financeRecord, listFinance, calculateFinance } from './finance-data.mjs';

const [command, argument, ...args] = process.argv.slice(2);
try {
  let result;
  if (command === 'amount') result = decimalMoney(inputJSON(argument));
  else if (command === 'original') result = retainFinanceOriginal(inputJSON(argument));
  else if (command === 'record') result = recordFinance(inputJSON(argument));
  else if (command === 'show') result = financeRecord(argument);
  else if (command === 'calculate') {
    const existingInput = argument && fs.existsSync(path.resolve(argument));
    // A canonical worksheet path must go through metadata/privacy checks before reading its body.
    let relative = argument ? path.relative(ROOT, path.resolve(argument)).replaceAll('\\', '/') : null;
    if (existingInput) relative = path.relative(fs.realpathSync(ROOT), fs.realpathSync(path.resolve(argument))).replaceAll('\\', '/');
    if (/^records\/finance\//i.test(relative ?? '')) { vaultPath(relative); result = calculateFinance(relative); }
    else if (existingInput) result = calculateFinance(inputJSON(argument));
    else result = calculateFinance(argument);
  } else if (command === 'list') {
    const all = [argument, ...args].filter(Boolean);
    const option = flag => { const index = all.indexOf(flag); return index < 0 ? undefined : all[index + 1]; };
    result = listFinance({ history: all.includes('--history'), kind: option('--kind'), subject: option('--subject') });
  } else throw new Error('Usage: finance.mjs amount|original|record <input.json> | show|calculate <record-id-or-version> | calculate <new-input.json> | list [--history] [--kind KIND] [--subject SUBJECT]');
  console.log(JSON.stringify(result, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
