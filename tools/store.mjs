// Shared file storage: immutable records, optimistic writes, and recovery snapshots.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT, readIfExists } from './lib.mjs';

export const digest = value => crypto.createHash('sha256').update(value).digest('hex');
export const stable = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
export const keyId = (prefix, key) => prefix + '-' + digest(String(key)).slice(0, 24);

export function vaultPath(relative) {
  if (typeof relative !== 'string' || path.isAbsolute(relative)) throw new Error('Use a vault-relative path.');
  const file = path.resolve(ROOT, relative);
  const inside = path.relative(ROOT, file);
  if (!inside || inside.startsWith('..' + path.sep) || inside === '..') throw new Error('Path must stay inside the vault.');
  let existing = file;
  while (!fs.existsSync(existing)) existing = path.dirname(existing);
  const actual = path.relative(fs.realpathSync(ROOT), fs.realpathSync(existing));
  if (actual === '..' || actual.startsWith('..' + path.sep) || path.isAbsolute(actual)) throw new Error('External symbolic links are not allowed.');
  return file;
}

export const readJSON = relative => {
  const text = readIfExists(vaultPath(relative));
  return text === null ? null : JSON.parse(text);
};
export const inputJSON = file => JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
export const currentHash = file => fs.existsSync(file) ? digest(fs.readFileSync(file)) : null;

// File identity is separate from semantic withLock keys. Dot segments, in-vault links,
// and conservative Windows case folding must share both write locks and path policy.
function fileTarget(relative) {
  const resolved = vaultPath(relative);
  let existing = resolved;
  while (!fs.existsSync(existing)) existing = path.dirname(existing);
  const file = path.join(fs.realpathSync(existing), path.relative(existing, resolved));
  const actual = path.relative(fs.realpathSync(ROOT), file).replaceAll('\\', '/');
  return { file, key: process.platform === 'win32' ? actual.toLowerCase() : actual };
}

function withFileLock(relative, target, operation) {
  return withLock(target.key, () => {
    if (fileTarget(relative).key !== target.key) throw new Error('File target changed before the write lock was acquired: ' + relative);
    return operation();
  });
}

export function walk(relative, extension) {
  const start = vaultPath(relative), result = [];
  if (!fs.existsSync(start)) return result;
  const visit = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (!extension || file.endsWith(extension)) result.push(path.relative(ROOT, file).replaceAll('\\', '/'));
    }
  };
  if (fs.statSync(start).isDirectory()) visit(start); else result.push(relative);
  return result.sort();
}

// Write locks: one machine-local directory per vault, outside the vault itself.
//
// A lock only has to serialise writers on this host, and state written into the vault is
// visible to file-syncing or backup tools, which can replicate a lock to another machine
// or resurrect one that was already released. The lock root therefore lives next to the
// operating system's temporary files and is keyed by the vault's real path, so two
// checkouts on one machine never share a lock. LIFEOS_LOCK_DIR overrides the location.
export const LOCK_DIR_ENV = 'LIFEOS_LOCK_DIR';
export const LEGACY_LOCK_DIR = '.lifeos/locks';
// A lock is reaped only when the owner process is provably gone on this host, or when its
// recorded host no longer matches and it is far older than any single write takes.
export const STALE_LOCK_AGE_MS = 24 * 60 * 60 * 1000;

export function lockRoot() {
  const override = process.env[LOCK_DIR_ENV];
  if (override) {
    if (!override.trim()) throw new Error(LOCK_DIR_ENV + ' must name a directory.');
    return path.resolve(override);
  }
  const base = process.platform === 'win32'
    ? (process.env.LOCALAPPDATA?.trim() || os.tmpdir())
    : (process.env.XDG_RUNTIME_DIR?.trim() || os.tmpdir());
  return path.join(base, 'lifeos-locks', digest(path.resolve(ROOT)).slice(0, 24));
}

function lockOwner(directory) {
  const text = readIfExists(path.join(directory, 'owner.json'));
  if (text === null) return null;
  try { return JSON.parse(text); } catch { return null; }
}

function processAvailable() {
  try { process.kill(process.pid, 0); return true; } catch { return false; }
}

function processAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return null;
  try { process.kill(pid, 0); return true; } catch (error) {
    if (error.code === 'ESRCH') return false;
    return processAvailable() ? null : false;
  }
}

