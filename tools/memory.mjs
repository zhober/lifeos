// Immutable, sourced long-term memory. All retained years remain searchable.
import fs from 'node:fs';
import { today, localDate, timezone } from './lib.mjs';
import { digest, stable, keyId, vaultPath, readJSON, inputJSON, immutable, walk, sourceRefs, dateOrNull } from './store.mjs';

const kinds = ['fact', 'event', 'constraint', 'preference', 'method', 'insight', 'hypothesis'];
const evidenceTypes = ['reported', 'observed', 'verified', 'estimated', 'inferred'];
const allEntries = () => walk('memory/entries', '.json').map(file => ({ ...readJSON(file), file }));

function add(input) {
  if (!input.operation_id || !kinds.includes(input.kind) || typeof input.text !== 'string' || !input.text.trim())
    throw new Error('Supply operation_id, kind, domain, text, evidence, and sources.');
  if (!/^[a-z][a-z0-9-]*$/.test(input.domain ?? '') || !evidenceTypes.includes(input.evidence)) throw new Error('Invalid domain or evidence type.');
  if (input.kind === 'hypothesis' && input.evidence !== 'inferred') throw new Error('Hypotheses must be marked inferred.');
  if (input.evidence === 'inferred' && !['hypothesis', 'insight'].includes(input.kind)) throw new Error('Do not store an inference as a confirmed fact or observed event.');
  const id = keyId('mem', input.operation_id), inputHash = digest(stable(input));
  const entries = allEntries(), previous = entries.find(entry => entry.id === id);
  if (previous) {
    if (previous.input_hash !== inputHash) throw new Error('Memory operation identifier reused with different content.');
    return { id, path: previous.file, replay: true };
  }
  const occurredStart = dateOrNull(input.occurred_start), occurredEnd = dateOrNull(input.occurred_end ?? input.occurred_start);
  const precision = input.date_precision ?? (occurredStart ? 'day' : 'unknown');
  if (!['day', 'month', 'year', 'range', 'unknown'].includes(precision)) throw new Error('Invalid date precision.');
  if (precision === 'unknown' && (occurredStart || occurredEnd)) throw new Error('Unknown occurrence dates must stay null.');
  if (precision !== 'unknown' && (!occurredStart || !occurredEnd)) throw new Error('Known occurrence ranges require start and end dates.');
  if (occurredStart && occurredEnd < occurredStart) throw new Error('Occurrence range is reversed.');
  if (precision === 'day' && occurredStart !== occurredEnd) throw new Error('Use range precision for several days.');
  const validFrom = dateOrNull(input.valid_from), validTo = dateOrNull(input.valid_to);
  if (validFrom && validTo && validTo < validFrom) throw new Error('Validity range is reversed.');
  const temporalClass = input.temporal_class ?? (['event', 'method'].includes(input.kind) ? 'episode' : input.kind === 'constraint' ? 'temporary' : 'enduring');
  if (!['enduring', 'temporary', 'episode'].includes(temporalClass)) throw new Error('Invalid temporal class.');
  const supersedes = input.supersedes ?? [], relatedTo = input.related_to ?? [];
  if (!Array.isArray(supersedes) || !Array.isArray(relatedTo)) throw new Error('Memory links must be arrays.');
  for (const referenced of [...supersedes, ...relatedTo])
    if (!entries.some(entry => entry.id === referenced)) throw new Error('Unknown linked memory: ' + referenced);
  if (input.evidence === 'inferred' && supersedes.some(id => entries.find(entry => entry.id === id).evidence !== 'inferred'))
    throw new Error('An inference cannot supersede an observed or reported fact.');
  if (input.kind === 'insight') {
    const start = dateOrNull(input.evidence_start), end = dateOrNull(input.evidence_end);
    if (!start || !end || (Date.parse(end) - Date.parse(start)) / 86400000 < 13)
      throw new Error('A personal pattern requires an evidence span of at least fourteen calendar days.');
  }
  const recordedAt = new Date().toISOString();
  const entry = { schema_version: 1, id, operation_id: input.operation_id, input_hash: inputHash,
    recorded_at: recordedAt, kind: input.kind, domain: input.domain, text: input.text,
    evidence: input.evidence, temporal_class: temporalClass, occurred_start: occurredStart,
    occurred_end: occurredEnd, date_precision: precision, valid_from: validFrom, valid_to: validTo,
    state: input.state ?? 'unknown', tags: input.tags ?? [], aliases: input.aliases ?? [],
    entities: input.entities ?? [], fact_key: input.fact_key ?? null,
    supersedes, related_to: relatedTo, sources: sourceRefs(input.sources),
    evidence_start: input.evidence_start ?? null, evidence_end: input.evidence_end ?? null };
  if (!['ongoing', 'resolved', 'unknown'].includes(entry.state) || !Array.isArray(entry.tags) || !Array.isArray(entry.aliases)
    || !Array.isArray(entry.entities) || entry.entities.some(value => typeof value !== 'string')
    || (entry.fact_key !== null && typeof entry.fact_key !== 'string'))
    throw new Error('Invalid state, tags, or aliases.');
  const file = 'memory/entries/' + recordedAt.slice(0, 4) + '/' + id + '.json';
  immutable(file, entry);
  return { id, path: file, replay: false };
}

