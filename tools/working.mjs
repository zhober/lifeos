// Working notes: a short, user-curated list of standing preferences and corrections that every session
// reads at startup (tools/context.mjs prints them). Records and memory entries stay the sourced record;
// these notes only say how to serve the user. The file has a byte budget: a write that would exceed it,
// or that repeats an existing note, is refused so the notes are consolidated rather than silently dropped.
// Writes are hash-checked and keep a before/after snapshot (tools/store.mjs checkedWrite).
// node tools/working.mjs show | add <text> [--scope <id>] | replace <id> <text> [--scope <id>] | remove <id>
import crypto from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readJSON, vaultPath, currentHash, checkedWrite, keyId } from './store.mjs';
import { readIfExists } from './lib.mjs';
import { disclosurePolicy } from './privacy.mjs';

const NOTE = /^- (w\d+)(?: \[([a-z][a-z0-9_-]*)\])? (.+)$/;
const SCOPE = /^[a-z][a-z0-9_-]*$/;
const NOTE_MAX_BYTES = 300;
const HEADER = '# Working notes\n\nStanding preferences and corrections that every session follows. Change them with `node tools/working.mjs`.\n';

export function workingSettings() {
  const settings = readJSON('project.json')?.working_notes ?? {};
  return { relative: settings.file ?? 'profile/working.md', max_bytes: settings.max_bytes ?? 2000 };
}

function parse(text) {
  const lines = (text ?? HEADER).replace(/\r\n/g, '\n').split('\n');
  const first = lines.findIndex(line => NOTE.test(line));
  const header = (first < 0 ? lines : lines.slice(0, first)).join('\n').trimEnd() + '\n';
  const notes = lines.slice(first < 0 ? lines.length : first).filter(line => line.trim()).map(line => {
    const match = line.match(NOTE);
    if (!match) throw new Error('Unrecognised working-notes line (edit it through this tool): ' + line);
    return { id: match[1], scope: match[2] ?? null, text: match[3] };
  });
  return { header, notes };
}

const render = ({ header, notes }) => header + (notes.length ? '\n' + notes.map(note => '- ' + note.id + (note.scope ? ' [' + note.scope + ']' : '') + ' ' + note.text).join('\n') + '\n' : '');
const normalize = text => text.toLowerCase().replace(/\s+/g, ' ').replace(/[.。!！]+$/, '').trim();
// A scope the user has withheld entirely is neither stored nor shown.
const withheld = scope => scope !== null && disclosurePolicy([scope]).withheld_fields.includes('all');

export function readWorkingNotes() {
  const { relative, max_bytes } = workingSettings();
  const text = readIfExists(vaultPath(relative));
  const parsed = parse(text);
  return { path: relative, max_bytes, bytes: Buffer.byteLength(text ?? ''), ...parsed };
}

// The notes a session should see: everything except notes in a scope the user currently withholds.
export const visibleWorkingNotes = () => readWorkingNotes().notes.filter(note => !withheld(note.scope));

function validText(text, scope) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('Supply the note text.');
  if (/[\r\n]/.test(text)) throw new Error('A working note is one line.');
  if (Buffer.byteLength(text.trim()) > NOTE_MAX_BYTES) throw new Error('A working note is at most ' + NOTE_MAX_BYTES + ' bytes; shorten it.');
  if (scope !== null && !SCOPE.test(scope)) throw new Error('Scope must be a lowercase identifier such as nutrition.');
  if (withheld(scope)) throw new Error('The user withholds the ' + scope + ' scope; do not keep notes about it.');
  return text.trim();
}

function save(current, next) {
  const { relative, max_bytes } = workingSettings();
  const text = render(next), bytes = Buffer.byteLength(text);
  if (bytes > max_bytes) throw new Error('Working notes would be ' + bytes + ' bytes; budget ' + max_bytes
    + '. Merge or remove notes first (node tools/working.mjs show), then retry.');
  checkedWrite({ operation_id: keyId('working', relative + ':' + crypto.randomUUID()), path: relative, mode: 'replace', expected_hash: current.hash, content: text });
  return { path: relative, bytes, max_bytes, notes: next.notes };
}

function load() {
  const { relative } = workingSettings(), file = vaultPath(relative), text = readIfExists(file);
  return { text, hash: currentHash(file), ...parse(text) };
}

export function addNote(text, scope = null) {
  const current = load(), clean = validText(text, scope);
  const duplicate = current.notes.find(note => normalize(note.text) === normalize(clean));
  if (duplicate) throw new Error('Already noted as ' + duplicate.id + '; use replace to change it.');
  const id = 'w' + (Math.max(0, ...current.notes.map(note => Number(note.id.slice(1)))) + 1);
  return { added: id, ...save(current, { header: current.header, notes: [...current.notes, { id, scope, text: clean }] }) };
}

export function replaceNote(id, text, scope) {
  const current = load(), index = current.notes.findIndex(note => note.id === id);
  if (index < 0) throw new Error('Unknown working note: ' + id);
  const nextScope = scope === undefined ? current.notes[index].scope : scope, clean = validText(text, nextScope);
  const duplicate = current.notes.find(note => note.id !== id && normalize(note.text) === normalize(clean));
  if (duplicate) throw new Error('Same as ' + duplicate.id + '; remove one of them instead.');
  const notes = current.notes.map((note, position) => position === index ? { id, scope: nextScope, text: clean } : note);
  return { replaced: id, ...save(current, { header: current.header, notes }) };
}

export function removeNote(id) {
  const current = load();
  if (!current.notes.some(note => note.id === id)) throw new Error('Unknown working note: ' + id);
  return { removed: id, ...save(current, { header: current.header, notes: current.notes.filter(note => note.id !== id) }) };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    const args = process.argv.slice(2), scopeAt = args.indexOf('--scope');
    const scope = scopeAt < 0 ? undefined : args[scopeAt + 1] ?? '';
    const positional = scopeAt < 0 ? args : args.filter((_, index) => index !== scopeAt && index !== scopeAt + 1);
    const [command, first, second] = positional;
    let result;
    if (command === 'show') { const notes = readWorkingNotes(); result = { path: notes.path, bytes: notes.bytes, max_bytes: notes.max_bytes, notes: notes.notes }; }
    else if (command === 'add') result = addNote(first, scope ?? null);
    else if (command === 'replace') result = replaceNote(first, second, scope);
    else if (command === 'remove') result = removeNote(first);
    else throw new Error('Usage: node tools/working.mjs show | add <text> [--scope <id>] | replace <id> <text> [--scope <id>] | remove <id>');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