// Lock directories are named after the digest of a key, so a directory name is not the key
// itself. Inspect the owner record directly and report the recorded key.
//
// Staleness is provable only when the owner is this host and its process is gone, when the
// owner recorded another host and the lock is older than the age limit, or when the owner
// record is unreadable and the lock is that old. A running process on this host always
// keeps its lock: age alone never overrides a live writer. Age is measured from the owner
// record, falling back to the directory's own timestamp so an interrupted write still ages
// out instead of blocking the file forever.
export function lockStatus(directory, now = Date.now()) {
  const owner = lockOwner(directory);
  const { pid, host, key, created_at: createdAt } = owner ?? {};
  let timestamp = createdAt ? Date.parse(createdAt) : NaN;
  if (!Number.isFinite(timestamp)) {
    try { timestamp = fs.statSync(directory).mtimeMs; } catch { timestamp = NaN; }
  }
  const ageMs = Number.isFinite(timestamp) ? Math.max(0, now - timestamp) : null;
  const ageHours = ageMs === null ? null : Math.round(ageMs / 36000) / 100;
  const ageExceeded = ageMs !== null && ageMs > STALE_LOCK_AGE_MS;
  const alive = processAlive(pid);
  const sameHost = owner ? host === os.hostname() : null;
  const aged = 'older than ' + Math.round(STALE_LOCK_AGE_MS / 3600000) + ' hours';
  const reason = !owner ? (ageExceeded ? 'the owner record is missing or unreadable and the lock is ' + aged : null)
    : sameHost === false ? (ageExceeded ? 'recorded on ' + host + ', a different host, and ' + aged : null)
    : alive === false ? 'process ' + pid + ' is not running on this host'
    : alive === null ? (ageExceeded ? 'owning process cannot be observed from this host and the lock is ' + aged : null)
    : null;
  return { key: key ?? '(unknown key) #' + path.basename(directory), path: directory, owner, created_at: createdAt ?? null, age_ms: ageMs, age_hours: ageHours,
    pid: pid ?? null, host: host ?? null, same_host: sameHost, process_alive: alive,
    age_exceeded: ageExceeded, stale: reason !== null, reason };
}

// An owner record that cannot be read leaves only the directory name, which is a key
// digest rather than the original key, so an unknown lock is labelled as such.
export function lockDirectories() {
  const root = lockRoot();
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root).map(name => path.join(root, name)).filter(entry => fs.existsSync(entry));
}

function removeLock(directory) {
  const owner = path.join(directory, 'owner.json');
  if (fs.existsSync(owner)) fs.unlinkSync(owner);
  // Unknown leftovers mean the directory is not provably ours to delete.
  if (fs.readdirSync(directory).length) return false;
  fs.rmdirSync(directory);
  return true;
}

export function clearStaleLock(directory, status = lockStatus(directory)) {
  if (!status.stale) return { ...status, cleared: false };
  if (!fs.existsSync(directory)) return { ...status, cleared: false, reason: 'lock released before it was cleared' };
  if (!removeLock(directory)) return { ...status, cleared: false, reason: 'lock holds unexpected files; inspect it before removing' };
  return { ...status, cleared: true };
}

export function clearStaleLocks(now = Date.now()) {
  const root = lockRoot(), cleared = [];
  if (!fs.existsSync(root)) return { root, cleared };
  for (const directory of lockDirectories()) {
    const status = lockStatus(directory, now);
    if (clearStaleLock(directory, status).cleared) cleared.push({ key: status.key, path: status.path, reason: status.reason });
  }
  return { root, cleared };
}

