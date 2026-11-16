// Scratch housekeeping. Throwaway inputs, outputs and one-off scripts belong in the scratch directory
// (project.json scratch.directory, normally .lifeos/tmp/), never in the vault root where they sync with the vault.
// Without --apply this only reports. With --apply it moves stray root files into the scratch directory (their
// age restarts there, so nothing moved is deleted at once) and deletes scratch files older than scratch.max_age_days.
// Sync-conflict copies are left for tools/conflicts.mjs; only regular files directly in the root are considered.
// node tools/tidy.mjs [--apply]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './lib.mjs';
import { readJSON } from './store.mjs';
import { scanConflicts } from './conflicts.mjs';

const OS_FILES = new Set(['desktop.ini', 'thumbs.db']);

export function scratchSettings() {
  const scratch = readJSON('project.json')?.scratch ?? {};
  return { directory: scratch.directory ?? '.lifeos/tmp', max_age_days: scratch.max_age_days ?? 7 };
}

// Root files a vault is expected to hold: root entry points, the manifests and repository housekeeping files.
function expectedRootFiles() {
  const project = readJSON('project.json') ?? {};
  return new Set([...Object.values(project.entrypoints ?? {}).filter(item => !item.includes('/')), 'project.json', 'LICENSE']
    .map(name => name.toLowerCase()));
}

export function strayRootFiles() {
  const expected = expectedRootFiles();
  const candidates = fs.readdirSync(ROOT, { withFileTypes: true })
    .filter(entry => entry.isFile() && !entry.name.startsWith('.') && !expected.has(entry.name.toLowerCase()) && !OS_FILES.has(entry.name.toLowerCase()))
    .map(entry => entry.name);
  if (!candidates.length) return [];
  const copies = new Set(scanConflicts().originals.flatMap(item => item.copies.map(copy => copy.path)));
  return candidates.filter(name => !copies.has(name)).sort();
}

function scratchFiles(directory) {
  const absolute = path.join(ROOT, directory);
  if (!fs.existsSync(absolute)) return [];
  return fs.readdirSync(absolute, { withFileTypes: true, recursive: true }).filter(entry => entry.isFile())
    .map(entry => path.join(entry.parentPath ?? entry.path, entry.name));
}

export function expiredScratch(now = Date.now()) {
  const { directory, max_age_days } = scratchSettings(), limit = max_age_days * 24 * 60 * 60 * 1000;
  return scratchFiles(directory).filter(file => now - fs.statSync(file).mtimeMs > limit)
    .map(file => path.relative(ROOT, file).split(path.sep).join('/')).sort();
}

function freeName(directory, name) {
  const extension = path.extname(name), stem = name.slice(0, name.length - extension.length);
  for (let index = 0; ; index++) {
    const candidate = path.join(directory, index ? stem + '-' + index + extension : name);
    if (!fs.existsSync(candidate)) return candidate;
  }
}

export function tidy({ apply = false, now = Date.now() } = {}) {
  const { directory, max_age_days } = scratchSettings();
  const stray = strayRootFiles(), expired = expiredScratch(now), moved = [];
  if (apply) {
    for (const relative of expired) fs.unlinkSync(path.join(ROOT, relative));
    const target = path.join(ROOT, directory);
    for (const dir of fs.existsSync(target) ? fs.readdirSync(target, { withFileTypes: true, recursive: true }).filter(entry => entry.isDirectory())
      .map(entry => path.join(entry.parentPath ?? entry.path, entry.name)).sort((a, b) => b.length - a.length) : [])
      if (!fs.readdirSync(dir).length) fs.rmdirSync(dir);
    fs.mkdirSync(target, { recursive: true });
    for (const name of stray) {
      const destination = freeName(target, name);
      fs.renameSync(path.join(ROOT, name), destination);
      const at = new Date(now); fs.utimesSync(destination, at, at);
      moved.push({ from: name, to: path.relative(ROOT, destination).split(path.sep).join('/') });
    }
  }
  return { scratch_directory: directory, max_age_days, applied: apply, stray_root_files: stray, expired_scratch_files: expired,
    ...(apply ? { moved, deleted: expired } : {}) };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try { console.log(JSON.stringify(tidy({ apply: process.argv.includes('--apply') }), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
