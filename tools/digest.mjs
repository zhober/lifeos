// Message digests (literature, news, ...): collect → screen → (model scores) → queue → report.
// Personal settings: profile/digest/<kind>.json. Contract and procedure: docs/domains/DIGEST.md, workflows/digest/SKILL.md.
//   node tools/digest.mjs kinds
//   node tools/digest.mjs prepare <kind> [--date YYYY-MM-DD]     collect and screen; prints a compact list, no abstracts
//   node tools/digest.mjs abstracts <kind> <id> [<id> ...]        full original text of up to 15 items
//   node tools/digest.mjs finalize <kind> <input.json>            validate scores/curation, write the report, update queue and history
//   node tools/digest.mjs status <kind>
// prepare only writes scratch files; finalize is the single commit point, so an abandoned run changes nothing.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT, today, addDays, normDate } from './lib.mjs';
import { readJSON, vaultPath, atomicWrite, immutable, withLock, inputJSON, digest, stable } from './store.mjs';
import { getLanguagePreference } from './language.mjs';
import { screen, tokenScan, applyQueue, selectionPool, dimensionHits, compileInterests, cjkShare, translationProblems, itemKeys, SETTINGS_VERSION } from './digest-data.mjs';
import { collectPubmed, collectPreprints, collectFeeds, recoverAbstract, openAccessFullText } from './digest-sources.mjs';

const config = () => readJSON('project.json').digest;
const relative = file => path.relative(ROOT, file).split(path.sep).join('/');
const readJsonFile = file => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
const writeJsonFile = (file, value) => atomicWrite(file, JSON.stringify(value, null, 2) + '\n');
const KIND = /^[a-z][a-z0-9-]*$/;

function kindContext(kind) {
  const shared = config();
  if (!KIND.test(kind ?? '') || !shared.kinds[kind]) throw new Error('Unknown digest kind ' + kind + '. Known: ' + Object.keys(shared.kinds).join(', '));
  const settingsFile = vaultPath(shared.settings_directory + '/' + kind + '.json');
  const settings = readJsonFile(settingsFile);
  if (!settings) throw new Error('No settings for ' + kind + ': ' + relative(settingsFile) + ' (deployment seeds it from templates/digest/).');
  if (settings.schema_version !== SETTINGS_VERSION || settings.kind !== kind) throw new Error(relative(settingsFile) + ' must declare schema_version ' + SETTINGS_VERSION + ' and kind ' + kind + '.');
  const records = vaultPath(shared.records_directory + '/' + kind), reports = vaultPath(shared.reports_directory + '/' + kind);
  return { kind, shared, definition: shared.kinds[kind], settings, settingsFile, records, reports,
    scratch: date => vaultPath((readJSON('project.json').scratch?.directory ?? '.lifeos/tmp') + '/digest/' + kind + '/' + date),
    queueFile: path.join(records, 'queue.json'), archiveFile: path.join(records, 'archive.jsonl'), seenFile: path.join(records, 'seen.jsonl'),
    stateFile: path.join(records, 'state.json'), runFile: date => path.join(records, 'runs', date + '.json') };
}

const lines = file => fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line)) : [];
function seenKeys(context) {
  const keys = new Set();
  for (const row of lines(context.seenFile)) for (const key of row.keys ?? []) keys.add(key);
  for (const entry of [...(readJsonFile(context.queueFile)?.entries ?? []), ...lines(context.archiveFile)]) for (const key of entry.keys ?? [entry.id]) keys.add(key);
  return keys;
}

// The window a source still needs: from the day after its last successful collection (or the configured
// lookback on a first run) to yesterday, never longer than max_window_days. A failed day stays in the window.
function sourceWindow(context, source, date) {
  const okUntil = readJsonFile(context.stateFile)?.sources?.[source]?.ok_until;
  const to = addDays(date, -1), earliest = addDays(date, -context.shared.max_window_days);
  let from = okUntil ? addDays(okUntil, 1) : addDays(date, -(context.settings.lookback_days ?? context.shared.lookback_days));
  if (from < earliest) from = earliest;
  return from > to ? null : { from, to };
}