function annotate(entries, at) {
  // recorded_at is a UTC instant; compare its local calendar day, not its UTC date, with the local date at.
  const zone = timezone();
  const applicable = at ? entries.filter(entry => (entry.valid_from ?? entry.occurred_start ?? localDate(entry.recorded_at, zone)) <= at) : entries;
  const superseded = new Set(applicable.flatMap(entry => entry.supersedes));
  return entries.map(entry => ({ ...entry, superseded: superseded.has(entry.id),
    source_missing: entry.sources.some(source => !fs.existsSync(vaultPath(source.path))),
    source_changed: entry.sources.some(source => fs.existsSync(vaultPath(source.path))
      && digest(fs.readFileSync(vaultPath(source.path))) !== source.sha256_at_capture) }));
}

function tokens(query) {
  const text = String(query ?? '').toLowerCase();
  const segments = new Intl.Segmenter('zh', { granularity: 'word' }).segment(text);
  return [...new Set([text.trim(), ...[...segments].filter(part => part.isWordLike).map(part => part.segment)].filter(Boolean))];
}
const score = (text, terms) => terms.reduce((sum, term) => sum + (text.toLowerCase().includes(term) ? Math.max(1, term.length) : 0), 0);

function query(options) {
  const terms = tokens(options.query), entries = annotate(allEntries());
  let results = entries.filter(entry => !options.domain || entry.domain === options.domain)
    .filter(entry => !options.entity || entry.entities.includes(options.entity))
    .filter(entry => !options.from || (entry.occurred_end && entry.occurred_end >= options.from))
    .filter(entry => !options.to || (entry.occurred_start && entry.occurred_start <= options.to))
    .map(entry => ({ ...entry, match_score: score([entry.text, ...entry.tags, ...entry.aliases, ...entry.entities, entry.fact_key ?? ''].join(' '), terms) }))
    .filter(entry => !terms.length || entry.match_score > 0);
  if (options.raw && terms.length) {
    const roots = ['profile', 'journal', 'records', 'inbox', 'advice', 'reviews', 'tasks', 'memory/insights.md'];
    for (const file of roots.flatMap(root => walk(root))) {
      if (!/\.(md|txt|json|jsonl|csv)$/i.test(file)) continue;
      let text = fs.readFileSync(vaultPath(file), 'utf8'), sourceType = 'document';
      if (file.startsWith('tasks/')) {
        if (file.endsWith('/request.json')) {
          try { text = JSON.parse(text).original_input ?? ''; } catch { /* Preserve corrupt source text for inspection. */ }
          sourceType = 'request';
        } else if (/\/events\/[^/]+\.json$/.test(file)) {
          let event; try { event = JSON.parse(text); } catch { continue; }
          if (event.type !== 'message') continue;
          text = event.text; sourceType = event.role + '_message';
        } else if (file.includes('/artifacts/') && /\.(md|txt)$/.test(file)) sourceType = 'task_artifact';
        else continue;
      }
      if (typeof text !== 'string') continue;
      const hit = score(text, terms);
      if (!hit) continue;
      const index = terms.map(term => text.toLowerCase().indexOf(term)).filter(value => value >= 0).sort((a, b) => a - b)[0];
      const occurred = file.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
      if ((options.from && (!occurred || occurred < options.from)) || (options.to && (!occurred || occurred > options.to))) continue;
      results.push({ kind: 'raw_source', evidence: 'unclassified', file, occurred_start: occurred,
        source_type: sourceType,
        text: text.slice(Math.max(0, index - 100), index + 500), match_score: hit,
        sources: [{ path: file }], requires_original_read: true });
    }
  }
  results.sort((a, b) => b.match_score - a.match_score || String(a.occurred_start ?? a.recorded_at ?? '').localeCompare(String(b.occurred_start ?? b.recorded_at ?? '')));
  const offset = options.offset ?? 0, limit = options.limit ?? 20;
  return { search_scope: 'all retained years unless an explicit date filter is supplied',
    query: options.query ?? '', domain: options.domain ?? null, total: results.length,
    offset, limit, has_more: offset + limit < results.length,
    next_offset: offset + limit < results.length ? offset + limit : null, results: results.slice(offset, offset + limit) };
}

