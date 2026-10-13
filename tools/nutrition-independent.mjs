// Independent daily claims are never summed with component-derived meal totals.
import { normDate } from './lib.mjs';
import { dateOrNull, digest, stable, keyId, readJSON, immutable, sourceRefs, walk, withLock } from './store.mjs';
import { NUTRIENTS, interval } from './nutrients.mjs';

const ensure = (value, message) => { if (!value) throw new Error(message); };
export function latestIndependent() {
  const selected = new Map(), seen = new Set();
  for (const file of walk('records/nutrition/totals', '.json')) {
    const record = readJSON(file);
    ensure(record?.schema_version === 1 && record.date && Number.isInteger(record.version), 'Invalid independent total: ' + file);
    const key = record.date + '/' + record.version;
    ensure(!seen.has(key), 'Conflicting independent total versions: ' + record.date); seen.add(key);
    if (!selected.has(record.date) || selected.get(record.date).version < record.version) selected.set(record.date, { ...record, file });
  }
  return [...selected.values()];
}

export function recordIndependent(input) {
  ensure(typeof input.operation_id === 'string' && input.operation_id.trim(), 'Independent total needs a stable operation_id.');
  const date = dateOrNull(normDate(input.date)), fingerprint = digest(stable(input));
  return withLock('nutrition-independent', () => {
    const versionId = keyId('total', input.operation_id);
    const existing = walk('records/nutrition/totals', '.json').find(file => file.endsWith('/' + versionId + '.json'));
    const current = latestIndependent().find(record => record.date === date);
    if (existing) {
      const saved = readJSON(existing);
      ensure(saved.input_hash === fingerprint, 'Independent operation ID reused with different input.');
      return { path: existing, version: saved.version, replay: true, superseded: current?.file !== existing,
        current_path: current?.file ?? existing };
    }
    ensure(!current || input.supersedes === current.file, 'Independent changes must supersede the exact latest daily total.');
    ensure(current || !input.supersedes, 'Cannot supersede an unknown independent total.');
    ensure(typeof input.complete === 'boolean' && typeof input.reason === 'string' && input.reason.trim(),
      'Independent total needs explicit complete and a sourced reason for its scope.');
    ensure(['active', 'retracted'].includes(input.state ?? 'active'), 'Independent state must be active or retracted.');
    ensure(input.nutrients && typeof input.nutrients === 'object' && !Array.isArray(input.nutrients), 'Supply independent nutrients with explicit units.');
    const ranges = Object.fromEntries(Object.entries(input.nutrients).map(([key, item]) => {
      ensure(Object.hasOwn(NUTRIENTS, key), 'Unsupported independent nutrient: ' + key);
      ensure(item && item.unit === NUTRIENTS[key].unit, 'Independent nutrient requires canonical unit: ' + key);
      return [key, interval(item.value, key)];
    }));
    ensure(input.state === 'retracted' || Object.values(ranges).some(Boolean), 'An active independent total needs at least one numeric nutrient.');
    const file = 'records/nutrition/totals/' + date.slice(0, 4) + '/' + date + '/versions/' + versionId + '.json';
    immutable(file, { schema_version: 1, ...input, date, state: input.state ?? 'active', version: (current?.version ?? 0) + 1,
      input_hash: fingerprint, recorded_at: new Date().toISOString(), sources: sourceRefs(input.sources), ranges });
    return { path: file, version: (current?.version ?? 0) + 1, replay: false };
  });
}