async function collect(context, date) {
  const { settings, definition } = context, items = [], statuses = {}, windows = {};
  const dimensions = compileInterests(settings);
  const prefilter = item => dimensionHits(dimensions, item.title + ' \n ' + item.abstract).length > 0;
  const run = async (source, collector) => {
    const window = sourceWindow(context, source, date);
    windows[source] = window;
    if (!window) { statuses[source] = { status: 'up_to_date', detail: 'already collected through yesterday' }; return; }
    const result = await collector(window);
    items.push(...result.items);
    Object.assign(statuses, result.statuses ?? { [source]: result.status });
  };
  if (definition.collector === 'literature') {
    if (settings.sources?.pubmed?.enabled !== false) await run('pubmed', window => collectPubmed(settings, window));
    if (settings.sources?.biorxiv?.enabled) await run('biorxiv', window => collectPreprints(settings, window, prefilter));
  }
  if (definition.collector === 'rss' || (settings.sources?.rss?.feeds ?? []).length) await run('rss', window => collectFeeds(settings, window));
  // One item per identity: a preprint and its published version share no identifier, so both may stay.
  const unique = new Map();
  for (const item of items) if (!item.keys.some(key => [...unique.values()].some(other => other.keys.includes(key)))) unique.set(item.id, item);
  return { items: [...unique.values()], statuses, windows };
}

const compact = text => String(text ?? '').length > 110 ? String(text).slice(0, 107) + '...' : String(text ?? '');

async function prepare(kind, date) {
  const context = kindContext(kind);
  if (context.settings.enabled === false) throw new Error(kind + ' digest is disabled in ' + relative(context.settingsFile) + '.');
  if (fs.existsSync(context.runFile(date))) throw new Error('The ' + kind + ' digest for ' + date + ' is already finalized: ' + relative(context.runFile(date)));
  const collected = await collect(context, date);
  const screened = screen(collected.items, context.settings, { seen: seenKeys(context), shortAbstract: context.shared.short_abstract_chars });
  const research = collected.items.filter(item => !screened.excluded.some(row => row.id === item.id) && !screened.duplicates.some(row => row.id === item.id));
  const tokens = tokenScan(research, context.settings.core_tokens);
  const queue = readJsonFile(context.queueFile);
  const watching = (queue?.entries ?? []).filter(entry => entry.status === 'watching')
    .map(entry => ({ id: entry.id, score: entry.score, waiting_days: Math.max(0, Math.round((Date.parse(date) - Date.parse(entry.date_discovered)) / 86400000)), title: compact(entry.title) }));
  const scratch = context.scratch(date);
  fs.mkdirSync(scratch, { recursive: true });
  writeJsonFile(path.join(scratch, 'collected.json'), { kind, date, windows: collected.windows, statuses: collected.statuses, items: collected.items });
  const counts = { collected: collected.items.length, already_seen: screened.duplicates.length, excluded: screened.excluded.length, research: research.length,
    no_abstract: research.filter(item => !item.abstract).length, short_abstract: research.filter(item => item.abstract && item.abstract.length < context.shared.short_abstract_chars).length,
    candidates: screened.candidates.length, title_review: screened.title_review.length,
    by_tier: research.reduce((tiers, item) => ({ ...tiers, ['tier' + item.tier]: (tiers['tier' + item.tier] ?? 0) + 1 }), {}),
    by_source: research.reduce((sources, item) => ({ ...sources, [item.source]: (sources[item.source] ?? 0) + 1 }), {}) };
  const prepared = { kind, date, windows: collected.windows, statuses: collected.statuses, counts, candidates: screened.candidates, title_review: screened.title_review,
    excluded: screened.excluded, token_scan: tokens, queue_watching: watching };
  writeJsonFile(path.join(scratch, 'screened.json'), prepared);
  return { ...prepared,
    candidates: screened.candidates.map(item => ({ id: item.id, tier: item.tier, journal: item.journal, stage: item.stage, basis: item.basis, flags: item.flags, abstract_chars: item.abstract_chars, dimensions: item.dimensions, title: item.title })),
    title_review: screened.title_review.map(item => [item.id, 'T' + item.tier, item.journal, item.title + (item.flags.length ? ' [' + item.flags.join(',') + ']' : '')].join(' | ')),
    excluded: screened.excluded.map(item => item.reason + ' | ' + compact(item.title)),
    scratch: relative(scratch),
    next: 'Score every candidate (and any title-review item you add) 1-5; read abstracts with: node tools/digest.mjs abstracts ' + kind + ' <id...>; then finalize. See workflows/digest/SKILL.md.' };
}

function preparedRun(context, date) {
  const scratch = context.scratch(date), collected = readJsonFile(path.join(scratch, 'collected.json')), screened = readJsonFile(path.join(scratch, 'screened.json'));
  if (!collected || !screened) throw new Error('No prepared ' + context.kind + ' run for ' + date + '; run: node tools/digest.mjs prepare ' + context.kind + ' --date ' + date);
  return { collected, screened, byId: new Map(collected.items.map(item => [item.id, item])) };
}

