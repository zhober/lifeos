// Sync-conflict detection: report duplicate files created by file-syncing or backup tools.
//
// Any tool that replicates the vault (a file-sync client, a backup agent, a cloud drive)
// may keep a second copy when two machines change one file. LifeOS holds one authoritative
// copy per file, so the duplicate is a divergence a human has to reconcile. This module
// only finds and maps them: it never merges, moves, renames or deletes anything.
//
// Detection is dormant by design. Nothing is reported unless such a file actually exists,
// so an ordinary vault sees no warnings and pays no visible cost. Cloud synchronisation is
// one optional environment a vault may live in, not an assumption of this system.
//
//   LIFEOS_CONFLICT_SCAN=off           skip detection entirely
//   LIFEOS_CONFLICT_PATTERNS=a,b       detect only the named patterns
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT } from './lib.mjs';

// Each pattern matches the suffix a client is known to append: either inside the file name
// before the extension, or after the whole name (Syncthing's variant). The list is neutral:
// it names the shapes a tool may produce, and nothing here is assumed to be present.
export const CONFLICT_PATTERNS = [
  { name: 'seafile', client: 'Seafile', suffix: 'stem', description: '" (SFConflict <user> <timestamp>)" before the extension',
    match: / \(SFConflict [^()]*?\)(?=\.[^./\\]*$|$)/ },
  { name: 'syncthing', client: 'Syncthing', suffix: 'name', description: '".sync-conflict-<timestamp>-<device>" after the whole file name',
    match: /\.sync-conflict-\d{8}-\d{6}-[A-Za-z0-9._-]+$/ },
  { name: 'dropbox', client: 'Dropbox', suffix: 'stem', description: '" (conflicted copy ...)" before the extension',
    match: / \(conflicted copy[^()]*\)(?=\.[^./\\]*$|$)/ },
  { name: 'nextcloud', client: 'Nextcloud/ownCloud', suffix: 'stem', description: '" (conflicted copy ...)" or "_conflict-<timestamp>" before the extension',
    match: / \(conflicted copy[^()]*\)|_conflict-\d{8}(?:-\d{6})?(?=\.[^./\\]*$|$)/ },
  { name: 'onedrive', client: 'OneDrive', suffix: 'host', description: '"<original>-<HOSTNAME>.<ext>" beside the original, matched only when the host name is this machine\'s short name',
    match: null },
];

export class ConflictScanDisabled extends Error {}

function selectedPatterns() {
  const setting = process.env.LIFEOS_CONFLICT_SCAN?.trim().toLowerCase();
  if (setting === 'off' || setting === 'false' || setting === '0' || setting === 'none') throw new ConflictScanDisabled('Conflict detection is disabled.');
  const only = process.env.LIFEOS_CONFLICT_PATTERNS?.trim();
  if (!only) return CONFLICT_PATTERNS;
  const names = only.toLowerCase().split(',').map(name => name.trim()).filter(Boolean);
  const unknown = names.filter(name => !CONFLICT_PATTERNS.some(pattern => pattern.name === name));
  if (unknown.length) throw new Error('Unknown conflict pattern(s): ' + unknown.join(', ') + '. Known: ' + CONFLICT_PATTERNS.map(p => p.name).join(', ') + '.');
  return CONFLICT_PATTERNS.filter(pattern => names.includes(pattern.name));
}

function splitSuffix(relative) {
  const base = path.basename(relative);
  const dot = base.lastIndexOf('.');
  return dot > 0 ? { head: base.slice(0, dot), tail: base.slice(dot) } : { head: base, tail: '' };
}

// The name a duplicate points back to. `stem` suffixes sit before the extension, `name`
// suffixes replace the whole trailing file name, and `host` suffixes carry this machine's
// name, which is only accepted when the remaining stem is non-empty and the original is
// present beside it (that keeps ordinary hyphenated names from being reported).
// The `<stem>-<HOSTNAME>` shape carries this machine's name at the very end of the stem, so
// each known host name is anchored against the tail rather than decomposed from the front.
function hostSuffixedBase(head) {
  const names = new Set([os.hostname(), os.hostname().split('.')[0]].filter(Boolean).map(name => name.toLowerCase()));
  const candidates = [...names].sort((a, b) => b.length - a.length);
  for (const name of candidates) {
    const suffix = '-' + name;
    if (head.toLowerCase().endsWith(suffix) && head.length > suffix.length) return head.slice(0, head.length - suffix.length);
  }
  return null;
}

