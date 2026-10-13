// Read-only validation of shared entry points and the neutral project layout.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, canonicalTimezone } from './lib.mjs';
import { readJSON, vaultPath, legacyLocks } from './store.mjs';
import { privacyErrors } from './privacy.mjs';
import { settingsErrors } from './settings.mjs';
import { scanConflicts } from './conflicts.mjs';

// A sync/backup duplicate is an error when it shadows a system file, because the tool and
// instruction set would be ambiguous. In personal data it is a warning: reading and
// statistics must keep working, and only a human can decide which version to keep.
const SYSTEM_PREFIXES = ['AGENTS.md', 'README.md', 'README.zh-CN.md', 'project.json', 'tools/', 'templates/', 'config/',
  'agents/', 'experts/', 'docs/', 'workflows/', 'agents-disabled/', 'data/', 'evolve/'];

export function conflictFindings(scan = scanConflicts()) {
  const errors = [], warnings = [];
  for (const { original, copies } of scan.originals) {
    const system = SYSTEM_PREFIXES.some(prefix => original === prefix || original.startsWith(prefix));
    for (const copy of copies) {
      const detail = `${copy.client} conflict copy ${copy.path} shadows ${original}`
        + (copy.original_exists ? '' : ' (the original is missing)');
      (system ? errors : warnings).push(system
        ? `${detail}. Reconcile the system file and remove the copy; run "node tools/conflicts.mjs" for the full list.`
        : `${detail}. Reading continues from the original; resolve manually with "node tools/conflicts.mjs".`);
    }
  }
  return { errors, warnings };
}