function context(options) {
  const at = dateOrNull(options.at) ?? today(), entries = annotate(allEntries(), at);
  const selected = entries.filter(entry => !options.domain || entry.domain === options.domain)
    .filter(entry => !options.entity || entry.entities.includes(options.entity));
  const current = selected.filter(entry => !entry.superseded && !['hypothesis', 'event', 'method'].includes(entry.kind)
    && !['estimated', 'inferred'].includes(entry.evidence) && entry.temporal_class !== 'episode'
    && (!entry.valid_from || entry.valid_from <= at) && (!entry.valid_to || entry.valid_to >= at)
    && (!entry.occurred_start || entry.occurred_start <= at));
  const allEpisodes = selected.filter(entry => ['event', 'method'].includes(entry.kind) || entry.temporal_class === 'episode')
    .sort((a, b) => String(a.occurred_start ?? a.recorded_at).localeCompare(String(b.occurred_start ?? b.recorded_at)));
  const episodes = allEpisodes.filter(entry => !entry.occurred_start || entry.occurred_start <= at);
  const upcoming = allEpisodes.filter(entry => entry.occurred_start && entry.occurred_start > at);
  const limit = options.limit ?? 50, offset = options.offset ?? 0;
  const factsOffset = options.facts_offset ?? 0;
  const groups = new Map();
  for (const entry of current.filter(entry => entry.fact_key)) {
    if (!groups.has(entry.fact_key)) groups.set(entry.fact_key, []);
    groups.get(entry.fact_key).push(entry);
  }
  const conflicts = [...groups].filter(([, group]) => new Set(group.map(entry => entry.text)).size > 1)
    .map(([fact_key, group]) => ({ fact_key, memory_ids: group.map(entry => entry.id), requires_comparison: true }));
  const hypotheses = selected.filter(entry => entry.kind === 'hypothesis' && !entry.superseded && entry.state !== 'resolved'
    && (!entry.valid_from || entry.valid_from <= at) && (!entry.valid_to || entry.valid_to >= at)
    && (!entry.occurred_start || entry.occurred_start <= at));
  const expired = selected.filter(entry => entry.kind === 'constraint' && entry.valid_to && entry.valid_to < at);
  const hypothesesPage = hypotheses.slice(offset, offset + limit), expiredPage = expired.slice(offset, offset + limit);
  return { at, domain: options.domain ?? null, current_total: current.length, current_offset: factsOffset,
    current_has_more: factsOffset + limit < current.length,
    next_current_offset: factsOffset + limit < current.length ? factsOffset + limit : null,
    current_facts: current.slice(factsOffset, factsOffset + limit),
    possible_conflicts: conflicts,
    historical_total: episodes.length, historical_offset: offset, historical_limit: limit,
    historical_has_more: offset + limit < episodes.length,
    next_offset: offset + limit < episodes.length ? offset + limit : null,
    historical_events: episodes.slice(offset, offset + limit),
    upcoming_total: upcoming.length,
    upcoming_events: upcoming.slice(offset, offset + limit),
    upcoming_has_more: offset + limit < upcoming.length,
    next_upcoming_offset: offset + limit < upcoming.length ? offset + limit : null,
    unresolved_hypotheses_total: hypotheses.length, unresolved_hypotheses_count: hypothesesPage.length,
    unresolved_hypotheses_offset: offset, unresolved_hypotheses_limit: limit,
    unresolved_hypotheses_has_more: offset + limit < hypotheses.length,
    next_unresolved_hypotheses_offset: offset + limit < hypotheses.length ? offset + limit : null,
    unresolved_hypotheses: hypothesesPage,
    expired_constraints_total: expired.length, expired_constraints_count: expiredPage.length,
    expired_constraints_offset: offset, expired_constraints_limit: limit,
    expired_constraints_has_more: offset + limit < expired.length,
    next_expired_constraints_offset: offset + limit < expired.length ? offset + limit : null,
    expired_constraints: expiredPage,
    note: 'This is a retrieved view, not a replacement for immutable history. Recorded links do not establish causation. Events after the selected date are listed separately.' };
}

