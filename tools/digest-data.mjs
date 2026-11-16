// Message digests: the shared, network-free half of the pipeline (normalise → screen → queue → report).
// A digest kind (literature, news, ...) only differs in its collector and its personal settings
// (profile/digest/<kind>.json); everything here is deterministic and covered by the development tests.
// Contract: docs/domains/DIGEST.md. The model scores and curates; these functions never judge relevance.

export const SETTINGS_VERSION = 1;
// Non-research entries that keep the original paper's keywords. Matched on the lower-cased title start.
export const CORRECTION_PREFIXES = ['publisher correction:', 'author correction:', 'correction:', 'correction for', 'correction to',
  'corrigendum:', 'erratum:', 'retraction:', 'retraction of:', 'retraction note:', 'retraction notice to', 'expression of concern:',
  'expression of concern on', 'editorial expression of concern', 'editorial:', 'in this issue', 'reply to'];
// PubMed publication types that never carry new research. "Comment" is not one: PubMed also tags research articles with it.
export const EXCLUDED_TYPES = ['Published Erratum', 'Retraction of Publication', 'Retracted Publication', 'Expression of Concern', 'Editorial', 'News', 'Newspaper Article'];

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export function decodeEntities(text) {
  return String(text ?? '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code) => {
    if (code[0] === '#') { const value = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10); return Number.isFinite(value) ? String.fromCodePoint(value) : match; }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}