async function abstracts(kind, ids, date) {
  const context = kindContext(kind), run = preparedRun(context, date), queue = readJsonFile(context.queueFile)?.entries ?? [];
  if (!ids.length || ids.length > 15) throw new Error('Ask for 1 to 15 items at a time.');
  const result = [];
  for (const id of ids) {
    const item = run.byId.get(id) ?? queue.find(entry => entry.id === id);
    if (!item) { result.push({ id, error: 'not in this run or the queue' }); continue; }
    let text = item.abstract;
    if (!text) text = await recoverAbstract(item).catch(() => null);
    result.push({ id, title: item.title, journal: item.journal, tier: item.tier, abstract: text ?? null, ...(text ? {} : { note: 'no abstract available' }) });
  }
  return result;
}

// ---- report rendering -----------------------------------------------------------------------------
const LABELS = {
  zh: { report: '速递', window: '采集窗口', sources: '来源状态', overview: '本期概览', collected: '新采集', seen: '已见过（跳过）', excluded: '非研究条目（剔除）',
    research: '研究条目', noAbstract: '无摘要', shortAbstract: '短摘要（疑似评论/亮点）', candidates: '关键词入围', reviewed: '标题复核', scored: '已评分', selected: '入选',
    queue: '观察队列', journal: '期刊', date: '日期', authors: '一作 / 通讯', source: '来源', newItem: '本期新采集', fromQueue: '观察队列（等待 {n} 天）', rating: '相关性',
    fullText: '全文', savedCopy: '已保存的全文', noFullText: '暂未找到开放获取全文', original: '原文摘要', translation: '译文', assessment: 'AI 研判', finding: '核心发现', keywords: '关键词',
    relevance: '关联度', suggestion: '建议', notes: '评选说明', zero: '零报告说明', tokenScan: '核心词扫描', tokenHits: '命中', none: '无', verdict: '判读',
    channelFailed: '通道故障：{source} 本期未采到，已保留在下次采集窗口中（连续 {n} 次）', channelFallback: '{source} 接口失败，已改用 Europe PMC 获取', queueState: '观察中 {w} 篇；本期新增 {a} 篇，晋升 {p} 篇，过期 {e} 篇',
    generated: '生成时间', tier: 'Tier' },
  en: { report: 'digest', window: 'Collection window', sources: 'Source status', overview: 'Overview', collected: 'Newly collected', seen: 'Already seen (skipped)', excluded: 'Non-research entries (removed)',
    research: 'Research items', noAbstract: 'No abstract', shortAbstract: 'Short abstract (possible comment/highlight)', candidates: 'Keyword candidates', reviewed: 'Title review', scored: 'Scored', selected: 'Selected',
    queue: 'Watch queue', journal: 'Journal', date: 'Date', authors: 'First / last author', source: 'Origin', newItem: 'new this run', fromQueue: 'watch queue ({n} days)', rating: 'Relevance',
    fullText: 'Full text', savedCopy: 'saved copy', noFullText: 'no open-access full text found yet', original: 'Original abstract', translation: 'Translation', assessment: 'Assessment', finding: 'Core finding', keywords: 'Keywords',
    relevance: 'Relevance', suggestion: 'Suggestion', notes: 'Selection notes', zero: 'Zero-selection note', tokenScan: 'Core-token scan', tokenHits: 'hits', none: 'none', verdict: 'Verdict',
    channelFailed: 'Channel failure: {source} returned nothing this run and stays in the next window ({n} run(s) in a row)', channelFallback: '{source} API failed; Europe PMC was used instead', queueState: '{w} watching; {a} added, {p} promoted, {e} expired this run',
    generated: 'Generated', tier: 'Tier' } };
const fill = (text, values) => text.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');
const stars = score => '★'.repeat(score) + '☆'.repeat(5 - score);
const escapeHtml = text => String(text ?? '').replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]);

// Full text: a saved open-access copy, else the free full-text links found, else a plain note.
const fullTextMarkdown = (paper, labels) => [paper.full_text && '[' + labels.savedCopy + '](' + paper.full_text.file + ')', ...(paper.oa_links ?? []).map(link => '[' + link.label + '](' + link.url + ')')].filter(Boolean).join(' · ') || labels.noFullText;
const fullTextHtml = (paper, labels) => [paper.full_text && '<a href="' + escapeHtml(paper.full_text.file) + '">' + escapeHtml(labels.savedCopy) + '</a>',
  ...(paper.oa_links ?? []).map(link => '<a href="' + escapeHtml(link.url) + '">' + escapeHtml(link.label) + '</a>')].filter(Boolean).join(' · ') || escapeHtml(labels.noFullText);