function neighbors(id, options) {
  const entries = annotate(allEntries()), byId = new Map(entries.map(entry => [entry.id, entry]));
  if (!byId.has(id)) throw new Error('Unknown memory: ' + id);
  const depth = Number(options.depth ?? 1);
  if (!Number.isInteger(depth) || depth < 1 || depth > 3) throw new Error('Link depth must be between one and three.');
  const seen = new Set([id]); let frontier = [id];
  for (let level = 0; level < depth; level++) {
    const next = [];
    for (const current of frontier) {
      const entry = byId.get(current), linked = new Set([...entry.related_to, ...entry.supersedes]);
      for (const candidate of entries)
        if (candidate.related_to.includes(current) || candidate.supersedes.includes(current)) linked.add(candidate.id);
      for (const linkedId of linked) if (!seen.has(linkedId) && byId.has(linkedId)) { seen.add(linkedId); next.push(linkedId); }
    }
    frontier = next;
  }
  const found = [...seen].map(key => byId.get(key));
  return { seed: id, depth, total: found.length, has_more: options.offset + options.limit < found.length,
    next_offset: options.offset + options.limit < found.length ? options.offset + options.limit : null,
    results: found.slice(options.offset, options.offset + options.limit),
    note: 'These are explicit reference links, not inferred causation or a complete semantic graph.' };
}

const [command, ...args] = process.argv.slice(2);
const option = name => { const index = args.indexOf('--' + name); return index < 0 ? undefined : args[index + 1]; };
function options() {
  const limit = Number(option('limit') ?? 20), offset = Number(option('offset') ?? 0), factsOffset = Number(option('facts-offset') ?? 0);
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000 || !Number.isInteger(offset) || offset < 0
    || !Number.isInteger(factsOffset) || factsOffset < 0) throw new Error('Invalid limit or offset.');
  const terms = [];
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--raw' || args[index] === '--json') continue;
    if (args[index].startsWith('--')) { index++; continue; }
    terms.push(args[index]);
  }
  return { query: terms.join(' '), domain: option('domain'), entity: option('entity'), depth: option('depth'), from: dateOrNull(option('from')),
    to: dateOrNull(option('to')), at: option('at'), limit, offset, facts_offset: factsOffset, raw: args.includes('--raw') };
}
try {
  let result;
  if (command === 'add') result = add(inputJSON(args[0]));
  else if (command === 'query') result = query(options());
  else if (command === 'context') result = context(options());
  else if (command === 'neighbors') result = neighbors(args[0], options());
  else throw new Error('Usage: node tools/memory.mjs add <entry.json> | query [terms] [--domain health] [--raw] | context [--domain health]');
  const output = option('output');
  if (output) {
    if (!output.startsWith('tasks/')) throw new Error('Retrieval artifacts must be saved under tasks/.');
    immutable(output, result);
    result = { ...result, artifact: output };
  }
  console.log(JSON.stringify(result, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
