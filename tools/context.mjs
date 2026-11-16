// Runtime-independent startup context: current date and journal status.
import fs from 'node:fs';
import { today, addDays, journalPath, resolveTimezone } from './lib.mjs';
import { getLanguagePreference } from './language.mjs';
import { checkLayout } from './check-layout.mjs';
import { readJSON, walk } from './store.mjs';
import { visibleWorkingNotes } from './working.mjs';
import { dueItems } from './due.mjs';
import { strayRootFiles, expiredScratch } from './tidy.mjs';

const layout = checkLayout();
if (!layout.ok) { console.error('LifeOS layout check failed:\n' + layout.errors.join('\n')); process.exit(1); }
// Startup prints counts and commands only, never record file names or personal content. Two exceptions are
// meant to be read at every start: the user's working notes (bounded, user-curated, filtered by the privacy
// preferences) and the system paths that have a local adjustment. A vault
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

const notes = visibleWorkingNotes();
if (notes.length) console.log('[LifeOS] Working notes (the user\'s standing preferences; follow them in every task, change them with node tools/working.mjs):\n'
  + notes.map(note => '- ' + note.id + (note.scope ? ' [' + note.scope + ']' : '') + ' ' + note.text).join('\n'));
const localDirectory = readJSON('project.json').adjustments?.local_directory ?? 'local';
const adjusted = walk(localDirectory, '').map(file => file.slice(localDirectory.length + 1)).filter(file => file !== 'README.md').sort();
if (adjusted.length) console.log('[LifeOS] Local adjustments exist for: ' + adjusted.join(', ') + '. After reading one of these files, also read ' + localDirectory + '/<same path>; it wins where they differ, except over the AGENTS.md safety floor.');
const due = dueItems({ date: t });
if (due.overdue.length + due.due_today.length) console.log('[LifeOS] ' + (due.overdue.length + due.due_today.length) + ' accepted action(s) due today or overdue; run node tools/due.mjs and mention them when relevant.');
const stray = strayRootFiles().length, expired = expiredScratch().length;
if (stray || expired) console.log('[LifeOS] ' + stray + ' stray file(s) in the vault root and ' + expired + ' expired scratch file(s); run node tools/tidy.mjs --apply. Put scratch files in .lifeos/tmp/.');