function renderReport(model, labels) {
  const md = [], html = [];
  const head = model.title + ' · ' + model.date;
  md.push('# ' + head, '');
  md.push('> ' + labels.window + ': ' + Object.entries(model.windows).map(([source, window]) => source + ' ' + (window ? window.from + ' – ' + window.to : '—')).join('; '));
  md.push('> ' + labels.sources + ': ' + Object.entries(model.statuses).map(([source, status]) => source + ' ' + status.status).join('; '), '');
  for (const notice of model.notices) md.push('> [!warning] ' + notice, '');
  const overview = [[labels.collected, model.counts.collected], [labels.seen, model.counts.already_seen], [labels.excluded, model.counts.excluded], [labels.research, model.counts.research],
    [labels.noAbstract, model.counts.no_abstract], [labels.shortAbstract, model.counts.short_abstract], [labels.candidates, model.counts.candidates], [labels.scored, model.counts.scored],
    [labels.selected, model.papers.length], ...Object.entries(model.counts.by_tier).sort().map(([tier, count]) => [labels.tier + ' ' + tier.slice(4), count]),
    ...Object.entries(model.counts.by_source).map(([source, count]) => [source, count])];
  model.papers.forEach((paper, index) => {
    md.push('## ' + (index + 1) + '. ' + paper.title, '');
    md.push('- ' + labels.journal + ': ' + paper.journal + ' (' + labels.tier + ' ' + paper.tier + ')' + (paper.published ? ' · ' + labels.date + ': ' + paper.published : ''));
    md.push('- ' + [paper.doi && 'DOI: [' + paper.doi + '](https://doi.org/' + paper.doi + ')', paper.pmid && 'PubMed: [' + paper.pmid + '](https://pubmed.ncbi.nlm.nih.gov/' + paper.pmid + '/)', !paper.doi && !paper.pmid && paper.url && '[' + paper.url + '](' + paper.url + ')'].filter(Boolean).join(' · '));
    if (paper.first_author) md.push('- ' + labels.authors + ': ' + paper.first_author + (paper.last_author && paper.last_author !== paper.first_author ? ' / ' + paper.last_author : ''));
    md.push('- ' + labels.source + ': ' + (paper.from_queue ? fill(labels.fromQueue, { n: paper.waiting_days }) : labels.newItem));
    md.push('- ' + labels.rating + ': ' + stars(paper.score) + (paper.curation.suggestion ? ' · ' + paper.curation.suggestion : ''));
    md.push('- ' + labels.fullText + ': ' + fullTextMarkdown(paper, labels), '');
    md.push('**' + model.originalLabel + '**', '', paper.abstract, '');
    if (paper.curation.translation) md.push('**' + model.translationLabel + '**', '', paper.curation.translation, '');
    md.push('**' + labels.assessment + '**', '', '- ' + labels.finding + ': ' + paper.curation.core_finding);
    if (paper.curation.keywords?.length) md.push('- ' + labels.keywords + ': ' + paper.curation.keywords.join(', '));
    md.push('- ' + labels.relevance + ': ' + paper.curation.relevance, '- ' + labels.suggestion + ': ' + paper.curation.suggestion, '', '---', '');
  });
  if (model.notes) md.push('## ' + (model.papers.length ? labels.notes : labels.zero), '', model.notes, '');
  if (!model.papers.length || model.tokenReview.length) {
    md.push('### ' + labels.tokenScan, '', '`' + model.tokenScan.tokens.join(', ') + '` → ' + model.tokenScan.hits.length + ' ' + labels.tokenHits + ' / ' + model.tokenScan.items_scanned, '');
    for (const hit of model.tokenScan.hits) {
      const review = model.tokenReview.find(row => row.id === hit.id);
      md.push('- ' + hit.title + ' — `' + hit.tokens.join(', ') + '`' + (review ? ' — ' + labels.verdict + ': ' + review.verdict + '（' + review.reason + '）' : ''));
    }
    md.push('');
  }
  md.push('## ' + labels.overview, '', '| | |', '|---|---|', ...overview.map(([label, value]) => '| ' + label + ' | ' + value + ' |'), '');
  md.push('**' + labels.queue + '**: ' + fill(labels.queueState, model.queueState), '');
  md.push('*' + labels.generated + ': ' + model.generated + '*', '');

  html.push('<!doctype html><html lang="' + model.language + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + escapeHtml(head) + '</title>',
    '<style>body{margin:0;background:#f6f5f2;color:#1f2328;font:15px/1.65 system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}main{max-width:860px;margin:0 auto;padding:24px 16px}',
    'h1{font-size:1.5rem;margin:0 0 .4rem}.meta{color:#5b616b;font-size:.85rem}.warn{background:#fff4e5;border-left:4px solid #e8a33d;padding:8px 12px;margin:10px 0;border-radius:4px}',
    'article{background:#fff;border:1px solid #e3e1db;border-radius:10px;padding:16px 18px;margin:16px 0}article h2{font-size:1.1rem;margin:0 0 .5rem}dl{display:grid;grid-template-columns:max-content 1fr;gap:2px 12px;margin:0 0 12px;font-size:.88rem}dt{color:#5b616b}dd{margin:0}',
    '.stars{color:#c98a12;letter-spacing:1px}h3{font-size:.95rem;margin:14px 0 4px;color:#3a4250}p{margin:.3rem 0}.assess{background:#f3f6fb;border-radius:8px;padding:8px 12px}table{border-collapse:collapse;font-size:.88rem}td{border-bottom:1px solid #e3e1db;padding:4px 14px 4px 0}a{color:#1a5fb4}',
    '@media (prefers-color-scheme:dark){body{background:#17181b;color:#e6e6e6}article{background:#202226;border-color:#33363c}.assess{background:#262b33}.warn{background:#3a2f1c}.meta,dt{color:#9aa1ab}a{color:#7fb0ff}td{border-color:#33363c}}</style></head><body><main>');
  html.push('<h1>' + escapeHtml(head) + '</h1><p class="meta">' + escapeHtml(labels.window) + ': ' + escapeHtml(Object.entries(model.windows).map(([source, window]) => source + ' ' + (window ? window.from + ' – ' + window.to : '—')).join('; '))
    + '<br>' + escapeHtml(labels.sources) + ': ' + escapeHtml(Object.entries(model.statuses).map(([source, status]) => source + ' ' + status.status).join('; ')) + '</p>');
  for (const notice of model.notices) html.push('<div class="warn">' + escapeHtml(notice) + '</div>');
  model.papers.forEach((paper, index) => {
    const links = [paper.doi && '<a href="https://doi.org/' + escapeHtml(paper.doi) + '">DOI ' + escapeHtml(paper.doi) + '</a>', paper.pmid && '<a href="https://pubmed.ncbi.nlm.nih.gov/' + escapeHtml(paper.pmid) + '/">PubMed ' + escapeHtml(paper.pmid) + '</a>',
      !paper.doi && !paper.pmid && paper.url && '<a href="' + escapeHtml(paper.url) + '">' + escapeHtml(paper.url) + '</a>'].filter(Boolean).join(' · ');
    html.push('<article><h2>' + (index + 1) + '. ' + escapeHtml(paper.title) + '</h2><dl>',
      '<dt>' + escapeHtml(labels.journal) + '</dt><dd>' + escapeHtml(paper.journal) + ' (' + labels.tier + ' ' + paper.tier + ')' + (paper.published ? ' · ' + escapeHtml(paper.published) : '') + '</dd>',
      '<dt>Links</dt><dd>' + links + '</dd>', paper.first_author ? '<dt>' + escapeHtml(labels.authors) + '</dt><dd>' + escapeHtml(paper.first_author + (paper.last_author && paper.last_author !== paper.first_author ? ' / ' + paper.last_author : '')) + '</dd>' : '',
      '<dt>' + escapeHtml(labels.source) + '</dt><dd>' + escapeHtml(paper.from_queue ? fill(labels.fromQueue, { n: paper.waiting_days }) : labels.newItem) + '</dd>',
      '<dt>' + escapeHtml(labels.rating) + '</dt><dd><span class="stars">' + stars(paper.score) + '</span> ' + escapeHtml(paper.curation.suggestion) + '</dd>',
      '<dt>' + escapeHtml(labels.fullText) + '</dt><dd>' + fullTextHtml(paper, labels) + '</dd></dl>',
      '<h3>' + escapeHtml(model.originalLabel) + '</h3><p>' + escapeHtml(paper.abstract) + '</p>',
      paper.curation.translation ? '<h3>' + escapeHtml(model.translationLabel) + '</h3><p>' + escapeHtml(paper.curation.translation) + '</p>' : '',
      '<h3>' + escapeHtml(labels.assessment) + '</h3><div class="assess"><p><b>' + escapeHtml(labels.finding) + '</b>: ' + escapeHtml(paper.curation.core_finding) + '</p>'
      + (paper.curation.keywords?.length ? '<p><b>' + escapeHtml(labels.keywords) + '</b>: ' + escapeHtml(paper.curation.keywords.join(', ')) + '</p>' : '')
      + '<p><b>' + escapeHtml(labels.relevance) + '</b>: ' + escapeHtml(paper.curation.relevance) + '</p><p><b>' + escapeHtml(labels.suggestion) + '</b>: ' + escapeHtml(paper.curation.suggestion) + '</p></div></article>');
  });
  if (model.notes) html.push('<article><h2>' + escapeHtml(model.papers.length ? labels.notes : labels.zero) + '</h2>' + model.notes.split(/\n{2,}/).map(part => '<p>' + escapeHtml(part) + '</p>').join('') + '</article>');
  if (!model.papers.length || model.tokenReview.length) html.push('<article><h2>' + escapeHtml(labels.tokenScan) + '</h2><p><code>' + escapeHtml(model.tokenScan.tokens.join(', ')) + '</code> → ' + model.tokenScan.hits.length + ' ' + escapeHtml(labels.tokenHits) + ' / ' + model.tokenScan.items_scanned + '</p><ul>'
    + model.tokenScan.hits.map(hit => { const review = model.tokenReview.find(row => row.id === hit.id); return '<li>' + escapeHtml(hit.title) + ' — <code>' + escapeHtml(hit.tokens.join(', ')) + '</code>' + (review ? ' — ' + escapeHtml(labels.verdict + ': ' + review.verdict + ' (' + review.reason + ')') : '') + '</li>'; }).join('') + '</ul></article>');
  html.push('<article><h2>' + escapeHtml(labels.overview) + '</h2><table>' + overview.map(([label, value]) => '<tr><td>' + escapeHtml(label) + '</td><td>' + escapeHtml(value) + '</td></tr>').join('') + '</table><p>' + escapeHtml(labels.queue + ': ' + fill(labels.queueState, model.queueState)) + '</p></article>');
  html.push('<p class="meta">' + escapeHtml(labels.generated + ': ' + model.generated) + '</p></main></body></html>');
  return { markdown: md.join('\n'), html: html.join('\n') + '\n' };
}

