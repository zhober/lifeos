// Small shared validation helpers for portable domain records.
import { dateOrNull, readJSON, walk, currentHash, vaultPath, sourceRefs } from './store.mjs';

export const ensure = (condition, message) => { if (!condition) throw new Error(message); };
export const textValue = value => typeof value === 'string' && value.trim().length > 0;
export const strings = (value, label) => { ensure(Array.isArray(value) && value.every(textValue), label + ' must be an array of nonempty strings.'); return value; };
export function occurrence(input) {
  const start = dateOrNull(input.occurred_start), end = dateOrNull(input.occurred_end ?? input.occurred_start);
  const precision = input.date_precision ?? (start ? 'day' : 'unknown');
  ensure(['day', 'month', 'year', 'range', 'unknown'].includes(precision), 'Invalid date precision.');
  ensure(precision === 'unknown' ? !start && !end : start && end, 'Known dates need bounds; unknown dates must stay null.');
  ensure(!start || end >= start, 'Occurrence range is reversed.');
  ensure(precision !== 'day' || start === end, 'Use range precision for several days.');
  return { occurred_start: start, occurred_end: end, date_precision: precision };
}
export function versions(root, idField) {
  const all = walk(root, '.json').map(file => ({ ...readJSON(file), file })), selected = new Map(), seen = new Set();
  for (const record of all) {
    ensure(record.schema_version === 1 && textValue(record[idField]) && Number.isInteger(record.version) && record.version > 0,
      'Invalid versioned record: ' + record.file);
    const key = record[idField] + '/' + record.version;
    ensure(!seen.has(key), 'Conflicting record versions: ' + record[idField]); seen.add(key);
    if (!selected.has(record[idField]) || selected.get(record[idField]).version < record.version) selected.set(record[idField], record);
  }
  for (const id of selected.keys()) {
    const ordered = all.filter(record => record[idField] === id).sort((a, b) => a.version - b.version);
    ordered.forEach((record, index) => ensure(record.version === index + 1 && (index === 0 ? !record.supersedes : record.supersedes === ordered[index - 1].file),
      'Invalid record revision chain: ' + id));
  }
  return { all, current: [...selected.values()] };
}
export function captureSources(input) {
  ensure(Array.isArray(input) && input.length > 0, 'At least one durable source reference is required.');
  for (const source of input.filter(item => item && typeof item === 'object')) {
    const expected = source.sha256_at_capture ?? source.sha256;
    if (expected !== undefined) ensure(currentHash(vaultPath(source.path)) === expected, 'Source changed before capture: ' + source.path);
  }
  return sourceRefs(input);
}
export function sourceStatus(source) {
  try {
    return currentHash(vaultPath(source.path)) === source.sha256_at_capture ? { path: source.path, current: true }
      : { path: source.path, current: false, reason: 'missing_or_changed_source' };
  } catch { return { path: source.path, current: false, reason: 'unreadable_source' }; }
}