export function checkLayout() {
  const errors = [];
  const warnings = [];
  const inspect = (relative, kind, label, optional = false) => {
    try {
      const file = vaultPath(relative);
      if (!fs.existsSync(file)) {
        if (!optional) errors.push(`${label}: missing ${relative}`);
      } else if (kind === 'file' ? !fs.statSync(file).isFile() : !fs.statSync(file).isDirectory()) {
        errors.push(`${label}: expected a ${kind} at ${relative}`);
      }
      return file;
    } catch (error) { errors.push(`${label}: ${error.message}`); return null; }
  };
  try {
    const project = readJSON('project.json');
    if (!project || project.schema_version !== 1) throw new Error('Missing or unsupported project manifest.');
    for (const key of ['agent', 'human', 'architecture', 'rules', 'orchestrator', 'control', 'memory', 'portability', 'configuration', 'bootstrap', 'review', 'nutrition', 'health', 'collaboration', 'research', 'fitness', 'study', 'career', 'shopping', 'psych', 'finance', 'travel', 'reporting'])
      if (!project.entrypoints?.[key]) errors.push(`Missing entrypoints.${key}.`);
    for (const [key, relative] of Object.entries(project.entrypoints ?? {}))
      inspect(relative, 'file', `entrypoints.${key}`);
    if (project.research?.default_mode !== 'lightweight' || project.research?.require_deep_reason !== true)
      errors.push('research.default_mode must be lightweight and research.require_deep_reason must be true; choose explicit depth per request.');
    if (!Number.isInteger(project.review?.max_final_rounds) || project.review.max_final_rounds < 1 || project.review.max_final_rounds > 10)
      errors.push('review.max_final_rounds must be an integer from 1 to 10.');
    if (!Number.isInteger(project.health?.original_max_bytes) || project.health.original_max_bytes <= 0)
      errors.push('health.original_max_bytes must be a positive integer.');
    if (!Number.isInteger(project.fitness?.original_max_bytes) || project.fitness.original_max_bytes <= 0)
      errors.push('fitness.original_max_bytes must be a positive integer.');
    if (!Number.isInteger(project.career?.original_max_bytes) || project.career.original_max_bytes <= 0)
      errors.push('career.original_max_bytes must be a positive integer.');
    if (!Number.isInteger(project.finance?.original_max_bytes) || project.finance.original_max_bytes <= 0 || project.finance?.mode !== 'analysis_and_advice_only')
      errors.push('finance.original_max_bytes must be positive and finance.mode must be analysis_and_advice_only.');
    if (project.travel?.mode !== 'research_and_advice_only' || project.travel?.login_handled_by !== 'user')
      errors.push('travel.mode must be research_and_advice_only and travel.login_handled_by must be user.');
    if (project.reporting?.default_style !== 'data_actions' || project.reporting?.trigger !== 'after_sleep_analysis' || project.reporting?.sleep_date_basis !== 'wake_date'
      || project.reporting?.archive_directory !== 'reports/daily' || project.reporting?.pdf_runtime_manifest !== 'config/runtimes/pdf/package.json')
      errors.push('reporting needs data_actions, after_sleep_analysis, wake_date and the canonical archive/runtime-manifest paths.');
    if (!Array.isArray(project.reporting?.domains) || !project.reporting.domains.length || project.reporting.domains.some(domain => typeof domain !== 'string' || !/^[a-z][a-z0-9_-]*$/.test(domain))
      || new Set(project.reporting.domains).size !== project.reporting.domains.length) errors.push('reporting.domains must be a nonempty unique identifier list.');
    if (project.reporting?.cover_card_limit != null && (!Number.isInteger(project.reporting.cover_card_limit) || project.reporting.cover_card_limit < 1 || project.reporting.cover_card_limit > 4))
      errors.push('reporting.cover_card_limit must be an integer between 1 and 4.');
    if (project.reporting?.cover_domain_priority != null && (!Array.isArray(project.reporting.cover_domain_priority) || !project.reporting.cover_domain_priority.length
      || new Set(project.reporting.cover_domain_priority).size !== project.reporting.cover_domain_priority.length
      || project.reporting.cover_domain_priority.some(domain => !project.reporting.domains?.includes(domain)))) errors.push('reporting.cover_domain_priority must list unique configured domains.');
    const pdfManifestPath = inspect(project.reporting?.pdf_runtime_manifest, 'file', 'reporting.pdf_runtime_manifest');
    if (pdfManifestPath && fs.existsSync(pdfManifestPath)) {
      const pdfManifest = JSON.parse(fs.readFileSync(pdfManifestPath, 'utf8'));
      if (pdfManifest.dependencies?.pdfkit !== '0.20.2') errors.push('Optional PDF runtime must declare the pinned pdfkit version.');
    }
    if (!Number.isInteger(project.shopping?.original_max_bytes) || project.shopping.original_max_bytes <= 0)
      errors.push('shopping.original_max_bytes must be a positive integer.');
    if (project.shopping?.mode !== 'research_and_advice_only' || project.shopping?.login_handled_by !== 'user')
      errors.push('shopping.mode must be research_and_advice_only and shopping.login_handled_by must be user.');
    // Shared channel lists are optional and normally empty: a user's channels are personal preferences.
    for (const field of ['marketplaces', 'experience_channels']) {
      const value = project.shopping?.[field];
      if (value !== undefined && (!Array.isArray(value) || value.some(x => typeof x !== 'string' || !/^[a-z][a-z0-9_-]*$/.test(x)) || new Set(value).size !== value.length))
        errors.push('shopping.' + field + ' must be a unique list of lowercase channel identifiers (it may be empty).');
    }
    if (project.timezone != null) try { canonicalTimezone(project.timezone); } catch (error) { errors.push('timezone must be null (system timezone) or an IANA name. ' + error.message); }
    if (project.language != null) try { Intl.getCanonicalLocales(project.language); } catch { errors.push('language must be a BCP 47 language tag such as en.'); }
    if (!Number.isInteger(project.collaboration?.max_question_rounds) || project.collaboration.max_question_rounds < 1 || project.collaboration.max_question_rounds > 10)
      errors.push('collaboration.max_question_rounds must be an integer from 1 to 10.');
    if (!Number.isInteger(project.nutrition?.photo_max_bytes) || project.nutrition.photo_max_bytes <= 0
      || !Number.isInteger(project.nutrition?.review_days) || project.nutrition.review_days <= 0)
      errors.push('nutrition.photo_max_bytes and nutrition.review_days must be positive integers.');
    for (const field of ['age_years', 'height_cm', 'weight_kg']) {
      const bounds = project.nutrition?.input_sanity_bounds?.[field];
      if (!Array.isArray(bounds) || bounds.length !== 2 || !bounds.every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0)
        || bounds[0] >= bounds[1]) errors.push('nutrition.input_sanity_bounds.' + field + ' must contain increasing nonnegative bounds.');
    }
    for (const key of ['agents_directory', 'workflows_directory'])
      inspect(project.definitions?.[key], 'directory', `definitions.${key}`);
    inspect(project.definitions?.disabled_agents_directory, 'directory', 'definitions.disabled_agents_directory', true);
    const aliases = project.definitions?.role_aliases;
    if (aliases !== undefined) {
      if (!aliases || typeof aliases !== 'object' || Array.isArray(aliases)) {
        errors.push('definitions.role_aliases must be an object of historical names to canonical active roles.');
      } else {
        const identifier = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
        for (const [alias, canonical] of Object.entries(aliases)) {
          if (!identifier.test(alias) || typeof canonical !== 'string' || !identifier.test(canonical)
            || alias === canonical || Object.hasOwn(aliases, canonical)) {
            errors.push(`Invalid role alias ${alias}: use distinct safe identifiers and a direct canonical target.`);
            continue;
          }
          const canonicalFile = inspect(path.join(project.definitions.agents_directory, canonical + '.md'), 'file', `role alias ${alias} target`);
          if (canonicalFile && fs.existsSync(canonicalFile) && fs.statSync(canonicalFile).isFile()) {
            const text = fs.readFileSync(canonicalFile, 'utf8');
            if (!new RegExp('^name: *' + canonical + ' *\\r?$', 'm').test(text))
              errors.push(`Role alias ${alias} target must declare name: ${canonical}.`);
          }
          inspect(path.join(project.definitions.disabled_agents_directory, alias + '.md'), 'file', `retired role ${alias} archive`);
          const active = vaultPath(path.join(project.definitions.agents_directory, alias + '.md'));
          if (fs.existsSync(active)) errors.push(`Historical role alias ${alias} must not remain an active definition.`);
        }
      }
    }
    inspect(project.definitions?.expert_common_rules, 'file', 'definitions.expert_common_rules');
    inspect(project.interaction?.preferences_file, 'file', 'interaction.preferences_file');
    const preferences = readJSON(project.interaction.preferences_file);
    errors.push(...privacyErrors(preferences), ...settingsErrors(preferences));

    const forbidden = project.configuration?.forbidden_root_entries;
    if (!Array.isArray(forbidden) || !forbidden.includes('.claude') || !forbidden.includes('CLAUDE.md'))
      errors.push('configuration.forbidden_root_entries must include .claude and CLAUDE.md.');
    for (const name of Array.isArray(forbidden) ? forbidden : []) {
      if (typeof name !== 'string' || !name || name === '.' || name === '..' || /[\\/:]/.test(name)) {
        errors.push('Forbidden root entries must be simple filenames or directory names.'); continue;
      }
      // Include dangling symlinks, which existsSync alone would miss.
      if (fs.readdirSync(ROOT).some(entry => entry.toLowerCase() === name.toLowerCase()))
        errors.push(`Forbidden project-root entry: ${name}. Reconcile its contents under the shared configuration policy.`);
    }
    const runtimeDirectory = inspect(project.configuration?.runtimes_directory, 'directory', 'configuration.runtimes_directory');
    if (runtimeDirectory && fs.existsSync(runtimeDirectory) && fs.statSync(runtimeDirectory).isDirectory()) {
      for (const name of fs.readdirSync(runtimeDirectory).filter(name => name.endsWith('.json'))) {
        try {
          const file = vaultPath(path.relative(ROOT, path.join(runtimeDirectory, name)));
          JSON.parse(fs.readFileSync(file, 'utf8'));
        } catch (error) { errors.push(`Runtime adapter ${name}: ${error.message}`); }
      }
    }
    const workflowDirectory = project.definitions?.workflows_directory;
    const workflowFile = project.definitions?.workflow_filename;
    if (typeof workflowFile !== 'string' || !workflowFile || /[\\/:]/.test(workflowFile) || ['.', '..'].includes(workflowFile))
      errors.push('definitions.workflow_filename must be a simple filename.');
    else if (typeof workflowDirectory === 'string') {
      const directory = vaultPath(workflowDirectory);
      if (fs.existsSync(directory) && fs.statSync(directory).isDirectory())
        for (const entry of fs.readdirSync(directory, { withFileTypes: true }).filter(entry => entry.isDirectory()))
          inspect(path.join(workflowDirectory, entry.name, workflowFile), 'file', `workflow ${entry.name}`);
    }
  } catch (error) { errors.push(error.message); }
  const legacy = legacyLocks();
  if (legacy.present) warnings.push(`Retired in-vault lock directory ${legacy.path} holds ${legacy.live.length} live and ${legacy.stale.length} stale entry/entries. `
    + 'Write locks now live outside the vault; run "node tools/files.mjs locks --clear-stale" to report or remove provably stale entries.');
  const conflicts = conflictFindings();
  errors.push(...conflicts.errors);
  warnings.push(...conflicts.warnings);
  return { ok: errors.length === 0, errors, ...(warnings.length ? { warnings } : {}) };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const result = checkLayout();
  if (process.argv.includes('--json')) console.log(JSON.stringify(result, null, 2));
  else console.log([result.ok ? 'LifeOS layout check passed.' : result.errors.join('\n'), ...(result.warnings ?? [])].join('\n'));
  process.exitCode = result.ok ? 0 : 1;
}
