// Read-only disclosure preference validation/projection; no personal-record retrieval or writes.
// node tools/privacy.mjs show [scope ...] [--field <identifier>]
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readJSON } from './store.mjs';

const identifier = /^[a-z][a-z0-9_-]*$/;
const modes = ['general', 'ranges', 'detailed'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function privacyErrors(preferences) {
  const errors = [], privacy = preferences?.privacy;
  if (privacy === undefined) return errors;
  if (!object(privacy)) return ['preferences.privacy must be an object when present.'];
  for (const [scope, policy] of Object.entries(privacy)) {
    const label = 'preferences.privacy.' + scope;
    if (!identifier.test(scope)) { errors.push('Privacy scopes must be lowercase identifiers.'); continue; }
    if (!object(policy)) { errors.push(label + ' must be an object when present.'); continue; }
    if (policy.mode !== undefined && policy.mode !== null && !modes.includes(policy.mode))
      errors.push(label + '.mode must be null, general, ranges or detailed.');
    if (policy.withheld_fields !== undefined && (!Array.isArray(policy.withheld_fields)
      || policy.withheld_fields.some(field => typeof field !== 'string' || !identifier.test(field))
      || new Set(policy.withheld_fields).size !== policy.withheld_fields.length))
      errors.push(label + '.withheld_fields must be a unique list of lowercase field identifiers.');
  }
  return errors;
}

export function disclosurePolicy(scopes = [], field = null) {
  if (!Array.isArray(scopes) || scopes.some(scope => typeof scope !== 'string' || !identifier.test(scope) || scope === 'defaults'))
    throw new Error('Use subject scope identifiers; defaults is the shared fallback, not a subject.');
  if (field !== null && (typeof field !== 'string' || !identifier.test(field))) throw new Error('Field must be a lowercase identifier.');
  const project = readJSON('project.json');
  const preferenceFile = project.interaction.preferences_file;
  const preferences = readJSON(preferenceFile), errors = privacyErrors(preferences);
  if (errors.length) throw new Error(errors.join('\n'));
  const privacy = preferences?.privacy ?? {}, defaults = privacy.defaults ?? {};
  const selected = [...new Set(scopes)].sort();
  const policies = selected.map(scope => privacy[scope] ?? {});
  const choices = selected.length ? policies.map(policy => policy.mode ?? defaults.mode).filter(mode => mode != null)
    : defaults.mode == null ? [] : [defaults.mode];
  const mode = choices.length ? modes.find(candidate => choices.includes(candidate)) : null;
  const withheld = [...new Set([...(defaults.withheld_fields ?? []), ...policies.flatMap(policy => policy.withheld_fields ?? [])])].sort();
  return {
    preference_file: preferenceFile,
    scopes: selected,
    mode,
    withheld_fields: withheld,
    all_personal_inputs_optional: true,
    ...(field === null ? {} : { field, field_withheld: withheld.includes('all') || withheld.includes(field), may_request_field: mode !== 'general' && !withheld.includes('all') && !withheld.includes(field) }),
  };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    const [command, ...args] = process.argv.slice(2);
    if (command !== 'show') throw new Error('Usage: node tools/privacy.mjs show [scope ...] [--field <identifier>]');
    const scopes = []; let field = null;
    for (let index = 0; index < args.length; index++) {
      if (args[index] === '--field') {
        if (field !== null || !args[index + 1] || args[index + 1].startsWith('--')) throw new Error('Supply exactly one --field value.');
        field = args[++index];
      } else if (args[index].startsWith('--')) throw new Error('Unknown privacy option.');
      else scopes.push(args[index]);
    }
    console.log(JSON.stringify(disclosurePolicy(scopes, field), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
