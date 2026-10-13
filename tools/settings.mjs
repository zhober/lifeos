// User-level regional settings: timezone, region, currency and shopping discovery channels.
//   node tools/settings.mjs show
//   node tools/settings.mjs set timezone <IANA name | system>
//   node tools/settings.mjs set region <ISO 3166-1 alpha-2 | none>
//   node tools/settings.mjs set currency <ISO 4217 | none>
//   node tools/settings.mjs set marketplaces <id,id,... | none | default>
//   node tools/settings.mjs set experience_channels <id,id,... | none | default>
// The interaction language stays with tools/language.mjs. Values live in the user-owned preference
// file (project.json interaction.preferences_file) and are written through the same hash-checked
// writer, keeping language, privacy and history entries intact. Every setting is optional.
//
// Resolution order:
//   timezone  preference > project.json timezone > LIFEOS_TIMEZONE (declared host timezone) > system timezone
//   region    preference > unset (ask only when a domain needs it)
//   currency  preference > unset (ask only when a domain needs it)
//   shopping  preference lists > project.json shopping lists when nonempty > unset
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalTimezone, resolveTimezone, systemTimezone } from './lib.mjs';
import { currentHash } from './store.mjs';
import { getLanguagePreference, preferenceSettings, writePreferences } from './language.mjs';

const CHANNEL = /^[a-z][a-z0-9_-]*$/;
const SHOPPING_FIELDS = ['marketplaces', 'experience_channels'];
export const SETTINGS = ['timezone', 'region', 'currency', ...SHOPPING_FIELDS];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function canonicalRegion(value) {
  if (typeof value !== 'string' || !/^[A-Za-z]{2}$/.test(value.trim())) throw new Error('Use a two-letter ISO 3166-1 region code such as DE, US, JP or CN.');
  return value.trim().toUpperCase();
}

export function canonicalCurrency(value) {
  const code = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!/^[A-Z]{3}$/.test(code) || (typeof Intl.supportedValuesOf === 'function' && !Intl.supportedValuesOf('currency').includes(code)))
    throw new Error('Use a three-letter ISO 4217 currency code such as EUR, USD, JPY or CNY: ' + value);
  return code;
}

export function canonicalChannels(value, label = 'channels') {
  const list = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',').map(item => item.trim()).filter(Boolean) : null;
  if (!list || list.some(item => typeof item !== 'string' || !CHANNEL.test(item)) || new Set(list).size !== list.length)
    throw new Error(label + ' must be a unique list of lowercase channel identifiers such as amazon, ebay or jd.');
  return list;
}

// Format validation for check-layout; mirrors the setters without rewriting anything.
export function settingsErrors(preferences) {
  const errors = [];
  if (!object(preferences)) return errors;
  const attempt = (label, fn) => { try { fn(); } catch (error) { errors.push('preferences.' + label + ': ' + error.message); } };
  if (preferences.timezone != null) attempt('timezone', () => canonicalTimezone(preferences.timezone));
  if (preferences.region != null) attempt('region', () => canonicalRegion(preferences.region));
  if (preferences.currency != null) attempt('currency', () => canonicalCurrency(preferences.currency));
  if (preferences.shopping !== undefined) {
    if (!object(preferences.shopping)) errors.push('preferences.shopping must be an object when present.');
    else for (const field of SHOPPING_FIELDS) if (preferences.shopping[field] !== undefined)
      attempt('shopping.' + field, () => { if (!Array.isArray(preferences.shopping[field])) throw new Error('must be a list'); canonicalChannels(preferences.shopping[field], field); });
  }
  if (preferences.settings_history !== undefined && !Array.isArray(preferences.settings_history))
    errors.push('preferences.settings_history must be a list when present.');
  return errors;
}

export function shoppingChannels({ project, saved } = preferenceSettings()) {
  const result = {};
  for (const field of SHOPPING_FIELDS) {
    const personal = object(saved.shopping) ? saved.shopping[field] : undefined;
    const shared = project.shopping?.[field];
    result[field] = Array.isArray(personal) ? { value: personal, source: 'preference' }
      : Array.isArray(shared) && shared.length ? { value: shared, source: 'project' } : { value: [], source: 'unset' };
  }
  return result;
}

export function getSettings() {
  const context = preferenceSettings(), { saved, relative } = context;
  const zone = resolveTimezone(), language = getLanguagePreference();
  return {
    timezone: zone.timezone,
    timezone_source: zone.source,
    system_timezone: systemTimezone(),
    interaction_language: language.interaction_language,
    language_confirmed: language.language_confirmed,
    region: saved.region ?? null,
    currency: saved.currency ?? null,
    shopping: shoppingChannels(context),
    preferences_file: relative,
  };
}

// Saves one actual user choice. "system"/"none"/"default" clear a value instead of inventing one.
export function setSetting(name, raw) {
  if (!SETTINGS.includes(name)) throw new Error('Unknown setting. Use one of: ' + SETTINGS.join(', ') + '. Language: node tools/language.mjs set <tag>.');
  if (typeof raw !== 'string' || !raw.trim()) throw new Error('Supply a value for ' + name + '.');
  const value = raw.trim(), { saved, file, relative } = preferenceSettings();
  const next = structuredClone(saved);
  let from, to;
  if (name === 'timezone') {
    from = saved.timezone ?? null; to = value.toLowerCase() === 'system' ? null : canonicalTimezone(value);
    if (to === null) delete next.timezone; else next.timezone = to;
  } else if (name === 'region' || name === 'currency') {
    from = saved[name] ?? null; to = value.toLowerCase() === 'none' ? null : name === 'region' ? canonicalRegion(value) : canonicalCurrency(value);
    if (to === null) delete next[name]; else next[name] = to;
  } else {
    const shopping = object(saved.shopping) ? { ...saved.shopping } : {};
    from = shopping[name] ?? null;
    to = value.toLowerCase() === 'default' ? null : value.toLowerCase() === 'none' ? [] : canonicalChannels(value, name);
    if (to === null) delete shopping[name]; else shopping[name] = to;
    if (Object.keys(shopping).length) next.shopping = shopping; else delete next.shopping;
  }
  if (JSON.stringify(from) === JSON.stringify(to)) return getSettings();
  const at = new Date().toISOString();
  next.settings_history = [...(Array.isArray(saved.settings_history) ? saved.settings_history : []), { at, setting: name, from, to }];
  writePreferences(relative, JSON.stringify(next, null, 2) + '\n', currentHash(file), 'settings');
  return getSettings();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command = 'show', name, ...rest] = process.argv.slice(2);
  try {
    if (command !== 'show' && command !== 'set') throw new Error('Usage: node tools/settings.mjs show | set <' + SETTINGS.join('|') + '> <value>');
    console.log(JSON.stringify(command === 'set' ? setSetting(name, rest.join(' ')) : getSettings(), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
