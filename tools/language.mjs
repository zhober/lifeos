// Resolve the interaction language independently of the English prompt language.
//   node tools/language.mjs show
//   node tools/language.mjs set <language-tag>     (for example en, zh-CN, ja, de)
// The interaction language resolves from the user's saved choice, then project.json "language", then en.
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ROOT, readIfExists } from './lib.mjs';
import { atomicWrite, checkedWrite, currentHash, keyId, vaultPath, withLock } from './store.mjs';

export const DEFAULT_LANGUAGE = 'en';

export function preferenceSettings() {
  const project = JSON.parse(readIfExists(path.join(ROOT, 'project.json')) ?? '{}');
  const relative = project.interaction?.preferences_file ?? 'profile/preferences.json';
  const file = path.resolve(ROOT, relative);
  if (!file.startsWith(ROOT + path.sep)) throw new Error('Preferences must stay inside the vault.');
  const saved = JSON.parse(readIfExists(file) ?? '{}');
  return { project, saved, file, relative };
}

// Preference writes are hash-checked, atomic, and retained like other personal-data writes.
// The hash-checked utility records a recoverable before/after snapshot; a preferences file
// pointed outside the personal-data directories falls back to a locked atomic write.
export function writePreferences(relative, text, expected, kind = 'language') {
  const file = vaultPath(relative);
  if (currentHash(file) !== expected) throw new Error('Preferences changed since they were read: ' + relative);
  const input = { operation_id: keyId(kind, relative + ':' + new Date().toISOString() + ':' + crypto.randomUUID()),
    path: relative, mode: 'replace', expected_hash: expected, content: text };
  try { return checkedWrite(input); } catch (error) {
    if (!/restricted to personal-data directories/.test(error.message)) throw error;
    return withLock(input.operation_id, () => {
      if (currentHash(file) !== expected) throw new Error('Preferences changed since they were read: ' + relative);
      atomicWrite(file, text);
      return { path: relative, recovered: false, snapshot: false };
    });
  }
}

function canonicalLanguage(value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Use a language tag such as en, zh-CN, ja or de.');
  const [language] = Intl.getCanonicalLocales(value);
  return language;
}

export function getLanguagePreference() {
  const { project, saved, relative } = preferenceSettings();
  return {
    prompt_language: project.prompt_language ?? 'en',
    interaction_language: canonicalLanguage(saved.interaction_language ?? project.language ?? DEFAULT_LANGUAGE),
    language_confirmed: saved.language_confirmed === true,
    preferences_file: relative,
  };
}

export function setInteractionLanguage(value) {
  const language = canonicalLanguage(value);
  const { project, saved, file, relative } = preferenceSettings();
  const previous = canonicalLanguage(saved.interaction_language ?? project.language ?? DEFAULT_LANGUAGE);
  if (saved.language_confirmed === true && previous === language) return getLanguagePreference();
  const timestamp = new Date().toISOString();
  const history = Array.isArray(saved.history) ? [...saved.history] : [];
  history.push({ at: timestamp, from: previous, to: language, action: saved.language_confirmed === true ? 'change' : 'confirm' });
  const next = { ...saved, interaction_language: language, language_confirmed: true,
    confirmed_at: saved.confirmed_at ?? timestamp, updated_at: timestamp, history };
  writePreferences(relative, JSON.stringify(next, null, 2) + '\n', currentHash(file));
  return getLanguagePreference();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command = 'show', language] = process.argv.slice(2);
  try {
    if (command !== 'show' && command !== 'set') throw new Error('Usage: node tools/language.mjs show | set <language-tag>');
    const result = command === 'set' ? setInteractionLanguage(language) : getLanguagePreference();
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
