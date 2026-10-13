// JSON input avoids runtime-specific shell interpolation and preserves exact content.
//   node tools/files.mjs read <relative-path>
//   node tools/files.mjs write <input.json>
//   node tools/files.mjs locks [--clear-stale] [--json]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { vaultPath, digest, inputJSON, checkedWrite, lockRoot, lockDirectories, lockStatus, clearStaleLocks, legacyLocks, STALE_LOCK_AGE_MS } from './store.mjs';

// Local lock state only; an empty lock directory reports an empty list, and no command here
// ever removes a lock whose owner is still running on this host.
function locks(args) {
  const clear = args.includes('--clear-stale');
  const before = lockDirectories().map(directory => lockStatus(directory));
  const result = clear ? clearStaleLocks() : { root: lockRoot(), cleared: [] };
  const clearedKeys = new Set(result.cleared.map(item => item.key));
  const pending = before.filter(entry => entry.stale && !clearedKeys.has(entry.key));
  const held = before.filter(entry => !entry.stale);
  const legacy = legacyLocks({ remove: clear });
  return {
    lock_directory: result.root,
    machine: os.hostname(),
    stale_age_hours: Math.round(STALE_LOCK_AGE_MS / 3600000),
    action: clear ? 'clear-stale' : 'inspect',
    held: held.map(item => ({ key: item.key, pid: item.pid, host: item.host, created_at: item.created_at, age_hours: item.age_hours })),
    stale: pending.map(item => ({ key: item.key, reason: item.reason, pid: item.pid, host: item.host, created_at: item.created_at, age_hours: item.age_hours })),
    cleared: before.filter(entry => clearedKeys.has(entry.key)).map(item => ({ key: item.key, reason: item.reason })),
    legacy: { path: legacy.path, present: legacy.present,
      stale: legacy.stale.map(item => ({ entry: item.entry, age_hours: item.age_hours })),
      live: legacy.live.map(item => ({ entry: item.entry, age_hours: item.age_hours })), removed: legacy.removed },
  };
}

function printLocks(result) {
  console.log('Lock directory: ' + result.lock_directory + '  (machine ' + result.machine + ', reaped after ' + result.stale_age_hours + 'h)');
  if (!result.held.length && !result.stale.length) console.log('No locks held.');
  for (const item of result.held)
    console.log('HELD  ' + item.key + '  pid ' + item.pid + ' on ' + item.host + ' since ' + item.created_at + ' (' + item.age_hours + 'h)');
  for (const item of result.stale)
    console.log('STALE ' + item.key + '  pid ' + (item.pid ?? '?') + ' on ' + (item.host ?? '?') + ' (' + item.age_hours + 'h): ' + item.reason);
  for (const item of result.cleared) console.log('CLEARED ' + item.key + ': ' + item.reason);
  if (result.action === 'clear-stale' && !result.cleared.length && !result.stale.length) console.log('Nothing was provably stale; no lock was cleared.');
  if (result.action !== 'clear-stale' && result.stale.length)
    console.log('Re-run with --clear-stale to remove these, or inspect the owner first. A live lock is never cleared.');
  if (result.legacy.present)
    console.log('Legacy in-vault ' + result.legacy.path + ': ' + result.legacy.live.length + ' live, ' + result.legacy.stale.length + ' stale'
      + (result.legacy.removed.length ? ', removed ' + result.legacy.removed.join(', ') : '') + '. Locks no longer live inside the vault; remove the retired directory after review.');
}

const [command, ...rest] = process.argv.slice(2);
try {
  if (command === 'read') {
    const file = vaultPath(rest[0]);
    let bytes;
    try { bytes = fs.readFileSync(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    console.log(JSON.stringify({ path: rest[0], sha256: bytes == null ? null : digest(bytes), content: bytes == null ? null : bytes.toString('utf8') }, null, 2));
  } else if (command === 'write') console.log(JSON.stringify(checkedWrite(inputJSON(rest[0])), null, 2));
  else if (command === 'locks') {
    const result = locks(rest);
    if (rest.includes('--json')) console.log(JSON.stringify(result, null, 2)); else printLocks(result);
  }
  else throw new Error('Usage: node tools/files.mjs read <relative-path> | write <input.json> | locks [--clear-stale] [--json]');
} catch (error) { console.error(error.message); process.exitCode = 1; }