export function conflictedOriginal(relative, patterns = selectedPatterns()) {
  const normalized = relative.replaceAll('\\', '/');
  const directory = path.dirname(normalized);
  const { head, tail } = splitSuffix(normalized);
  const name = path.basename(normalized);
  const join = part => directory === '.' ? part : path.posix.join(directory, part);
  for (const pattern of patterns) {
    if (pattern.suffix === 'host') {
      const stem = hostSuffixedBase(head);
      if (!stem) continue;
      const original = join(stem + tail);
      if (!fs.existsSync(path.resolve(ROOT, original))) continue;
      return { original, pattern: pattern.name, client: pattern.client, original_exists: true };
    }
    if (pattern.suffix === 'name') {
      const found = pattern.match.exec(name);
      if (!found || !found.index) continue;
      const original = join(name.slice(0, found.index));
      // A whole-name suffix is only a duplicate if the name it strips to is a real vault
      // path: the original beside it, or a dated journal the deployment expects to hold.
      if (!fs.existsSync(path.resolve(ROOT, original)) && !/^journal\/\d{4}\/\d{4}-\d{2}-\d{2}\.md$/.test(original)) continue;
      return { original, pattern: pattern.name, client: pattern.client, original_exists: fs.existsSync(path.resolve(ROOT, original)) };
    }
    const found = pattern.match.exec(head);
    if (!found) continue;
    const stem = head.slice(0, found.index) + head.slice(found.index + found[0].length);
    if (!stem) continue;
    return { original: join(stem + tail), pattern: pattern.name, client: pattern.client };
  }
  return null;
}

// Walks the vault once and returns every duplicate with the original it shadows.
// `relative` restricts the scan to one subtree, e.g. 'journal'.
export function conflictCandidates(relative = '.') {
  const start = path.resolve(ROOT, relative);
  if (!fs.existsSync(start) || !fs.statSync(start).isDirectory()) return [];
  const result = [];
  const visit = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) { visit(file); continue; }
      if (!entry.isFile()) continue;
      result.push(path.relative(ROOT, file).replaceAll('\\', '/'));
    }
  };
  visit(start);
  return result;
}

// `relative` restricts the scan; returns the duplicates grouped per original path.
export function scanConflicts(relative = '.') {
  let patterns;
  try { patterns = selectedPatterns(); } catch (error) {
    if (error instanceof ConflictScanDisabled) return { enabled: false, patterns: [], total: 0, originals: [] };
    throw error;
  }
  const found = new Map();
  for (const file of conflictCandidates(relative)) {
    const hit = conflictedOriginal(file, patterns);
    if (!hit) continue;
    if (!found.has(hit.original)) found.set(hit.original, []);
    found.get(hit.original).push({ path: file, pattern: hit.pattern, client: hit.client,
      original_exists: hit.original_exists ?? fs.existsSync(path.resolve(ROOT, hit.original)) });
  }
  const originals = [...found.entries()].map(([original, copies]) => ({ original, copies })).sort((a, b) => a.original.localeCompare(b.original));
  return { enabled: true, patterns: patterns.map(pattern => pattern.name),
    total: originals.reduce((total, item) => total + item.copies.length, 0), originals };
}

// Conflict copies whose original is a journal file, grouped as date -> copies. Used by
// statistics so a date written on another machine cannot vanish from a report unnoticed.
export function journalConflicts() {
  const { enabled, originals } = scanConflicts('journal');
  if (!enabled) return new Map();
  const byDate = new Map();
  for (const { original, copies } of originals) {
    const found = /^journal\/(\d{4})\/(\d{4}-\d{2}-\d{2})\.md$/.exec(original);
    if (!found) continue;
    byDate.set(found[2], (byDate.get(found[2]) ?? []).concat(copies));
  }
  return byDate;
}

export function conflictSummary() {
  const result = scanConflicts();
  if (!result.enabled) return 'Conflict detection: off';
  if (!result.total) return 'Conflict copies: none';
  return 'Conflict copies: ' + result.total + ' in ' + result.originals.length + ' file(s). Run "node tools/conflicts.mjs" to inspect; resolve manually, never by deleting blind.';
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  try {
    const result = scanConflicts(args.find(argument => !argument.startsWith('--')) ?? '.');
    if (args.includes('--json')) console.log(JSON.stringify(result, null, 2));
    else if (!result.enabled) console.log('Conflict detection is disabled by LIFEOS_CONFLICT_SCAN.');
    else if (!result.total) console.log('No sync-conflict copies found. Patterns checked: ' + result.patterns.join(', '));
    else {
      console.log(result.total + ' sync-conflict copy/copies in ' + result.originals.length + ' file(s):\n');
      for (const { original, copies } of result.originals) {
        console.log(original + (copies.some(copy => !copy.original_exists) ? '  (original missing)' : ''));
        for (const copy of copies) console.log('  ' + copy.client + ' -> ' + copy.path);
      }
      console.log('\nResolve manually: compare each copy with its original, keep the decided content in the original, then remove the copy.');
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
