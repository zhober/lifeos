// User-facing report labels and offline text/HTML views. No remote content is loaded.
import { readJSON } from './store.mjs';
// The recipe covers every view, including text-only archives, so presentation changes create a new bundle.
export const REPORT_LAYOUT_VERSION = 7;
export function reportPresentationRecipe() {
  const config = readJSON('project.json').reporting;
  const priority = config.cover_domain_priority ?? ['nutrition', 'health', 'fitness', 'career', 'study', 'psych', 'finance', 'shopping', 'travel'];
  const limit = config.cover_card_limit ?? 4;
  if (!Array.isArray(priority) || !priority.length || new Set(priority).size !== priority.length || priority.some(domain => !config.domains.includes(domain))
    || !Number.isInteger(limit) || limit < 1 || limit > 4) throw new Error('Invalid shared report cover settings.');
  return { layout_version: REPORT_LAYOUT_VERSION, cover_domain_priority: priority, cover_card_limit: limit };
}
// Display-only projection of already permitted normalized data. Never delete or modify the authoritative report.
export function reportForDisplay(report) {
  return { ...report, metrics: report.metrics.filter(metric => metric.value != null),
    sections: report.sections.filter(section => section.items.length), trends: report.trends.filter(trend => trend.points.some(point => point.value != null)) };
}
export function reportCoverCards(report, recipe = reportPresentationRecipe()) {
  const view = reportForDisplay(report), cards = [], preferred = {
    nutrition: ['kcal', 'protein', 'water_ml', 'carb', 'fat'], health: ['sleep_h', 'sleep_quality', 'weight_kg'], fitness: ['exercise_min', 'steps'],
    career: ['work_h'], study: ['study_min'], psych: ['mood', 'energy', 'stress']
  };
  const domains = [...new Set([...recipe.cover_domain_priority, ...view.metrics.map(item => item.domain), ...view.sections.map(item => item.domain)])];
  for (const domain of domains) {
    const metric = (preferred[domain] ?? []).map(id => view.metrics.find(item => item.id === id && item.domain === domain)).find(Boolean) ?? view.metrics.find(item => item.domain === domain);
    const note = view.sections.find(section => section.domain === domain)?.items[0];
    if (metric) cards.push({ ...metric, type: 'metric' });
    else if (note) cards.push({ type: 'note', domain, label: domainName(domain, labels(report.language)), ...note });
    if (cards.length === recipe.cover_card_limit) break;
  }
  // When fewer domains have information, other known quantities can fill the remaining slots.
  for (const metric of view.metrics) {
    if (cards.length === recipe.cover_card_limit) break;
    if (!cards.some(card => card.type === 'metric' && card.id === metric.id)) cards.push({ ...metric, type: 'metric' });
  }
  return cards;
}
export const labels = language => language.startsWith('zh') ? {
  snapshot: '这一天，留下了什么', snapshotNote: '把记录收好，把下一步看清。', actionPreview: '行动小结', actionDetail: '接下来，逐件看清',
  dataDetail: '生活的数字切片', domainDetail: '把这一天展开', evidenceDetail: '留一点空白，也留好线索',
  detailNote: '记录各有侧重；这些数字不组成健康或效率评分。', trendNote: '实心点是记录值；空心点表示未记录，缺口两侧不连线。',
  actionNote: '按已有状态展示，不自动安排优先级或重启暂停事项。', recordsNote: '保留原记录含义；计划、提议和实际发生分别看。',
  sourceFooter: '来源与校验信息保存在 report.json。', continued: '续', allActions: '全部状态见后续行动页',
  ratingNote: '原量表自评', foodNote: '饮食部分记录不能代表全天摄入。', date: '日期', summary: '记录与分析',
  visibilityNote: '只展示已有信息；没展示的不代表当天没发生。', emptyReport: '本日暂无可展示的记录。',
  units: { h: '小时', min: '分钟', steps: '步' },
  title: '每日数据与行动报告', fictional: '虚构数据样例 · 不代表用户真实情况', overview: '数据概览', actions: '行动进展', followups: '后续事项与专家协作',
  domains: '各领域记录', trends: '近七日已有记录', gaps: '记录缺口与限制', unknown: '未记录 / 未确认', withheld: '未纳入本报告',
  recorded: '有记录', missing: '未见可汇总记录', metric: '指标', value: '记录值', note: '说明', task: '行动', status: '状态', due: '期限', owner: '负责人',
  scope: '数字按已有记录汇总，不一定是全天完整数据；没记录不等于零，接受建议不等于已经做完。', actionScope: '行动状态截取至报告日结束；关联请求状态按生成时检查。状态更新时间不等于实际执行日期。',
  emptyActions: '未见可纳入的行动记录；不据此推断当天没有行动。', emptyFollowups: '未见有来源的待处理事项。', emptyGaps: '本报告未检测到额外结构性缺口；这不代表记录完整或现实情况已核验。',
  inferred: '推断', plain: { estimated: '估算', inferred: '推断', legacy_unverified: '待核对', partial: '未记全', unknown: '不确定是否记全' },
  proposed: '建议 / 未接受', accepted: '已接受 / 完成待确认', in_progress: '进行中', completed: '已反馈完成', deferred: '已推迟', declined: '已拒绝', cancelled: '已取消',
  active: '可继续', waiting: '关联请求等待中', paused: '关联请求已暂停', superseded: '关联请求已替换', requestCompleted: '原咨询已完成',
  attention: '已过原期限，未见完成依据', page: '页', generated: '生成于', rangeNote: '估算区间', sleepDate: '昨夜睡眠按醒来日期记载：',
  domain: { career: '工作与职业', study: '学习', nutrition: '饮食与营养', fitness: '运动', health: '睡眠与健康', finance: '财务', shopping: '购物与物品', psych: '情绪与人际', travel: '旅行' },
  gap: { journal_missing: '当天日志不存在；没有补造记录。', mixed_sources_require_scoped_context: '混合记录未自动汇总；本报告遵守当前披露范围。', privacy_excluded: '部分内容未纳入本报告。',
    source_changed_or_unavailable: '来源已变化或不可用，相关内容暂未计入。', nutrition_conflict: '营养记录存在矛盾，相关总量待核对。', nutrition_day_not_confirmed_complete: '饮食全天覆盖未确认；小计不代表全天摄入。',
    fitness_link_changed: '运动记录链接已变化，需要核对来源。', linked_task_unavailable: '关联任务状态无法核对。', nutrition_records_unavailable: '营养资料暂不可读取；其他领域继续汇总。',
    fitness_records_unavailable: '运动资料暂不可读取；没有采用旧缓存冒充新数据。', coordination_records_unavailable: '协作状态暂无法核对。', metric_unit_or_scale_unconfirmed: '单位或评分口径无法核对，相关指标保留未知。' }
} : {
  snapshot: 'Pieces of a day', snapshotNote: 'Keep the moments. See the next steps.', actionPreview: 'Action snapshot', actionDetail: 'A closer look at next steps',
  dataDetail: 'Life in recorded numbers', domainDetail: 'Unfold the day', evidenceDetail: 'Room for gaps, a trail to the sources',
  detailNote: 'These records are not a health or productivity score.', trendNote: 'Filled dots are recorded values; hollow dots mark missing data. Lines stop at gaps.',
  actionNote: 'Existing states, with no automatic priority or resuming paused requests.', recordsNote: 'Plans, proposals and actual events stay distinct.',
  sourceFooter: 'Sources and checksums: report.json', continued: 'continued', allActions: 'Full states on the action pages',
  ratingNote: 'Original self-rating scale', foodNote: 'Partial food records are not full-day intake.', date: 'Date', units: {}, summary: 'Observations & analysis',
  visibilityNote: 'Only available information is shown; omitted items do not imply inactivity.', emptyReport: 'No displayable records for this day.',
  title: 'Daily data & action report', fictional: 'Fictional demonstration — not user facts', overview: 'Data overview', actions: 'Action progress', followups: 'Follow-ups & expert coordination',
  domains: 'Domain records', trends: 'Seven-day recorded values', gaps: 'Coverage & limitations', unknown: 'Unknown / unrecorded', withheld: 'Not included',
  recorded: 'Recorded', missing: 'No available record', metric: 'Metric', value: 'Recorded value', note: 'Note', task: 'Action', status: 'Status', due: 'Due', owner: 'Owner',
  scope: 'Figures come from existing records and may not cover the whole day. Missing is not zero; accepting a suggestion is not doing it.', actionScope: 'Action states use the report-day cutoff; related request state is checked at generation. Capture time is not actual execution time.',
  emptyActions: 'No included action records; no inference of inactivity.', emptyFollowups: 'No sourced follow-ups found.', emptyGaps: 'No additional structural gap detected; this does not certify complete or true records.',
  inferred: 'Inferred', plain: { estimated: 'Estimate', inferred: 'Inferred', legacy_unverified: 'Unverified', partial: 'Partial record', unknown: 'Coverage unknown' },
  proposed: 'Proposed', accepted: 'Accepted, not completed', in_progress: 'In progress', completed: 'Reported completed', deferred: 'Deferred', declined: 'Declined', cancelled: 'Cancelled',
  active: 'Active', waiting: 'Request waiting', paused: 'Request paused', superseded: 'Request replaced', requestCompleted: 'Consultation completed', attention: 'Past stated due date, completion not evidenced', page: 'Page', generated: 'Generated', rangeNote: 'Estimated range', sleepDate: 'Last-night sleep uses its waking date: ',
  domain: { career: 'Work & career', study: 'Study', nutrition: 'Food & nutrition', fitness: 'Exercise', health: 'Sleep & health', finance: 'Finance', shopping: 'Shopping & possessions', psych: 'Mood & interaction', travel: 'Travel' },
  gap: { journal_missing: 'Journal missing; no records fabricated.', mixed_sources_require_scoped_context: 'Mixed records were not automatically loaded under disclosure restrictions.', privacy_excluded: 'Some contents are not included.',
    source_changed_or_unavailable: 'Source changed or unavailable; associated contents excluded.', nutrition_conflict: 'Nutrition claims conflict.', nutrition_day_not_confirmed_complete: 'Full-day intake is not confirmed; subtotals are not daily intake.',
    fitness_link_changed: 'Exercise source link changed.', linked_task_unavailable: 'Linked task state unavailable.', nutrition_records_unavailable: 'Nutrition records unavailable; other domains continue.',
    fitness_records_unavailable: 'Exercise records unavailable; old cache not substituted.', coordination_records_unavailable: 'Coordination state unavailable.', metric_unit_or_scale_unconfirmed: 'Unit or rating scale unconfirmed; affected metric stays unknown.' }
};
export const valueText = (metric, l) => metric.value == null ? l.unknown : metric.unit === '1–5' ? metric.value + '/5' : metric.range && metric.range.low !== metric.range.high ? `${metric.range.low} – ${metric.range.high} ${metric.unit}` : `${metric.value} ${metric.unit === 'steps' && l.title.startsWith('每日') ? '步' : metric.unit}`;
// Plain qualifiers for human views: only estimates, inferences, unverified records and partial/unknown coverage are labeled.
// Sources, hashes and full evidence/coverage codes stay in report.json.
export const plainNote = (item, l) => [l.plain[item.evidence], item.coverage ? l.plain[item.coverage] : null].filter(Boolean).join(' · ');
export const domainName = (domain, l) => l.domain[domain] ?? domain;
export const actionLabel = (action, l) => (l[action.status] ?? action.status) + (['paused', 'waiting', 'cancelled', 'superseded'].includes(action.request_state) ? ' / ' + l[action.request_state] : '') + (action.attention ? ' / ' + l.attention : '');
export const displayValue = (metric, l) => {
  if (metric.value == null) return l.unknown;
  if (metric.unit === '1–5') return metric.value + '/5';
  const number = metric.range && metric.range.low !== metric.range.high ? metric.range.low + ' – ' + metric.range.high : metric.value;
  return number + ' ' + (l.units[metric.unit] ?? metric.unit);
};
export const domainPalette = domain => ({
  career: { accent: '#9A532E', pale: '#FBEBDD', icon: 'work' }, study: { accent: '#49689A', pale: '#EAF0FB', icon: 'book' },
  nutrition: { accent: '#A76522', pale: '#FCF0D7', icon: 'food' }, fitness: { accent: '#287B65', pale: '#E5F3E9', icon: 'activity' },
  health: { accent: '#78639C', pale: '#F0EBF8', icon: 'moon' }, finance: { accent: '#55765B', pale: '#ECF2E8', icon: 'wallet' },
  shopping: { accent: '#A45C73', pale: '#FAEAF0', icon: 'bag' }, psych: { accent: '#A15762', pale: '#F9E9E7', icon: 'chat' },
  travel: { accent: '#397B86', pale: '#E5F2F4', icon: 'compass' }
}[domain] ?? { accent: '#66716D', pale: '#EDF0ED', icon: 'note' });
export const actionPalette = action => ['paused', 'cancelled', 'superseded'].includes(action.request_state) ? { accent: '#776887', pale: '#F0ECF5' }
  : action.status === 'completed' ? { accent: '#287B65', pale: '#E5F3E9' }
  : ['deferred', 'declined', 'cancelled'].includes(action.status) ? { accent: '#776887', pale: '#F0ECF5' }
  : { accent: '#9A6227', pale: '#FCF0D7' };