// ---- finalize ---------------------------------------------------------------------------------------
const needsTranslation = (text, language) => language.startsWith('zh') ? cjkShare(text) < 0.3 : cjkShare(text) > 0.3;
const slug = text => String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'item';

async function finalize(kind, inputFile) {
  const context = kindContext(kind), input = inputJSON(inputFile), date = normDate(input.date);
  const fingerprint = digest(stable(input)), runFile = context.runFile(date), previous = readJsonFile(runFile);
  if (previous) {
    if (previous.input_hash === fingerprint) return { replay: true, ...previous.outputs };
    throw new Error('The ' + kind + ' digest for ' + date + ' was already finalized with different input: ' + relative(runFile));
  }
  const run = preparedRun(context, date), queue = readJsonFile(context.queueFile) ?? { entries: [] };
  const rules = context.shared.queue, cap = context.settings.report?.cap ?? context.shared.report_cap;
  const language = getLanguagePreference().interaction_language, errors = [];
  const scores = new Map();
  for (const row of input.scores ?? []) {
    if (!Number.isInteger(row.score) || row.score < 1 || row.score > 5 || typeof row.reason !== 'string' || !row.reason.trim()) errors.push('Score ' + row.id + ': integer 1-5 and a reason are required.');
    else if (!run.byId.has(row.id) && !queue.entries.some(entry => entry.id === row.id && entry.status === 'watching')) errors.push('Score ' + row.id + ': not in this run or the watch queue.');
    else scores.set(row.id, row);
  }
  for (const candidate of run.screened.candidates) if (!scores.has(candidate.id)) errors.push('Every keyword candidate needs a score; missing ' + candidate.id + '.');
  const scored = [...scores.values()].filter(row => run.byId.has(row.id)).map(row => {
    const item = run.byId.get(row.id);
    return { id: item.id, keys: item.keys, source: item.source, title: item.title, abstract: item.abstract, journal: item.journal, tier: item.tier, published: item.published,
      doi: item.doi, pmid: item.pmid, pmcid: item.pmcid, url: item.url, jatsxml: item.jatsxml, version: item.version, open_access: item.open_access, first_author: item.first_author, last_author: item.last_author,
      score: row.score, dims: row.dims ?? [], reason: row.reason };
  });
  for (const row of scores.values()) { const entry = queue.entries.find(item => item.id === row.id); if (entry && !run.byId.has(row.id)) { entry.score = row.score; entry.reason = row.reason; } }
  const pool = new Map(selectionPool(queue, scored, date, rules.min_score).map(item => [item.id, item]));
  const selected = input.selected ?? [];
  if (selected.length > cap) errors.push('At most ' + cap + ' items per report.');
  const papers = [];
  for (const curation of selected) {
    const item = pool.get(curation.id);
    if (!item) { errors.push('Selected ' + curation.id + ' is not a scored item (≥' + rules.min_score + ') of this run or a watching queue entry.'); continue; }
    let abstract = item.abstract;
    if (!abstract) abstract = await recoverAbstract(item).catch(() => null);
    if (!abstract) { errors.push('Selected ' + curation.id + ' has no abstract; queue it instead (a paper without an abstract cannot fill a report slot).'); continue; }
    for (const field of ['core_finding', 'relevance', 'suggestion']) if (typeof curation[field] !== 'string' || !curation[field].trim()) errors.push('Selected ' + curation.id + ' needs ' + field + '.');
    if (context.settings.report?.translate !== false && needsTranslation(abstract, language))
      for (const problem of translationProblems(abstract, curation.translation ?? '')) errors.push('Selected ' + curation.id + ': ' + problem + '.');
    papers.push({ ...item, abstract, curation });
  }
  if (new Set(selected.map(row => row.id)).size !== selected.length) errors.push('An item is selected twice.');
  if (selected.length < 4 && !(typeof input.notes === 'string' && input.notes.trim())) errors.push('With fewer than 4 selected items, notes must explain why (and name the adjacent directions used).');
  const tokens = run.screened.token_scan, reviews = input.token_review ?? [];
  if (!selected.length) for (const hit of tokens.hits)
    if (!reviews.some(row => row.id === hit.id && ['true_positive', 'false_positive'].includes(row.verdict) && row.reason)) errors.push('Zero selection: review core-token hit ' + hit.id + ' (verdict true_positive|false_positive and a reason).');
  if (errors.length) throw new Error('Digest not finalized:\n- ' + errors.join('\n- '));

  // Network work happens before the lock; everything inside it is synchronous file writing.
  const fullTexts = new Map();
  if (context.settings.report?.full_text !== false) for (const [index, paper] of papers.entries()) {
    const text = await openAccessFullText(paper).catch(error => ({ text: null, links: [], detail: error.message }));
    paper.oa_links = text.links ?? [];
    if (text.text) {
      paper.full_text = { file: 'fulltext/' + (index + 1) + '-' + slug(paper.title) + '.txt', source: text.source };
      fullTexts.set(paper.full_text.file, '# ' + paper.title + '\n# ' + text.source + '\n\n' + text.text + '\n');
    }
  }
  return withLock('digest:' + kind, () => {
    if (fs.existsSync(runFile)) throw new Error('The ' + kind + ' digest for ' + date + ' was finalized concurrently: ' + relative(runFile));
    const reportDirectory = path.join(context.reports, date);
    fs.mkdirSync(reportDirectory, { recursive: true });
    for (const [name, text] of fullTexts) atomicWrite(path.join(reportDirectory, name), text);
    const { queue: nextQueue, archived } = applyQueue(queue, { date, scored, selected: selected.map(row => row.id), rules });
    const before = new Map(queue.entries.map(entry => [entry.id, entry.status]));
    const queueState = { w: nextQueue.entries.filter(entry => entry.status === 'watching').length,
      a: nextQueue.entries.filter(entry => entry.status === 'watching' && !before.has(entry.id)).length,
      p: nextQueue.entries.filter(entry => entry.status === 'promoted' && before.get(entry.id) !== 'promoted').length + archived.filter(entry => entry.promoted_on === date && before.get(entry.id) !== 'promoted').length,
      e: nextQueue.entries.filter(entry => entry.status === 'expired' && before.get(entry.id) !== 'expired').length };
    const history = fs.existsSync(path.join(context.records, 'runs')) ? fs.readdirSync(path.join(context.records, 'runs')).filter(name => name.endsWith('.json')).sort().map(name => readJsonFile(path.join(context.records, 'runs', name))) : [];
    const labels = LABELS[language.startsWith('zh') ? 'zh' : 'en'], notices = [];
    for (const [source, status] of Object.entries(run.collected.statuses)) {
      if (status.status === 'failed') {
        let streak = 1; for (const previousRun of history.slice().reverse()) { if (previousRun.statuses?.[source]?.status === 'failed') streak++; else break; }
        notices.push(fill(labels.channelFailed, { source, n: streak }));
      } else if (status.status === 'ok_via_europepmc') notices.push(fill(labels.channelFallback, { source }));
    }
    const settingsReport = context.settings.report ?? {};
    const model = { title: context.settings.label ?? kind + ' ' + labels.report, date, language, windows: run.collected.windows, statuses: run.collected.statuses, notices,
      counts: { ...run.screened.counts, scored: scores.size }, papers, notes: input.notes?.trim() || null, tokenScan: tokens, tokenReview: reviews, queueState,
      originalLabel: settingsReport.original_label ?? labels.original, translationLabel: settingsReport.translation_label ?? labels.translation, generated: new Date().toISOString() };
    const { markdown, html } = renderReport(model, labels);
    atomicWrite(path.join(reportDirectory, 'report.md'), markdown);
    atomicWrite(path.join(reportDirectory, 'report.html'), html);
    writeJsonFile(context.queueFile, nextQueue);
    if (archived.length) fs.appendFileSync(context.archiveFile, archived.map(entry => JSON.stringify(entry)).join('\n') + '\n');
    fs.appendFileSync(context.seenFile, run.collected.items.map(item => JSON.stringify({ id: item.id, keys: item.keys, first_seen: date })).join('\n') + (run.collected.items.length ? '\n' : ''));
    const state = readJsonFile(context.stateFile) ?? { sources: {} };
    for (const [source, window] of Object.entries(run.collected.windows)) {
      const statusKeys = Object.keys(run.collected.statuses).filter(key => key === source || key.startsWith(source + ':'));
      const ok = statusKeys.length && statusKeys.every(key => ['ok', 'empty', 'ok_via_europepmc'].includes(run.collected.statuses[key].status));
      if (window && ok) state.sources[source] = { ...(state.sources[source] ?? {}), ok_until: window.to };
    }
    state.last_run = date;
    writeJsonFile(context.stateFile, state);
    const outputs = { markdown: relative(path.join(reportDirectory, 'report.md')), html: relative(path.join(reportDirectory, 'report.html')),
      full_text: papers.filter(paper => paper.full_text).map(paper => relative(path.join(reportDirectory, paper.full_text.file))), selected: papers.length, queue: queueState };
    immutable(relative(runFile), { schema_version: 1, kind, date, input_hash: fingerprint, recorded_at: new Date().toISOString(), windows: run.collected.windows, statuses: run.collected.statuses,
      counts: model.counts, selected: papers.map(paper => paper.id), scores: [...scores.values()], token_review: reviews, outputs });
    return { replay: false, ...outputs };
  });
}

