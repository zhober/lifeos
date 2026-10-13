// Light-ask archive: append one personalised recommendation to advice/YYYY-MM-DD-assistant.md.
// Uses the shared hash-checked writer in append mode; existing entries are never rewritten.
// Usage: node tools/advice-note.mjs <input.json | -> [--dry-run]
//   input: { "question": "...", "answer": "...", "sources": ["..."], "captured_at": "2026-10-13T21:40:00+08:00" }
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { digest, stable, keyId, inputJSON, readJSON, vaultPath, currentHash, checkedWrite } from './store.mjs';
import { localParts } from './lib.mjs';

const USAGE = 'Usage: node tools/advice-note.mjs <input.json | -> [--dry-run]  (fields: workflows/ask/QUICK.md)';
const fail = message => { throw new Error(message); };
const text = (value, label) => typeof value === 'string' && value.trim() ? value.trim() : fail(label + ' must be nonempty text.');

function capturedAt(value) {
  if (value === undefined || value === null) return new Date();
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:[+-]\d{2}:\d{2}|Z)$/.test(value))
    fail('captured_at needs an explicit timezone offset, e.g. 2026-10-13T21:40:00+08:00; omit it to use now.');
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) fail('captured_at is not a valid instant: ' + value);
  return instant;
}


export function prepareNote(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('Input must be a JSON object.');
  const question = text(input.question, 'question'), answer = text(input.answer, 'answer');
  const sources = input.sources === undefined || input.sources === null ? [] : Array.isArray(input.sources) ? input.sources : fail('sources must be an array.');
  for (const source of sources) if (typeof source !== 'string' || !source.trim() || /[\r\n`]/.test(source)) fail('Each source must be one line of text without backticks.');
  const instant = capturedAt(input.captured_at), { date, time } = localParts(instant);
  const relative = 'advice/' + date + '-assistant.md';
  // Same question and answer on the same day is the same note: a rerun is a no-op.
  const operation_id = 'advice-note:' + digest(stable({ date, question, answer, sources }));
  const entry = '\n### ' + time + ' light ask\n<!-- captured ' + (input.captured_at ?? instant.toISOString()) + ' -->\n\n'
    + question.split(/\r?\n/).map(line => '> ' + line).join('\n') + '\n\n' + answer + '\n'
    + (sources.length ? '\nSources: ' + sources.map(source => '`' + source.trim() + '`').join('; ') + '\n' : '');
  return { relative, operation_id, date, entry };
}

export function appendNote(input, { dryRun = false } = {}) {
  const note = prepareNote(input);
  const done = readJSON('history/operations/' + keyId('write', note.operation_id) + '/completed.json');
  if (done) return { path: note.relative, operation_id: note.operation_id, sha256: done.sha256, replay: true };
  const header = '---\ndate: ' + note.date + '\nexpert: assistant\nkind: light-ask\n---\n';
  for (let attempt = 0; ; attempt++) {
    const file = vaultPath(note.relative), expected_hash = currentHash(file);
    const content = (expected_hash === null ? header : '') + note.entry;
    if (dryRun) return { path: note.relative, operation_id: note.operation_id, dry_run: true, creates_file: expected_hash === null, content };
    try {
      const written = checkedWrite({ operation_id: note.operation_id, path: note.relative, mode: 'append', expected_hash, content });
      return { path: note.relative, operation_id: note.operation_id, sha256: written.sha256, created: expected_hash === null, replay: Boolean(written.replay) };
    } catch (error) {
      // Another writer appended between reading the hash and committing; reread and retry.
      if (attempt < 2 && /changed since it was read|Concurrent edit/.test(error.message)) continue;
      throw error;
    }
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const args = process.argv.slice(2), file = args.find(arg => !arg.startsWith('--'));
  try {
    if (!file) fail(USAGE);
    console.log(JSON.stringify(appendNote(file === '-' ? JSON.parse(fs.readFileSync(0, 'utf8')) : inputJSON(file), { dryRun: args.includes('--dry-run') }), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