// Reports the retired in-vault lock directory. Removal is opt-in and only deletes entries
// that cannot be active here: the owner recorded this host and its process is gone, or the
// recorded host differs and the entry is older than the stale age. A live local lock is
// never touched. The retired directory is reported, not deleted automatically.
export function legacyLocks({ remove = false, now = Date.now() } = {}) {
  let directory = null;
  try { directory = vaultPath(LEGACY_LOCK_DIR); } catch { return { path: null, present: false, stale: [], live: [], removed: [] }; }
  const result = { path: LEGACY_LOCK_DIR, present: fs.existsSync(directory), stale: [], live: [], removed: [] };
  if (!result.present) return result;
  for (const name of fs.readdirSync(directory)) {
    const entry = path.join(directory, name);
    if (!fs.statSync(entry).isDirectory()) continue;
    const owner = lockOwner(entry);
    const host = owner?.host ?? null;
    const alive = processAlive(owner?.pid);
    // Age comes from the owner record, as in lockStatus; the directory timestamp is only a
    // fallback, because writing owner.json refreshes it on every acquisition.
    let timestamp = owner?.created_at ? Date.parse(owner.created_at) : NaN;
    if (!Number.isFinite(timestamp)) timestamp = fs.statSync(entry).mtimeMs;
    const ageMs = Math.max(0, now - timestamp);
    const item = { entry: LEGACY_LOCK_DIR + '/' + name, owner, age_hours: Math.round(ageMs / 36000) / 100,
      stale: host === os.hostname() ? alive === false : host !== null ? ageMs > STALE_LOCK_AGE_MS : false };
    (item.stale ? result.stale : result.live).push(item);
    if (remove && item.stale) { fs.rmSync(entry, { recursive: true, force: true }); result.removed.push(item.entry); }
  }
  if (remove && !fs.readdirSync(directory).length) fs.rmdirSync(directory);
  return result;
}

export function withLock(key, operation) {
  const root = lockRoot();
  fs.mkdirSync(root, { recursive: true });
  const directory = path.join(root, digest(key));
  try { fs.mkdirSync(directory); } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const status = lockStatus(directory);
    if (!status.stale) throw new Error('Write is locked by ' + (status.host ?? 'an unknown host') + ' pid ' + (status.pid ?? '?')
      + ' since ' + (status.created_at ?? 'an unknown time') + '. Retry later, or inspect and clear provably stale locks with "node tools/files.mjs locks --clear-stale".');
    clearStaleLock(directory, status);
    try { fs.mkdirSync(directory); } catch (retry) {
      if (retry.code !== 'EEXIST') throw retry;
      throw new Error('Write is locked: ' + (status.reason ?? 'a competing writer') + '. Retry later, or run "node tools/files.mjs locks --clear-stale".');
    }
  }
  const owner = path.join(directory, 'owner.json');
  try {
    fs.writeFileSync(owner, JSON.stringify({ pid: process.pid, host: os.hostname(), created_at: new Date().toISOString(), key }));
    return operation();
  } finally {
    if (fs.existsSync(owner)) fs.unlinkSync(owner);
    if (fs.existsSync(directory) && !fs.readdirSync(directory).length) fs.rmdirSync(directory);
  }
}