// Markup to plain text: tags dropped, entities decoded, non-breaking and repeated spaces collapsed.
export const plainText = text => decodeEntities(String(text ?? '').replace(/<[^>]+>/g, ' ')).replace(/[ \s]+/g, ' ').trim();
export function cleanDoi(value) {
  const match = String(value ?? '').match(/10\.\d{4,9}\/[^\s"<>]+/);
  return match ? match[0].replace(/[.,;)\]]+$/, '').toLowerCase() : '';
}
// Title key for cross-source comparison: case, punctuation and trailing periods do not matter.
export const titleKey = title => plainText(title).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().slice(0, 120);
export const itemId = item => item.pmid ? 'pmid:' + item.pmid : item.doi ? 'doi:' + cleanDoi(item.doi) : item.url ? 'url:' + item.url.replace(/[?#].*$/, '').replace(/\/+$/, '').toLowerCase() : 'title:' + titleKey(item.title);
export const itemKeys = item => [item.pmid && 'pmid:' + item.pmid, item.doi && 'doi:' + cleanDoi(item.doi), item.url && 'url:' + item.url.replace(/[?#].*$/, '').replace(/\/+$/, '').toLowerCase(), item.title && 'title:' + titleKey(item.title)].filter(Boolean);

// ---- keyword matching -------------------------------------------------------------------------
// Terms match as whole words (an optional plural s/es is allowed). A trailing * makes a prefix ("epigenom*").
// Terms written mostly in capitals (TAD, FUS, Hi-C, CUT&Tag) match case-sensitively, so "stage" never
// matches STAG and "fusion" never matches FUS. An object term may set {case: true|false} and
// {requires: [...]}: the hit counts only when one of the required context terms also occurs; {unless: [...]}: it does
// not count when one of these occurs (Hi-C used only for genome-assembly scaffolding).
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function compileTerm(entry) {
  const spec = typeof entry === 'string' ? { term: entry } : { ...entry };
  if (typeof spec.term !== 'string' || !spec.term.trim()) throw new Error('A keyword needs a non-empty term.');
  const raw = spec.term.trim(), prefix = raw.endsWith('*'), term = prefix ? raw.slice(0, -1) : raw;
  const upper = (term.match(/[A-Z]/g) ?? []).length, lower = (term.match(/[a-z]/g) ?? []).length;
  const caseSensitive = spec.case ?? (upper >= 2 && upper >= lower);
  // A space in a term matches spaces or hyphens; a hyphen also matches a space or nothing (Hi-C, Hi C, HiC).
  const body = escape(term.replace(/-/g, '\u0000')).replace(/\s+/g, '[\\s\\u00a0-]+').replace(/\u0000/g, '[\\s\\u00a0-]?');
  // Chinese and Japanese text has no spaces between words, so CJK terms match as plain substrings.
  const pattern = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(term) ? body
    : '(?<![\\p{L}\\p{N}])' + body + (prefix ? '' : '(?:s|es)?(?![\\p{L}\\p{N}])');
  return { term: raw, regex: new RegExp(pattern, caseSensitive ? 'gu' : 'giu'), requires: (spec.requires ?? []).map(compileTerm), unless: (spec.unless ?? []).map(compileTerm) };
}
const occurs = (compiled, text) => { compiled.regex.lastIndex = 0; return compiled.regex.test(text); };
export const termHits = (compiled, text) => occurs(compiled, text) && (!compiled.requires.length || compiled.requires.some(context => occurs(context, text)))
  && !compiled.unless.some(context => occurs(context, text));

export function compileInterests(settings) {
  const interests = settings.interests ?? [];
  return interests.map(interest => ({ id: interest.id, label: interest.label ?? interest.id, core: interest.core === true,
    method: interest.method === true, weak: (interest.weak ?? []).map(compileTerm), terms: (interest.keywords ?? []).map(compileTerm) }));
}

// Which dimensions a text hits, and through which terms. A dimension hit only through weak (generic) terms is
// shown when another dimension hits strongly, but never counts toward the candidate rule.
export function dimensionHits(dimensions, text) {
  const hits = [];
  for (const dimension of dimensions) {
    const strong = dimension.terms.filter(term => termHits(term, text)).map(term => term.term);
    const weak = dimension.weak.filter(term => termHits(term, text)).map(term => term.term);
    if (strong.length || weak.length) hits.push({ id: dimension.id, core: dimension.core, method: dimension.method, terms: strong, weak_only: !strong.length, weak_terms: weak });
  }
  const others = id => hits.some(hit => hit.id !== id && !hit.weak_only);
  return hits.filter(hit => !hit.weak_only || others(hit.id));
}

// Candidate rule: a core dimension, or two topic dimensions. A method dimension alone, or a single
// non-core topic dimension, is not enough (in practice these are mostly false positives); such items
// stay visible in the title review list. Journals listed as strict need a core hit.
export function candidateVerdict(hits, strict) {
  const topics = hits.filter(hit => !hit.method && !hit.weak_only), core = topics.some(hit => hit.core);
  if (strict) return core ? 'core' : null;
  if (core) return 'core';
  if (topics.length >= 2) return 'multi_dimension';
  return null;
}

// ---- screening ----------------------------------------------------------------------------------
export function exclusionReason(item, settings) {
  const title = plainText(item.title).toLowerCase();
  const prefixes = [...CORRECTION_PREFIXES, ...(settings.exclude_title_prefixes ?? []).map(prefix => prefix.toLowerCase())];
  const prefix = prefixes.find(candidate => title.startsWith(candidate));
  if (prefix) return 'non_research_title:' + prefix;
  const type = (item.publication_types ?? []).find(candidate => EXCLUDED_TYPES.includes(candidate));
  if (type) return 'non_research_type:' + type;
  if (/\/d41586-/i.test(item.doi ?? '') && (item.abstract ?? '').length < 50) return 'news_item';
  return null;
}

export function screen(items, settings, { seen = new Set(), shortAbstract = 500 } = {}) {
  const dimensions = compileInterests(settings);
  const strictJournals = new Set((settings.strict_journals ?? []).map(name => name.toLowerCase()));
  const excluded = [], candidates = [], review = [], duplicates = [];
  for (const item of items) {
    if (itemKeys(item).some(key => seen.has(key))) { duplicates.push({ id: item.id, title: item.title, reason: 'already_seen' }); continue; }
    const reason = exclusionReason(item, settings);
    if (reason) { excluded.push({ id: item.id, title: item.title, journal: item.journal, reason }); continue; }
    const abstractLength = (item.abstract ?? '').length;
    const flags = [...(abstractLength === 0 ? ['no_abstract'] : abstractLength < shortAbstract ? ['short_abstract'] : [])];
    const strict = strictJournals.has(String(item.journal ?? '').toLowerCase());
    const titleHits = dimensionHits(dimensions, plainText(item.title));
    const titleVerdict = candidateVerdict(titleHits, strict);
    const allHits = titleVerdict ? titleHits : dimensionHits(dimensions, plainText(item.title) + ' \n ' + plainText(item.abstract));
    const verdict = titleVerdict ?? candidateVerdict(allHits, strict);
    const summary = { id: item.id, tier: item.tier, journal: item.journal, source: item.source, title: item.title, abstract_chars: abstractLength, flags,
      dimensions: allHits.map(hit => hit.id + ':' + [...hit.terms, ...hit.weak_terms].join('|')) };
    if (verdict) candidates.push({ ...summary, stage: titleVerdict ? 'title' : 'abstract', basis: verdict, ...(strict ? { strict_journal: true } : {}) });
    else review.push({ id: item.id, tier: item.tier, journal: item.journal, title: item.title, flags, ...(allHits.length ? { weak_hits: summary.dimensions } : {}) });
  }
  candidates.sort((a, b) => (a.stage === b.stage ? 0 : a.stage === 'title' ? -1 : 1) || a.tier - b.tier || a.id.localeCompare(b.id));
  return { candidates, title_review: review, excluded, duplicates };
}

// Core-token evidence for "nothing in the core field" claims: hits grouped by item, copied verbatim into the report.
export function tokenScan(items, tokens) {
  const compiled = (tokens ?? []).map(compileTerm), hits = [];
  for (const item of items) {
    const text = plainText(item.title) + ' \n ' + plainText(item.abstract);
    const found = compiled.filter(token => occurs(token, text)).map(token => token.term);
    if (found.length) hits.push({ id: item.id, title: item.title, tokens: found });
  }
  return { tokens: compiled.map(token => token.term), items_scanned: items.length, hits };
}

// ---- queue --------------------------------------------------------------------------------------
const daysBetween = (from, to) => Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000);
export const waitingDays = (entry, date) => Math.max(0, daysBetween(entry.date_discovered, date));

// One deterministic lifecycle step: new scored items (≥ min score, not selected) join as watching,
// selected items are promoted, watching items past the expiry age expire, and when the file holds more
// than the cap the oldest promoted/expired audit entries move to the archive (watching entries never do).
export function applyQueue(queue, { date, scored, selected, rules }) {
  const entries = (queue?.entries ?? []).map(entry => ({ ...entry }));
  const archive = [], byKey = new Map();
  for (const entry of entries) for (const key of entry.keys ?? [entry.id]) byKey.set(key, entry);
  const selectedIds = new Set(selected);
  for (const item of scored) {
    const existing = (item.keys ?? [item.id]).map(key => byKey.get(key)).find(Boolean);
    if (existing) {
      if (selectedIds.has(item.id) || selectedIds.has(existing.id)) Object.assign(existing, { status: 'promoted', promoted_on: date, score: item.score ?? existing.score });
      else if (existing.status === 'watching' && item.score != null) Object.assign(existing, { score: item.score, reason: item.reason ?? existing.reason, rescored_on: date });
      continue;
    }
    if (item.score == null || (item.score < rules.min_score && !selectedIds.has(item.id))) continue;
    const entry = { ...item, status: selectedIds.has(item.id) ? 'promoted' : 'watching', date_discovered: date, ...(selectedIds.has(item.id) ? { promoted_on: date } : {}) };
    entries.push(entry); for (const key of entry.keys ?? [entry.id]) byKey.set(key, entry);
  }
  // Items selected straight from the queue are not in today's collection; promote them by id.
  for (const entry of entries) if (entry.status === 'watching' && selectedIds.has(entry.id)) Object.assign(entry, { status: 'promoted', promoted_on: date });
  for (const entry of entries) if (entry.status === 'watching' && waitingDays(entry, date) > rules.expire_days) Object.assign(entry, { status: 'expired', expired_on: date });
  const watching = entries.filter(entry => entry.status === 'watching');
  let audit = entries.filter(entry => entry.status !== 'watching');
  if (watching.length + audit.length > rules.max_entries) {
    audit.sort((a, b) => (b.promoted_on ?? b.expired_on ?? '').localeCompare(a.promoted_on ?? a.expired_on ?? ''));
    const room = Math.max(0, rules.max_entries - watching.length);
    archive.push(...audit.slice(room)); audit = audit.slice(0, room);
  }
  return { queue: { schema_version: 1, updated: date, entries: [...watching, ...audit] }, archived: archive };
}

// The selection pool: today's scored items plus watching queue entries, best score first, then longest wait.
export function selectionPool(queue, scored, date, minScore) {
  const pool = new Map();
  for (const entry of (queue?.entries ?? []).filter(entry => entry.status === 'watching')) pool.set(entry.id, { ...entry, from_queue: true, waiting_days: waitingDays(entry, date) });
  for (const item of scored.filter(item => item.score >= minScore)) if (!pool.has(item.id)) pool.set(item.id, { ...item, from_queue: false, waiting_days: 0 });
  return [...pool.values()].sort((a, b) => b.score - a.score || b.waiting_days - a.waiting_days || (b.abstract ? 1 : 0) - (a.abstract ? 1 : 0) || a.id.localeCompare(b.id));
}

// ---- translation checks -------------------------------------------------------------------------
export const cjkShare = text => { const letters = String(text).match(/[\p{L}]/gu) ?? []; return letters.length ? (String(text).match(/\p{Script=Han}/gu) ?? []).length / letters.length : 0; };
// Numbers in the original (decimals, values with units, counts of two or more digits) must survive translation;
// a summary instead of a translation drops them. Returns the missing ones.
export function missingNumbers(original, translation) {
  const normalise = text => String(text).replace(/(\d),(?=\d{3})/g, '$1').replace(/[−–]/g, '-');
  const numbers = [...new Set(normalise(original).match(/\d+(?:\.\d+)?/g) ?? [])].filter(value => value.includes('.') || value.length >= 2);
  const target = normalise(translation);
  return numbers.filter(value => !new RegExp('(?<![\\d.])' + escape(value) + '(?![\\d])').test(target));
}
export function translationProblems(original, translation, { minNumberShare = 0.9, minLengthRatio = 0.25 } = {}) {
  const problems = [];
  if (!translation || !translation.trim()) return ['missing translation'];
  const missing = missingNumbers(original, translation), numbers = missingNumbers(original, '');
  if (numbers.length && (numbers.length - missing.length) / numbers.length < minNumberShare) problems.push('numbers missing from the translation: ' + missing.slice(0, 8).join(', '));
  if (translation.length < original.length * minLengthRatio) problems.push('translation is much shorter than the original (' + translation.length + ' vs ' + original.length + ' characters); translate every sentence');
  return problems;
}

// ---- settings validation (layout check) ---------------------------------------------------------
const ID = /^[a-z0-9][a-z0-9_-]*$/;
const termList = (value, label, errors) => {
  if (!Array.isArray(value)) { errors.push(label + ' must be a list.'); return; }
  for (const entry of value) {
    try { compileTerm(entry); } catch (error) { errors.push(label + ': ' + error.message); continue; }
    for (const field of ['requires', 'unless']) if (typeof entry === 'object' && entry[field] !== undefined && !Array.isArray(entry[field])) errors.push(label + ': ' + field + ' must be a list.');
  }
};
export function digestSettingsErrors(settings, kind) {
  const errors = [], label = 'profile/digest/' + kind + '.json';
  if (settings?.schema_version !== SETTINGS_VERSION || settings.kind !== kind) return [label + ' must declare schema_version ' + SETTINGS_VERSION + ' and kind ' + kind + '.'];
  if (!Array.isArray(settings.interests)) errors.push(label + ' interests must be a list.');
  const ids = new Set();
  for (const interest of settings.interests ?? []) {
    if (!ID.test(interest?.id ?? '') || ids.has(interest.id)) errors.push(label + ' interests need unique lowercase ids.');
    ids.add(interest?.id);
    termList(interest?.keywords ?? [], label + ' ' + interest?.id + ' keywords', errors);
    termList(interest?.weak ?? [], label + ' ' + interest?.id + ' weak', errors);
  }
  termList(settings.core_tokens ?? [], label + ' core_tokens', errors);
  for (const journal of settings.sources?.pubmed?.journals ?? [])
    if (typeof journal?.name !== 'string' || !journal.name.trim() || ![1, 2, 3, 4].includes(journal.tier) || (journal.open_access !== undefined && typeof journal.open_access !== 'boolean'))
      errors.push(label + ' journals need a name, a tier from 1 to 4 and an optional boolean open_access.');
  for (const feed of settings.sources?.rss?.feeds ?? [])
    if (!/^https?:\/\//.test(feed?.url ?? '')) errors.push(label + ' feeds need an http(s) url.');
  if (settings.enabled === true && !(settings.interests ?? []).length) errors.push(label + ' is enabled but lists no interests.');
  return errors;
}