function status(kind) {
  const context = kindContext(kind), queue = readJsonFile(context.queueFile)?.entries ?? [];
  const runs = fs.existsSync(path.join(context.records, 'runs')) ? fs.readdirSync(path.join(context.records, 'runs')).filter(name => name.endsWith('.json')).sort() : [];
  return { kind, enabled: context.settings.enabled !== false, collector: context.definition.collector, settings: relative(context.settingsFile),
    interests: (context.settings.interests ?? []).map(interest => interest.id), sources: readJsonFile(context.stateFile)?.sources ?? {},
    queue: { watching: queue.filter(entry => entry.status === 'watching').length, promoted: queue.filter(entry => entry.status === 'promoted').length, expired: queue.filter(entry => entry.status === 'expired').length },
    runs: runs.length, last_run: runs.at(-1)?.replace(/\.json$/, '') ?? null };
}

function kinds() {
  const shared = config();
  return Object.entries(shared.kinds).map(([kind, definition]) => {
    const settings = readJsonFile(vaultPath(shared.settings_directory + '/' + kind + '.json'));
    return { kind, collector: definition.collector, label: settings?.label ?? definition.label ?? kind, configured: !!settings, enabled: settings ? settings.enabled !== false : false,
      interests: (settings?.interests ?? []).length, sources: settings ? Object.keys(settings.sources ?? {}).filter(source => source !== 'rss' || (settings.sources.rss.feeds ?? []).length) : [] };
  });
}

const [command, kind, ...rest] = process.argv.slice(2);
const dateAt = rest.indexOf('--date'), date = normDate(dateAt < 0 ? today() : rest[dateAt + 1]);
const args = dateAt < 0 ? rest : rest.filter((_, index) => index !== dateAt && index !== dateAt + 1);
try {
  let result;
  if (command === 'kinds') result = kinds();
  else if (command === 'prepare') result = await prepare(kind, date);
  else if (command === 'abstracts') result = await abstracts(kind, args, date);
  else if (command === 'finalize') result = await finalize(kind, args[0]);
  else if (command === 'status') result = status(kind);
  else throw new Error('Usage: node tools/digest.mjs kinds | prepare <kind> [--date D] | abstracts <kind> <id...> [--date D] | finalize <kind> <input.json> | status <kind>');
  console.log(JSON.stringify(result, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