// Conservative presentation of simple pipe tables; ambiguous/escaped content keeps its original text.
export function recordBlocks(text) {
  const rows = String(text).trim().split('\n');
  if (rows.length < 2 || rows.some(row => !row.trim().startsWith('|') || !row.trim().endsWith('|') || row.includes('\\|'))) return [{ type: 'text', text: String(text) }];
  const cells = rows.map(row => row.trim().slice(1, -1).split('|').map(cell => cell.trim()));
  const headers = cells.shift(), data = cells.filter(row => !row.every(cell => /^:?-{3,}:?$/.test(cell)));
  if (!data.length || data.some(row => row.length !== headers.length) || headers.some(header => !header)) return [{ type: 'text', text: String(text) }];
  return [{ type: 'table', headers, rows: data }];
}
const md = text => String(text ?? '').replaceAll('|', '\\|').replaceAll('\n', '<br>');
export function reportMarkdown(report, recipe = reportPresentationRecipe()) {
  report = reportForDisplay(report);
  const l = labels(report.language), prefix = item => l.plain[item.evidence] ? l.plain[item.evidence] + ': ' : '';
  const out = ['# ' + report.date + ' · ' + l.title, '', '> ' + l.snapshotNote, '', ...(report.basis === 'fictional' ? ['**' + l.fictional + '**', ''] : []), l.scope, '', l.visibilityNote, ''];
  if (report.sleep_context) out.push(l.sleepDate + report.sleep_context.wake_date, '');
  if (!report.metrics.length && !report.sections.length && !report.actions.length && !report.followups.length && !report.summary.length && !report.trends.length) out.push(l.emptyReport, '');
  if (report.metrics.length) {
    out.push('## ' + l.overview, '', '| ' + [l.metric, l.value, l.note].join(' | ') + ' |', '|---|---|---|');
    report.metrics.forEach(item => out.push('| ' + [item.label, valueText(item, l), plainNote(item, l)].map(md).join(' | ') + ' |'));
  }
  if (report.actions.length) {
    out.push('', '## ' + l.actions, '', l.actionScope, '', '| ' + [l.task, l.status, l.due, l.owner].join(' | ') + ' |', '|---|---|---|---|');
    report.actions.forEach(item => out.push('| ' + [item.text, actionLabel(item, l), item.due ?? l.unknown, item.owner].map(md).join(' | ') + ' |'));
  }
  if (report.followups.length) out.push('', '## ' + l.followups, '', ...report.followups.map(item => '- ' + item.text));
  if (report.summary.length) out.push('', '## ' + l.summary, '', ...report.summary.map(item => '- ' + (item.kind === 'hypothesis' ? l.inferred + ': ' : '') + item.text));
  if (report.sections.length) out.push('', '## ' + l.domains, '');
  for (const section of report.sections) {
    out.push('### ' + domainName(section.domain, l), '', l[section.status] ?? section.status, '');
    section.items.forEach(item => out.push(prefix(item) + item.text, ''));
  }
  if (report.trends.length) out.push('', '## ' + l.trends, '');
  for (const trend of report.trends) out.push('### ' + trend.label, '', ...trend.points.map(point => '- ' + point.date + ': ' + (point.value == null ? l.unknown : point.value + ' ' + trend.unit)), '');
  if (report.gaps.length) out.push('', '## ' + l.gaps, '', ...report.gaps.map(gap => '- ' + (gap.domain ? domainName(gap.domain, l) + ': ' : '') + (l.gap[gap.code] ?? gap.code)));
  out.push('', '---', '', l.sourceFooter);
  return out.join('\n') + '\n';
}
export const escapeHTML = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
export function reportHTML(report, recipe = reportPresentationRecipe()) {
  report = reportForDisplay(report);
  const l = labels(report.language), e = escapeHTML, meta = text => text ? '<p class="meta">' + e(text) + '</p>' : '';
  const style = p => ' style="--accent:' + p.accent + ';--pale:' + p.pale + '"';
  const table = (headers, rows) => '<div class="table-wrap"><table><thead><tr>' + headers.map(header => '<th>' + e(header) + '</th>').join('') + '</tr></thead><tbody>' +
    rows.map(row => '<tr>' + row.map(cell => '<td>' + e(cell).replaceAll('\n', '<br>') + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
  const metric = item => '<article class="metric"' + style(domainPalette(item.domain)) + '><div class="label">' + e(item.label) + '</div><div class="number' + (item.value == null ? ' unknown' : '') + '">' + e(displayValue(item, l)) +
    '</div>' + meta(plainNote(item, l)) + '</article>';
  const note = item => (l.plain[item.evidence] ? '<span class="badge">' + e(l.plain[item.evidence]) + '</span> ' : '') +
    recordBlocks(item.text).map(block => block.type === 'table' ? table(block.headers, block.rows) : '<p class="record">' + e(block.text).replaceAll('\n', '<br>') + '</p>').join('');
  let sectionNumber = 0;
  const heading = (_number, title, sub = '') => '<header class="section-title"><span>' + String(++sectionNumber).padStart(2, '0') + '</span><div><h2>' + e(title) + '</h2>' + (sub ? '<p class="meta">' + e(sub) + '</p>' : '') + '</div></header>';
  const css = "\n*{box-sizing:border-box}body{margin:0;background:#eceee7;color:#303d38;font-family:\"Microsoft YaHei\",\"PingFang SC\",sans-serif;line-height:1.65}\nmain{max-width:1080px;margin:30px auto;background:#fcfaf6;padding:36px;border-radius:20px}p{margin:10px 0}h1,h2,h3{font-weight:600}h1{font-size:clamp(27px,4vw,42px);margin:12px 0 4px}h2{margin:0;font-size:25px}h3{margin:0;font-size:17px}\n.hero{padding:26px 30px;background:#f5e7d5;border-radius:18px;position:relative;overflow:hidden}.brand{font-size:12px;letter-spacing:2px;color:#8b633b}.hero .date{font-size:25px;color:#8b633b}.hero p{color:#7d6b55}\n.sun{position:absolute;right:48px;top:55px;width:72px;height:72px;border-radius:50%;background:#e6bc75}.sun:after{content:\"\";position:absolute;width:110px;height:10px;border-top:2px solid #b8905d;border-bottom:2px solid #b8905d;left:-19px;top:55px}\n.demo{padding:10px 14px;background:#faedd1;border-radius:9px;color:#906326}.meta{font-size:12px;color:#6e7971;overflow-wrap:anywhere}.scope{padding:8px 0}.section-title{display:flex;align-items:flex-start;gap:15px;margin:34px 0 18px}.section-title>span{background:#e4ede3;border-radius:7px;padding:4px 9px;color:#477761;font-size:13px;margin-top:5px}\n.metric-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.cover-grid{grid-template-columns:repeat(var(--cover-columns),minmax(0,1fr));margin-top:20px}.metric{background:var(--pale);padding:18px;border-radius:13px;min-width:0;border-top:3px solid var(--accent)}.metric .label{color:var(--accent);font-size:13px}.metric .number{font-size:29px;line-height:1.4;margin:12px 0;overflow-wrap:anywhere}.metric .unknown{font-size:16px;color:#6e7971}\n.action{border-radius:13px;background:var(--pale);padding:18px 22px;margin:12px 0}.action header,.domain header{display:flex;gap:10px;align-items:center;color:var(--accent)}.action .record{font-size:17px}.badge{display:inline-block;border-radius:6px;background:#fff9;padding:2px 8px;font-size:12px;color:var(--accent,#78639c)}.record{white-space:normal;overflow-wrap:anywhere}\n.domain-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.domain{min-width:0;border:1px solid #e5e5da;border-top:3px solid var(--accent);background:#fff;padding:18px 20px;border-radius:11px}.domain header .meta{margin-left:auto}.domain .record{font-size:14px}\n.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:12px;line-height:1.55}th,td{text-align:left;vertical-align:top;border-bottom:1px solid #e5e5da;padding:8px;min-width:55px}th{background:#f1f4ee;font-weight:400}ul{padding-left:22px}.gaps{padding:12px 18px;background:#faedd1;border-radius:10px;color:#906326}.footer{border-top:1px solid #e5e5da;padding-top:16px;margin-top:30px;font-size:12px;color:#6e7971}\n@media(max-width:720px){main{margin:0;padding:18px;border-radius:0}.hero{padding:22px}.sun{opacity:.3;right:25px;top:85px}.metric-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.cover-grid{grid-template-columns:repeat(var(--cover-mobile-columns),minmax(0,1fr))}.metric .number{font-size:23px}.domain-grid{grid-template-columns:1fr}h2{font-size:22px}}\n@media print{body{background:#fff}main{margin:0;padding:0;border-radius:0}article,.hero{break-inside:avoid}h2,h3{break-after:avoid}.section-title{break-after:avoid}.domain-grid{display:block}.domain{margin-bottom:14px}thead{display:table-header-group}tr{break-inside:avoid}}\n";
  const cover = reportCoverCards(report, recipe);
  const coverCard = item => item.type === 'metric' ? metric(item) : '<article class="metric"' + style(domainPalette(item.domain)) + '><div class="label">' + e(item.label) +
    '</div><div class="number">' + e(l.recorded) + '</div><p class="record">' + e(item.text.length > 140 ? item.text.slice(0, 140) + ' …' : item.text) + '</p>' + meta(plainNote(item, l)) + '</article>';
  const empty = !report.metrics.length && !report.sections.length && !report.actions.length && !report.followups.length && !report.summary.length && !report.trends.length;
  return '<!doctype html><html lang="' + e(report.language) + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'"><title>' +
    e(report.date + ' ' + l.title) + '</title><style>' + css + '</style></head><body><main><header class="hero"><span class="brand">LifeOS / DAILY NOTES</span><h1>' + e(l.snapshot) + '</h1><div class="date">' + e(report.date) +
    '</div><p>' + e(l.snapshotNote) + '</p><div class="sun" aria-hidden="true"></div></header>' + (report.basis === 'fictional' ? '<p class="demo">' + e(l.fictional) + '</p>' : '') +
    '<div class="scope"><p>' + e(l.title) + '</p>' + (report.sleep_context ? '<p class="meta">' + e(l.sleepDate + report.sleep_context.wake_date) + '</p>' : '') +
    '<p class="meta">' + e(l.scope) + '</p><p class="meta">' + e(l.visibilityNote) + '</p></div>' + (empty ? '<p class="meta">' + e(l.emptyReport) + '</p>' : '') +
    (cover.length ? '<div class="metric-grid cover-grid" style="--cover-columns:' + cover.length + ';--cover-mobile-columns:' + Math.min(2, cover.length) + '">' + cover.map(coverCard).join('') + '</div>' : '') +
    (report.actions.length ? heading('01', l.actionDetail, l.actionScope) + report.actions.map(item => '<article class="action"' + style(actionPalette(item)) + '><header><h3>' + e(domainName(item.domain, l)) +
      '</h3></header><p class="record">' + e(item.text) + '</p><span class="badge">' + e(actionLabel(item, l)) + '</span>' + meta(l.due + ': ' + (item.due ?? l.unknown) + ' · ' + l.owner + ': ' + item.owner) + '</article>').join('') : '') +
    (report.followups.length ? heading('02', l.followups, l.actionNote) + report.followups.map(item => '<article class="action"' + style(domainPalette(item.domain)) + '><header><h3>' +
      e(domainName(item.domain, l)) + '</h3></header><p>' + e(item.text) + '</p></article>').join('') : '') +
    (report.summary.length ? heading('02', l.summary) + report.summary.map(item => '<article class="action"' + style(domainPalette(item.domain ?? 'health')) + '><span class="badge">' +
      e(item.kind === 'hypothesis' ? l.inferred : l.recorded) + '</span><p>' + e(item.text) + '</p></article>').join('') : '') +
    (report.metrics.length ? heading('03', l.dataDetail, l.detailNote) + '<div class="metric-grid">' + report.metrics.map(metric).join('') + '</div>' : '') +
    (report.trends.length ? heading('04', l.trends, l.trendNote) + '<div class="domain-grid">' + report.trends.map(trend => '<article class="domain"' + style(domainPalette(trend.domain)) + '><h3>' +
      e(trend.label) + '</h3>' + table([l.date, l.value], trend.points.map(point => [point.date, point.value == null ? l.unknown : point.value + ' ' + (l.units[trend.unit] ?? trend.unit)])) + '</article>').join('') + '</div>' : '') +
    (report.sections.length ? heading('05', l.domainDetail, l.recordsNote) + '<div class="domain-grid">' + report.sections.map(section => '<article class="domain"' + style(domainPalette(section.domain)) + '><header><h3>' +
      e(domainName(section.domain, l)) + '</h3><span class="meta">' + e(l[section.status] ?? section.status) + '</span></header>' + section.items.map(note).join('') + '</article>').join('') + '</div>' : '') +
    (report.gaps.length ? heading('06', l.gaps) + '<div class="gaps"><ul>' + report.gaps.map(gap => '<li>' + e((gap.domain ? domainName(gap.domain, l) + ': ' : '') + (l.gap[gap.code] ?? gap.code)) + '</li>').join('') + '</ul></div>' : '') +
    '<footer class="footer">LifeOS / ' + e(report.date) + ' · ' + e(l.sourceFooter) + '</footer></main></body></html>';
}