export function atomicWrite(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = file + '.' + crypto.randomUUID() + '.tmp';
  try {
    const fd = fs.openSync(temporary, 'wx');
    try { fs.writeFileSync(fd, text); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.renameSync(temporary, file);
  } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}

export function immutable(relative, value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n';
  const target = fileTarget(relative);
  return withFileLock(relative, target, () => {
    const file = target.file, previous = readIfExists(file);
    if (previous !== null) {
      if (previous !== text) throw new Error('Immutable record already exists with different content: ' + relative);
      return { path: relative, existing: true };
    }
    atomicWrite(file, text);
    return { path: relative, existing: false };
  });
}

export function immutableBlob(relative, bytes) {
  if (!Buffer.isBuffer(bytes)) throw new Error('Binary originals must be supplied as a Buffer.');
  const target = fileTarget(relative);
  return withFileLock(relative, target, () => {
    const file = target.file;
    if (fs.existsSync(file)) {
      if (!fs.readFileSync(file).equals(bytes)) throw new Error('Original binary already exists with different bytes: ' + relative);
      return { path: relative, sha256: digest(bytes), existing: true };
    }
    atomicWrite(file, bytes);
    return { path: relative, sha256: digest(bytes), existing: false };
  });
}

function rawSection(text) {
  const heading = '## \u539f\u59cb\u8bb0\u5f55';
  const start = text.indexOf(heading);
  if (start < 0) return null;
  const next = text.indexOf('\n## ', start + heading.length);
  return text.slice(start, next < 0 ? undefined : next).trimEnd();
}

export function checkedWrite(input) {
  const { operation_id, path: relative, mode = 'replace', expected_hash, content } = input;
  if (!operation_id || typeof content !== 'string' || !['replace', 'append'].includes(mode)) throw new Error('Supply operation_id, path, mode, expected_hash, and content.');
  if (!Object.hasOwn(input, 'expected_hash')) throw new Error('expected_hash is required; use null only for an absent file.');
  const target = fileTarget(relative), actual = target.key;
  if (!/^(profile|journal|records|inbox|advice|memory|tasks|actions)\//.test(actual)) throw new Error('Checked writes are restricted to personal-data directories.');
  if (/^(memory\/entries|tasks\/.*\/events|actions\/.*\/events)\//.test(actual)) throw new Error('Use the immutable record utility for event records.');
  if (/^tasks\/.*\/request\.json$|^actions\/.*\/definition\.json$/.test(actual)) throw new Error('Original request and action definitions are immutable.');
  if (/^(records\/nutrition\/(meals|days|totals)\/|inbox\/meal-photos\/)/.test(actual))
    throw new Error('Nutrition observations and original photos are immutable; create a sourced revision through tools/nutrition.mjs.');
  if (/^(records\/health\/entries\/|records\/cases\/|inbox\/health\/)/.test(actual))
    throw new Error('Health originals, record versions, and case events are immutable; use the health/cases utilities for sourced revisions.');
  if (/^(records\/fitness\/(sessions|plans|plan-events|recovery|assessments)\/|inbox\/fitness\/)/.test(actual))
    throw new Error('Fitness observations, plans, state events and originals are immutable; use tools/fitness.mjs.');
  if (/^(records\/career\/entries\/|inbox\/career\/)/.test(actual))
    throw new Error('Career designs, work/evidence/process versions and originals are immutable; use tools/career.mjs.');
  if (/^(records\/shopping\/entries\/|inbox\/shopping\/)/.test(actual))
    throw new Error('Shopping product/offer/quality/ownership/watch versions and originals are immutable; use tools/shopping.mjs.');
  if (/^(records\/finance\/entries\/|inbox\/finance\/)/.test(actual))
    throw new Error('Financial originals, worksheets and exposure metadata are immutable; use tools/finance.mjs.');
  const file = target.file, operation = 'history/operations/' + keyId('write', operation_id);
  const fingerprint = digest(stable(input));
  return withFileLock(relative, target, () => {
    let prepared = readJSON(operation + '/request.json');
    const completed = readJSON(operation + '/completed.json');
    if (prepared && prepared.input_hash !== fingerprint) throw new Error('An operation identifier cannot be reused for different content.');
    if (completed) return { ...completed, replay: true };
    if (prepared && currentHash(file) === prepared.after_hash) {
      const recovered = { path: relative, operation_id, sha256: prepared.after_hash, recovered: true };
      immutable(operation + '/completed.json', recovered);
      return recovered;
    }
    if (currentHash(file) !== expected_hash) throw new Error('File changed since it was read: ' + relative);
    const before = readIfExists(file) ?? '';
    const after = mode === 'append' ? before + content : content;
    if ((actual.startsWith('advice/') || actual === 'memory/insights.md') && before && mode !== 'append')
      throw new Error('This archive is append-only.');
    if (actual.startsWith('journal/')) {
      const raw = rawSection(before);
      if (raw && !rawSection(after)?.startsWith(raw)) throw new Error('Original journal statements must remain unchanged.');
    }
    if (!prepared) {
      immutable(operation + '/before.txt', before);
      immutable(operation + '/after.txt', after);
      prepared = { path: relative, operation_id, input_hash: fingerprint, before_hash: expected_hash,
        after_hash: digest(after), recorded_at: new Date().toISOString() };
      immutable(operation + '/request.json', prepared);
    }
    if (currentHash(file) !== expected_hash) throw new Error('Concurrent edit detected before commit: ' + relative);
    atomicWrite(file, after);
    const result = { path: relative, operation_id, sha256: digest(after), recovered: false };
    immutable(operation + '/completed.json', result);
    return result;
  });
}

export function sourceRefs(sources) {
  if (!Array.isArray(sources) || !sources.length) throw new Error('At least one durable source reference is required.');
  return sources.map(source => {
    const item = typeof source === 'string' ? { path: source } : source;
    const file = vaultPath(item.path);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error('Missing source: ' + item.path);
    if (item.quote && !fs.readFileSync(file, 'utf8').includes(item.quote)) throw new Error('Source quotation was not found: ' + item.path);
    return { ...item, sha256_at_capture: currentHash(file) };
  });
}

export function dateOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) !== value)
    throw new Error('Use a valid YYYY-MM-DD date or null.');
  return value;
}
