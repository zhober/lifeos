// Runtime-independent startup context: current date and journal status.
import fs from 'node:fs';
import { today, addDays, journalPath, resolveTimezone } from './lib.mjs';
import { getLanguagePreference } from './language.mjs';
import { checkLayout } from './check-layout.mjs';

const layout = checkLayout();
if (!layout.ok) { console.error('LifeOS layout check failed:\n' + layout.errors.join('\n')); process.exit(1); }
// Startup prints counts and commands only, never file names or personal content. A vault
// without sync/backup duplicates or retired locks prints nothing extra here.
const conflictCopies = (layout.warnings ?? []).filter(warning => warning.includes(' conflict copy '));
if (conflictCopies.length) console.log('[LifeOS] Warning: ' + conflictCopies.length + ' sync-conflict copy/copies of personal files found. Run node tools/conflicts.mjs to inspect; resolve manually before relying on affected records.');
for (const warning of (layout.warnings ?? []).filter(warning => !conflictCopies.includes(warning))) console.log('[LifeOS] Warning: ' + warning);

const zone = resolveTimezone(), t = today(zone.timezone), y = addDays(t, -1);
const brief = d => {
  const f = journalPath(d);
  return fs.existsSync(f) ? 'journal exists' : 'no journal';
};
const language = getLanguagePreference();
console.log('[LifeOS] Follow the intent routing in AGENTS.md; open other documents only when that route needs them. Do not recreate root vendor configuration trees.');
console.log(`[LifeOS] Today=${t}; timezone=${zone.timezone} (${zone.source}); prompt_language=${language.prompt_language}; interaction_language=${language.interaction_language}; language_confirmed=${language.language_confirmed}. Today: ${brief(t)}. Yesterday (${y}): ${brief(y)}.`);
console.log('[LifeOS] Personal information is voluntary. To continue unfinished work, run node tools/work.mjs requests --ready; paused, waiting, and closed requests must not silently restart.');
