// Portable read-only check for a caller-selected normalized itinerary.
import fs from 'node:fs';
import path from 'node:path';
import { digest } from './store.mjs';
import { today } from './lib.mjs';
import { checkTravelPlan } from './travel-plan.mjs';
const [command, argument, ...args] = process.argv.slice(2);
try {
  if (command !== 'check' || !argument || args.length && (args.length !== 2 || args[0] !== '--as-of')) throw new Error('Usage: node tools/travel.mjs check <permitted-plan-input.json> [--as-of YYYY-MM-DD]');
  const bytes = fs.readFileSync(path.resolve(argument));
  console.log(JSON.stringify({ ...checkTravelPlan(JSON.parse(bytes.toString('utf8')), args[1] ?? today()), input_sha256: digest(bytes) }, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
