// User-facing report labels and offline text/HTML views. No remote content is loaded.
import { readJSON } from './store.mjs';
// The recipe covers every view, including text-only archives, so presentation changes create a new bundle.
export const REPORT_LAYOUT_VERSION = 14;
export function reportPresentationRecipe() {
  const config = readJSON('project.json').reporting;
  const priority = config.cover_domain_priority ?? ['nutrition', 'health', 'fitness', 'career', 'study', 'psych', 'finance', 'shopping', 'travel'];
  const limit = config.cover_card_limit ?? 4;
  if (!Array.isArray(priority) || !priority.length || new Set(priority).size !== priority.length || priority.some(domain => !config.domains.includes(domain))
    || !Number.isInteger(limit) || limit < 1 || limit > 4) throw new Error('Invalid shared report cover settings.');
  return { layout_version: REPORT_LAYOUT_VERSION, cover_domain_priority: priority, cover_card_limit: limit };
}
// Display-only projection of already permitted normalized data. Never delete or modify the authoritative report.
// Human views show one number per metric: no estimate ranges, no estimate/coverage labels (those stay in report.json), whole-number kcal/g/mg.
const DISPLAY_ROUND_UNITS = new Set(['kcal', 'g', 'mg']);
const DISPLAY_DROP_COLUMNS = new Set(['食物', '克数', '来源', 'Food', 'Grams', 'Source']);
const MEAL_ORDER = [['早餐', 'breakfast'], ['上午加餐', 'morning snack'], ['午餐', 'lunch'], ['下午加餐', 'afternoon snack'], ['晚餐', 'dinner'], ['夜宵', 'late-night snack'], ['加餐', 'snack']];
const mealRank = cell => { const key = String(cell).toLowerCase(), n = MEAL_ORDER.findIndex(names => names.includes(key)); return n < 0 ? MEAL_ORDER.length : n; };
// Collected meal tables use Chinese column names; English views translate the header row only.
const TABLE_HEADERS_EN = { '时间': 'Time', '餐次': 'Meal', '蛋白g': 'Protein g', '脂肪g': 'Fat g', '碳水g': 'Carb g' };
const MEAL_HEADERS = { meal: ['餐次', 'Meal'], p: ['蛋白g', 'Protein g'], f: ['脂肪g', 'Fat g'], c: ['碳水g', 'Carb g'] };
const englishHeaders = text => {
  const rows = String(text).split('\n');
  if (!rows[0]?.trim().startsWith('|')) return text;
  rows[0] = rows[0].split('|').map(cell => TABLE_HEADERS_EN[cell.trim()] ? ' ' + TABLE_HEADERS_EN[cell.trim()] + ' ' : cell).join('|');
  return rows.join('\n');
};
const simpleMetric = metric => ({ ...metric, label: String(metric.label).replace(/记录$/, ''), range: null, evidence: metric.evidence === 'estimated' ? null : metric.evidence, coverage: null,
  value: typeof metric.value === 'number' && DISPLAY_ROUND_UNITS.has(metric.unit) ? Math.round(metric.value) : metric.value });
// Meal tables keep time/meal/numbers only; food descriptions, grams and source links are dropped from the human views.
function simpleText(text) {
  const rows = String(text).trim().split('\n');
  if (rows.length < 2 || rows.some(row => !row.trim().startsWith('|') || !row.trim().endsWith('|') || row.includes('\\|'))) return text;
  const cells = rows.map(row => row.trim().slice(1, -1).split('|').map(cell => cell.trim()));
  const body = cells.slice(1).filter(row => !row.every(cell => /^:?-{3,}:?$/.test(cell)));
  const keep = cells[0].map((header, i) => DISPLAY_DROP_COLUMNS.has(header) || body.every(row => !row[i]) ? -1 : i).filter(i => i >= 0);
  if (keep.length === cells[0].length || !keep.length || cells.some(row => row.length !== cells[0].length)) return text;
  const round = cell => /^-?\d+\.\d+$/.test(cell) ? String(Math.round(Number(cell))) : cell;
  const mealColumn = cells[0].indexOf('餐次'), order = mealRank;
  const rowsOut = mealColumn < 0 ? body : [...body].sort((a, b) => order(a[mealColumn]) - order(b[mealColumn]));
  const line = row => '| ' + row.join(' | ') + ' |';
  return [line(keep.map(i => cells[0][i])), line(keep.map(() => '---')), ...rowsOut.map(row => line(keep.map(i => round(row[i]))))].join('\n');
}
// Compare the day's recorded totals with the user's own targets (report.targets). Rule-based; nothing beyond the numbers is inferred.
// Totals are recorded values, so an excess is certain while a shortfall only reads 'recorded so far'; calories are never flagged as low.
const ADVICE_RULES = [
  { key: 'energy_kcal', id: 'kcal', unit: 'kcal', name: { zh: '热量', en: 'Energy' },
    over: { zh: (v, g) => '热量 ' + v + ' kcal，比目标上限多 ' + Math.round(v - g.high) + ' kcal。先减油炒、煎炸的菜，主食保持不变。', en: (v, g) => 'Energy ' + v + ' kcal, ' + Math.round(v - g.high) + ' kcal above your upper target. Cut fried or oily dishes first; keep the staple food.' } },
  { key: 'protein_g', id: 'protein', unit: 'g', name: { zh: '蛋白质', en: 'Protein' },
    over: { zh: (v, g) => '蛋白质 ' + v + ' g，已超过目标上限 ' + g.high + ' g，多出的部分可以换成蔬菜或主食。', en: (v, g) => 'Protein ' + v + ' g, above your upper target of ' + g.high + ' g. Swap the extra for vegetables or staples.' },
    under: { zh: (v, g) => '蛋白质 ' + v + ' g，离目标下限还差 ' + Math.round(g.low - v) + ' g。每餐加一份肉、蛋或豆制品。', en: (v, g) => 'Protein ' + v + ' g, ' + Math.round(g.low - v) + ' g short of your target. Add a portion of meat, eggs or soy to each meal.' } },
  { key: 'fat_g', id: 'fat', unit: 'g', name: { zh: '脂肪', en: 'Fat' },
    over: { zh: (v, g) => '脂肪 ' + v + ' g，比目标上限多 ' + Math.round(v - g.high) + ' g。少一道油炒或煎炸的菜，换成清蒸、水煮或卤的。', en: (v, g) => 'Fat ' + v + ' g, ' + Math.round(v - g.high) + ' g above your upper target. Replace one fried dish with a steamed, boiled or braised one.' } },
  { key: 'carb_g', id: 'carb', unit: 'g', name: { zh: '碳水', en: 'Carbs' },
    over: { zh: (v, g) => '碳水 ' + v + ' g，高于目标上限 ' + g.high + ' g。主食收到目标范围内。', en: (v, g) => 'Carbs ' + v + ' g, above your upper target of ' + g.high + ' g. Bring staples back into range.' },
    under: { zh: (v, g) => '碳水 ' + v + ' g，低于目标下限 ' + g.low + ' g。训练日主食别减，练前练后各吃一份。', en: (v, g) => 'Carbs ' + v + ' g, below your target of ' + g.low + ' g. Keep staples on training days: one portion before and one after.' } },
  { key: 'fiber_g', id: 'fiber', unit: 'g', name: { zh: '膳食纤维', en: 'Fiber' },
    under: { zh: (v, g) => '膳食纤维 ' + v + ' g，离 ' + g.low + ' g 还差 ' + Math.round(g.low - v) + ' g。每餐加一份深色蔬菜，主食换一部分杂粮。', en: (v, g) => 'Fiber ' + v + ' g, ' + Math.round(g.low - v) + ' g short of ' + g.low + ' g. Add dark leafy vegetables to each meal and swap some staples for whole grains.' } },
  { key: 'sodium_mg', id: 'na', unit: 'mg', name: { zh: '钠', en: 'Sodium' },
    over: { zh: (v, g) => '钠 ' + v + ' mg，高于 ' + g.high + ' mg。少喝汤，卤汁和酱汁少蘸。', en: (v, g) => 'Sodium ' + v + ' mg, above ' + g.high + ' mg. Drink less soup and go easy on sauces.' } },
  { key: 'sleep_h', id: 'sleep_h', unit: 'h', name: { zh: '睡眠', en: 'Sleep' },
    under: { zh: (v, g) => '睡眠 ' + v + ' 小时，低于 ' + g.low + ' 小时。想办法提前半小时睡。', en: (v, g) => 'Sleep ' + v + ' h, below ' + g.low + ' h. Try going to bed half an hour earlier.' } }
];
// A total that misses some items' values (missing_items > 0) is only a lower bound: it may show an excess, never a shortfall.
export function dayAdvice(report) {
  const flags = [], ok = [], targets = report.targets, lang = String(report.language ?? 'en').startsWith('zh') ? 'zh' : 'en';
  if (!targets) return { flags, ok };
  for (const rule of ADVICE_RULES) {
    const goal = targets[rule.key], metric = report.metrics.find(item => item.id === rule.id), raw = metric?.value;
    if (!goal || raw == null) continue;
    const v = rule.unit === 'h' ? raw : Math.round(raw), lowerBound = metric.missing_items > 0;
    if (goal.high != null && raw > goal.high) { if (rule.over) flags.push({ level: 'high', metric: rule.id, text: rule.over[lang](v, goal) }); continue; }
    if (goal.low != null && raw < goal.low) { if (rule.under && !lowerBound) flags.push({ level: 'low', metric: rule.id, text: rule.under[lang](v, goal) }); continue; }
    ok.push({ metric: rule.id, text: rule.name[lang] + ' ' + v + ' ' + (rule.unit === 'h' && lang === 'zh' ? '小时' : rule.unit) });
  }
  return { flags, ok };
}
export function reportForDisplay(report) {
  const l = labels(report.language ?? 'en'), english = !String(report.language ?? 'en').startsWith('zh');
  // The latest parseable sleep paragraph wins: after a morning sleep event that is last night's device detail.
  const sleepItem = report.sections.filter(section => section.domain === 'health').flatMap(section => section.items).map(item => parseSleep(item.text)).filter(Boolean).pop() ?? null;
  return { ...report, advice: dayAdvice(report), sleep_detail: sleepItem, metrics: report.metrics.filter(metric => metric.value != null).map(simpleMetric),
    sections: report.sections.filter(section => section.items.length).filter(section => !(report.training?.length && section.domain === 'fitness')).map(section => ({ ...section, items: section.items.filter(item => !/主观睡眠质量未报告。$/.test(item.text) && !(sleepItem && /^昨夜睡眠分析/.test(item.text))).map(item => {
      const sleep = section.domain === 'health' ? parseSleep(item.text) : null;
      const plain = sleep ? sleepTable(sleep, l) : simpleText(item.text).replace('（未扣除入睡耗时或夜醒）', '').replace(/[；;]\s*来源：[^\n]*?(?=\n|$)/g, '。');
      return { ...item, text: english && !sleep ? englishHeaders(plain) : plain, sleep, evidence: item.evidence === 'estimated' ? null : item.evidence, coverage: null };
    }) })),
    trends: report.trends.map(trend => ({ ...trend, points: trend.points.filter(point => point.value != null) })).filter(trend => trend.points.length >= 2), gaps: [] };
}

// Sleep paragraph written by quick-log/import -> numbers. Returns null unless the essentials are present, so free text is never misread.
export function parseSleep(text) {
  const s = String(text), get = (re, i = 1) => { const m = re.exec(s); return m ? m[i] : null; };
  const bed = get(/(\d{1,2}:\d{2})\s*入睡/), wake = get(/(\d{1,2}:\d{2})\s*起床/);
  let dm = /睡眠总时长\s*(\d+)时(\d+)分/.exec(s);
  if (!dm) { const approx = /约\s*(\d+(?:\.\d+)?)\s*小时/.exec(s); if (approx) { const total = Math.round(Number(approx[1]) * 60); dm = [null, String(Math.floor(total / 60)), String(total % 60)]; } }
  if (!bed || !wake || !dm) return null;
  const stage = name => { const m = new RegExp(name + '\\s*(\\d+)%（(\\d+时\\d+分)）').exec(s); return m ? { pct: Number(m[1]), time: m[2] } : null; };
  const num = re => { const v = get(re); return v == null ? null : Number(v); };
  return { bed, wake, hours: Number(dm[1]), minutes: Number(dm[2]), deep: stage('深睡'), light: stage('浅睡'), rem: stage('快速眼动'),
    efficiency: num(/睡眠效率\s*(\d+)%/), awakenings: num(/清醒\s*(\d+)\s*次/), score: num(/睡眠评分\s*(\d+)/), heart_rate: num(/平均心率\s*(\d+)/) };
}
const sleepTable = (d, l) => {
  const T = l.chart;
  const cols = [[T.bed, d.bed], [T.wakeUp, d.wake], [T.duration, d.hours + T.hUnit + d.minutes + T.mUnit],
    ...(d.deep ? [[T.deep, d.deep.pct + '%']] : []), ...(d.light ? [[T.light, d.light.pct + '%']] : []), ...(d.rem ? [[T.rem, d.rem.pct + '%']] : []),
    ...(d.efficiency != null ? [[T.eff, d.efficiency + '%']] : []), ...(d.score != null ? [[T.score, String(d.score)]] : [])];
  return '| ' + cols.map(c => c[0]).join(' | ') + ' |\n| ' + cols.map(() => '---').join(' | ') + ' |\n| ' + cols.map(c => c[1]).join(' | ') + ' |';
};
// Inline-SVG charts for the HTML view (no external assets). Data comes only from the already simplified display report.
function parseMeals(report) {
  const section = report.sections.find(s => s.domain === 'nutrition'), meals = [];
  for (const item of section?.items ?? []) {
    const rows = String(item.text).split('\n').filter(row => row.trim().startsWith('|')).map(row => row.trim().slice(1, -1).split('|').map(c => c.trim()));
    if (rows.length < 2) continue;
    const at = names => rows[0].findIndex(cell => [].concat(names).includes(cell)), col = { meal: at(MEAL_HEADERS.meal), kcal: at('kcal'), p: at(MEAL_HEADERS.p), f: at(MEAL_HEADERS.f), c: at(MEAL_HEADERS.c) };
    if (Object.values(col).some(i => i < 0)) continue;
    for (const row of rows.slice(1)) {
      if (row.every(cell => /^:?-{3,}:?$/.test(cell))) continue;
      const num = i => Number(row[i]);
      if ([col.kcal, col.p, col.f, col.c].some(i => !Number.isFinite(num(i)))) continue;
      meals.push({ meal: row[col.meal], kcal: num(col.kcal), p: num(col.p), f: num(col.f), c: num(col.c) });
    }
  }
  return meals;
}
export const CHART_COLORS = { kcal: '#C98A2B', protein: '#287B65', fat: '#D06A5A', carb: '#49689A', sleep: '#78639C', deep: '#4B3F8C', light: '#8E7DBE', rem: '#C9B8E8' };
// Numbers behind every chart, shared by the HTML and PDF views so they cannot disagree.
export function chartModel(report) {
  const meals = parseMeals(report), metricValue = id => report.metrics.find(m => m.id === id)?.value;
  const total = meals.reduce((sum, m) => sum + m.kcal, 0), dayKcal = metricValue('kcal') ?? total;
  const g = { protein: metricValue('protein') ?? meals.reduce((sum, m) => sum + m.p, 0), fat: metricValue('fat') ?? meals.reduce((sum, m) => sum + m.f, 0), carb: metricValue('carb') ?? meals.reduce((sum, m) => sum + m.c, 0) };
  const energy = { protein: g.protein * 4, carb: g.carb * 4, fat: g.fat * 9 }, sum = energy.protein + energy.carb + energy.fat;
  const week = report.trends.find(trend => trend.metric_id === 'sleep_h');
  return { meals, dayKcal, macro: meals.length && sum > 0 ? { g, energy, sum, order: ['protein', 'carb', 'fat'] } : null,
    sleep: report.sleep_detail ?? null, week: week && week.points.length >= 2 ? week.points : null,
    training: report.training?.length ? report.training : null };
}
// Training labels: short name (no bracketed notes) and one meta string per activity.
export const trainingName = name => String(name).replace(/[（(][^）)]*[）)]/g, '').trim() || String(name);
export const trainingMeta = (activity, l = labels('zh')) => [activity.sets ? activity.sets + l.chart.sets + (activity.reps ? ' × ' + activity.reps + l.chart.reps : '') : null,
  activity.minutes ? activity.minutes + l.chart.minutes : null, activity.load].filter(Boolean).join(' · ');
const trainingTotals = training => { const rows = training.flatMap(session => session.activities); return { activities: rows.length, sets: rows.reduce((sum, row) => sum + (row.sets ?? 0), 0) }; };
export const trainingSummary = (training, l = labels('zh')) => { const totals = trainingTotals(training); return l.chart.activities(totals.activities) + (totals.sets ? ' · ' + totals.sets + l.chart.sets : ''); };
export const cardColumns = count => count <= 3 ? Math.max(1, count) : count === 4 ? 2 : 3;
function chartsHTML(report, e) {
  const l = labels(report.language ?? 'en'), T = l.chart;
  const card = (title, body, foot) => '<article class="chart"><h3>' + e(title) + '</h3><div class="c-body">' + body + '</div><div class="c-foot">' + (foot ?? '') + '</div></article>';
  const model = chartModel(report), cards = [];
  if (model.meals.length) {
    const meals = model.meals, max = Math.max(...meals.map(m => m.kcal)), rowH = 44, h = meals.length * rowH;
    // Label column wide enough for the longest meal name (CJK about 11 px, Latin about 6 px at the label size).
    const labelW = Math.min(110, Math.max(46, ...meals.map(m => [...String(m.meal)].reduce((w, ch) => w + (/[\u2E80-\uFFFF]/.test(ch) ? 11 : 6), 0) + 8))), barMax = 236 - labelW;
    const bars = meals.map((m, i) => {
      const w = Math.max(6, Math.round(m.kcal / max * barMax)), y = 8 + i * rowH;
      return '<text x="0" y="' + (y + 20) + '" class="c-label">' + e(m.meal) + '</text><rect x="' + labelW + '" y="' + y + '" width="' + w + '" height="28" rx="7" fill="' + CHART_COLORS.kcal + '"/>' +
        '<text x="' + (labelW + w + 8) + '" y="' + (y + 20) + '" class="c-value">' + Math.round(m.kcal) + '</text>';
    }).join('');
    cards.push(card(T.meals, '<svg viewBox="0 0 300 ' + (h + 12) + '" role="img" aria-label="' + e(T.meals) + '">' + bars + '</svg>', e(T.day) + ' <b>' + Math.round(model.dayKcal) + '</b> ' + e(T.kcal)));
  }
  if (model.macro) {
    const { g, energy, sum, order } = model.macro;
    let offset = 25;
    const arcs = order.map(key => {
      const share = energy[key] / sum * 100, out = '<circle cx="21" cy="21" r="15.915" fill="none" stroke="' + CHART_COLORS[key] + '" stroke-width="7" stroke-dasharray="' + share.toFixed(2) + ' ' + (100 - share).toFixed(2) + '" stroke-dashoffset="' + offset.toFixed(2) + '"/>';
      offset -= share; return out;
    }).join('');
    const donut = '<svg viewBox="0 0 42 42" class="donut" role="img" aria-label="' + e(T.macro) + '"><circle cx="21" cy="21" r="15.915" fill="none" stroke="#ece6da" stroke-width="7"/>' + arcs +
      '<text x="21" y="22.5" text-anchor="middle" class="donut-num">' + Math.round(model.dayKcal) + '</text><text x="21" y="28" text-anchor="middle" class="donut-unit">' + e(T.kcal) + '</text></svg>';
    const legend = '<div class="legend">' + order.map(key => '<span><i class="dot" style="background:' + CHART_COLORS[key] + '"></i>' + e(T[key]) + ' ' + Math.round(g[key]) + 'g ' + Math.round(energy[key] / sum * 100) + '%</span>').join('') + '</div>';
    cards.push(card(T.macro, donut, legend));
  }
  if (model.training) {
    const rows = model.training.flatMap(session => session.activities);
    const body = '<div class="tr-list">' + rows.map(activity => '<div class="tr-row"><span class="tr-name">' + e(trainingName(activity.name)) + '</span><span class="tr-dots">' +
      (activity.sets ? '●'.repeat(Math.min(activity.sets, 8)) : '') + '</span><span class="tr-meta">' + e(trainingMeta(activity, l)) + '</span></div>').join('') + '</div>';
    cards.push(card(T.training, body, e(trainingSummary(model.training, l))));
  }
  const sd = model.sleep;
  if (sd) {
    const parts = [['deep', sd.deep], ['light', sd.light], ['rem', sd.rem]].filter(([, v]) => v);
    const stack = parts.length ? '<div class="stack">' + parts.map(([k, v]) => '<span style="width:' + v.pct + '%;background:' + CHART_COLORS[k] + '"></span>').join('') + '</div>' +
      '<div class="stack-legend">' + parts.map(([k, v]) => '<span><i class="dot" style="background:' + CHART_COLORS[k] + '"></i>' + e(T[k]) + ' ' + v.pct + '%<small>' + e(v.time) + '</small></span>').join('') + '</div>' : '';
    const body = '<div class="sleep-main"><div class="big">' + sd.hours + '<small>' + e(T.hUnit) + '</small>' + sd.minutes + '<small>' + e(T.mUnit) + '</small></div><div class="sleep-range">' + e(sd.bed) + ' → ' + e(sd.wake) + '</div>' + stack + '</div>';
    const chips = [sd.efficiency != null ? T.eff + ' ' + sd.efficiency + '%' : null, sd.score != null ? T.score + ' ' + sd.score : null, sd.heart_rate != null ? T.hr + ' ' + sd.heart_rate : null, sd.awakenings != null ? T.wake + ' ' + sd.awakenings + T.times : null].filter(Boolean);
    cards.push(card(T.stages, body, '<div class="chips">' + chips.map(c => '<span class="chip">' + e(c) + '</span>').join('') + '</div>'));
  }
  if (model.week) {
    const pts = model.week, max = Math.max(9, ...pts.map(pt => pt.value)), slot = 300 / pts.length, bw = Math.min(26, slot * 0.6);
    const cols = pts.map((pt, i) => {
      const h = Math.max(4, pt.value / max * 100), x = i * slot + (slot - bw) / 2;
      return '<rect x="' + x.toFixed(1) + '" y="' + (112 - h).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="5" fill="' + CHART_COLORS.sleep + '"/>' +
        '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (106 - h).toFixed(1) + '" text-anchor="middle" class="c-value">' + pt.value + '</text>' +
        '<text x="' + (x + bw / 2).toFixed(1) + '" y="130" text-anchor="middle" class="c-label">' + e(pt.date.slice(5)) + '</text>';
    }).join('');
    const mean = pts.reduce((sum, pt) => sum + pt.value, 0) / pts.length;
    cards.push(card(T.week, '<svg viewBox="0 0 300 136" role="img" aria-label="' + e(T.week) + '">' + cols + '</svg>', e(T.avg) + ' <b>' + mean.toFixed(1) + '</b> ' + e(T.h)));
  }
  return cards.length ? '<div class="chart-grid" style="--cols:' + cardColumns(cards.length) + '">' + cards.join('') + '</div>' : '';
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
  chart: { meals: '每餐热量', kcal: 'kcal', macro: '热量来源', protein: '蛋白质', fat: '脂肪', carb: '碳水', week: '近几日睡眠', stages: '睡眠结构', deep: '深睡', light: '浅睡', rem: '快速眼动',
    day: '全天', avg: '平均', h: '小时', eff: '效率', score: '评分', hr: '心率', wake: '清醒', times: ' 次', training: '训练', hUnit: '时', mUnit: '分', bed: '入睡', wakeUp: '起床', duration: '时长',
    sets: ' 组', reps: ' 次', minutes: ' 分钟', activities: n => '共 ' + n + ' 个动作', trainingCols: ['动作', '组数', '次数', '重量'],
    advice: '不足与改进', allGood: '没有需要提示的项目。', met: '达标', sep: '、', high: '偏高', low: '偏低' },
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
  ratingNote: 'Original self-rating scale', foodNote: 'Partial food records are not full-day intake.', date: 'Date', units: {},
  chart: { meals: 'Energy per meal', kcal: 'kcal', macro: 'Energy sources', protein: 'Protein', fat: 'Fat', carb: 'Carbs', week: 'Recent sleep', stages: 'Sleep', deep: 'Deep', light: 'Light', rem: 'REM',
    day: 'Day total', avg: 'Average', h: 'h', eff: 'Efficiency', score: 'Score', hr: 'Heart rate', wake: 'Awake', times: '×', training: 'Training', hUnit: 'h', mUnit: 'm', bed: 'Asleep', wakeUp: 'Woke', duration: 'Duration',
    sets: ' sets', reps: ' reps', minutes: ' min', activities: n => n + (n === 1 ? ' exercise' : ' exercises'), trainingCols: ['Exercise', 'Sets', 'Reps', 'Load'],
    advice: 'Shortfalls & improvements', allGood: 'Nothing flagged against your targets.', met: 'On target', sep: ', ', high: 'High', low: 'Low' }, summary: 'Observations & analysis',
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
  const number = metric.range && metric.range.low !== metric.range.high ? metric.range.low + ' – ' + metric.range.high : (metric.missing_items > 0 ? '≥ ' : '') + metric.value;
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
  const out = ['# ' + report.date + ' · ' + l.title, '', ...(report.basis === 'fictional' ? ['**' + l.fictional + '**', ''] : [])];
  if (report.sleep_context) out.push(l.sleepDate + report.sleep_context.wake_date, '');
  if (!report.metrics.length && !report.sections.length && !report.actions.length && !report.followups.length && !report.summary.length && !report.trends.length) out.push(l.emptyReport, '');
  if (report.metrics.length) {
    out.push('## ' + l.overview, '', '| ' + [l.metric, l.value].join(' | ') + ' |', '|---|---|');
    report.metrics.forEach(item => out.push('| ' + [item.label, valueText(item, l)].map(md).join(' | ') + ' |'));
  }
  if (report.advice && (report.advice.flags.length || report.advice.ok.length)) {
    out.push('', '## ' + l.chart.advice, '');
    if (report.advice.flags.length) report.advice.flags.forEach(item => out.push('- [' + l.chart[item.level] + '] ' + item.text)); else out.push('- ' + l.chart.allGood);
    if (report.advice.ok.length) out.push('', l.chart.met + ': ' + report.advice.ok.map(item => item.text).join(l.chart.sep));
  }
  if (report.training?.length) {
    out.push('', '## ' + l.chart.training, '', '| ' + l.chart.trainingCols.join(' | ') + ' |', '| --- | --- | --- | --- |');
    report.training.flatMap(session => session.activities).forEach(activity => out.push('| ' + [trainingName(activity.name), activity.sets ?? (activity.minutes ? activity.minutes + l.chart.minutes : '—'), activity.reps ?? '—', activity.load ?? '—'].join(' | ') + ' |'));
  }
  if (report.actions.length) {
    out.push('', '## ' + l.actions, '', l.actionScope, '', '| ' + [l.task, l.status, l.due, l.owner].join(' | ') + ' |', '|---|---|---|---|');
    report.actions.forEach(item => out.push('| ' + [item.text, actionLabel(item, l), item.due ?? l.unknown, item.owner].map(md).join(' | ') + ' |'));
  }
  if (report.followups.length) out.push('', '## ' + l.followups, '', ...report.followups.map(item => '- ' + item.text));
  if (report.summary.length) out.push('', '## ' + l.summary, '', ...report.summary.map(item => '- ' + (item.kind === 'hypothesis' ? l.inferred + ': ' : '') + item.text));
  if (report.sections.length) out.push('', '## ' + l.domains, '');
  for (const section of report.sections) {
    out.push('### ' + domainName(section.domain, l), '');
    section.items.forEach(item => out.push(prefix(item) + item.text, ''));
  }
  if (report.trends.length) out.push('', '## ' + l.trends, '');
  for (const trend of report.trends) out.push('### ' + trend.label, '', ...trend.points.map(point => '- ' + point.date + ': ' + (point.value == null ? l.unknown : point.value + ' ' + trend.unit)), '');
  if (report.gaps.length) out.push('', '## ' + l.gaps, '', ...report.gaps.map(gap => '- ' + (gap.domain ? domainName(gap.domain, l) + ': ' : '') + (l.gap[gap.code] ?? gap.code)));
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
  const css = "\n*{box-sizing:border-box}body{margin:0;background:#eceee7;color:#303d38;font-family:\"Microsoft YaHei\",\"PingFang SC\",sans-serif;line-height:1.65}\nmain{max-width:1080px;margin:30px auto;background:#fcfaf6;padding:36px;border-radius:20px}p{margin:10px 0}h1,h2,h3{font-weight:600}h1{font-size:clamp(27px,4vw,42px);margin:12px 0 4px}h2{margin:0;font-size:25px}h3{margin:0;font-size:17px}\n.hero{padding:26px 30px;background:#f5e7d5;border-radius:18px;position:relative;overflow:hidden}.brand{font-size:12px;letter-spacing:2px;color:#8b633b}.hero .date{font-size:25px;color:#8b633b}.hero p{color:#7d6b55}\n.sun{position:absolute;right:48px;top:55px;width:72px;height:72px;border-radius:50%;background:#e6bc75}.sun:after{content:\"\";position:absolute;width:110px;height:10px;border-top:2px solid #b8905d;border-bottom:2px solid #b8905d;left:-19px;top:55px}\n.demo{padding:10px 14px;background:#faedd1;border-radius:9px;color:#906326}.meta{font-size:12px;color:#6e7971;overflow-wrap:anywhere}.scope{padding:8px 0}.section-title{display:flex;align-items:flex-start;gap:15px;margin:34px 0 18px}.section-title>span{background:#e4ede3;border-radius:7px;padding:4px 9px;color:#477761;font-size:13px;margin-top:5px}\n.metric-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.cover-grid{grid-template-columns:repeat(var(--cover-columns),minmax(0,1fr));margin-top:20px}.metric{background:var(--pale);padding:18px;border-radius:13px;min-width:0;border-top:3px solid var(--accent)}.metric .label{color:var(--accent);font-size:13px}.metric .number{font-size:29px;line-height:1.4;margin:12px 0;overflow-wrap:anywhere}.metric .unknown{font-size:16px;color:#6e7971}\n.action{border-radius:13px;background:var(--pale);padding:18px 22px;margin:12px 0}.action header,.domain header{display:flex;gap:10px;align-items:center;color:var(--accent)}.action .record{font-size:17px}.badge{display:inline-block;border-radius:6px;background:#fff9;padding:2px 8px;font-size:12px;color:var(--accent,#78639c)}.record{white-space:normal;overflow-wrap:anywhere}\n.domain-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.domain{min-width:0;border:1px solid #e5e5da;border-top:3px solid var(--accent);background:#fff;padding:18px 20px;border-radius:11px}.domain header .meta{margin-left:auto}.domain .record{font-size:14px}\n.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:12px;line-height:1.55}th,td{text-align:left;vertical-align:top;border-bottom:1px solid #e5e5da;padding:8px;min-width:55px}th{background:#f1f4ee;font-weight:400}ul{padding-left:22px}.gaps{padding:12px 18px;background:#faedd1;border-radius:10px;color:#906326}.footer{border-top:1px solid #e5e5da;padding-top:16px;margin-top:30px;font-size:12px;color:#6e7971}\n.chart-grid{display:grid;grid-template-columns:repeat(var(--cols,3),minmax(0,1fr));gap:14px;margin-top:22px;align-items:stretch}@media(max-width:900px){.chart-grid,.tips{grid-template-columns:repeat(min(2,var(--cols,3)),minmax(0,1fr))}}@media(max-width:620px){.chart-grid,.tips{grid-template-columns:1fr}}.chart{background:#fff;border:1px solid #e5e5da;border-radius:14px;padding:16px 18px;min-width:0;display:flex;flex-direction:column}.chart h3{font-size:15px;margin:0 0 6px;color:#477761}.c-body{flex:1;display:flex;align-items:center;justify-content:center;min-height:176px}.c-body svg{width:100%;height:auto;display:block}.c-body svg.donut{width:140px;height:140px}.c-foot{margin-top:8px;font-size:13px;color:#6e7971;min-height:26px;display:flex;align-items:center}.c-foot b{color:#303d38;margin:0 4px;font-weight:600}.c-label{font-size:11px;fill:#6e7971}.c-value{font-size:12px;fill:#303d38;font-weight:600}.donut-num{font-size:7px;font-weight:600;fill:#303d38}.donut-unit{font-size:3.4px;fill:#6e7971}.legend,.stack-legend{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:12px}.dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px}.sleep-main{width:100%}.big{font-size:34px;font-weight:600;line-height:1.15;color:#4B3F8C}.big small{font-size:15px;font-weight:400;margin:0 6px 0 2px;color:#6e7971}.sleep-range{font-size:14px;color:#6e7971;margin:2px 0 14px}.stack{display:flex;height:22px;border-radius:11px;overflow:hidden;width:100%;margin-bottom:10px}.stack span{display:block;height:100%}.stack-legend span{display:block;white-space:nowrap}.stack-legend small{display:block;margin-left:14px;color:#6e7971}.domain-grid>.domain:only-child{grid-column:1/-1}.tips{display:grid;grid-template-columns:repeat(var(--cols,3),minmax(0,1fr));gap:12px}.tip{background:#fff;border:1px solid #e5e5da;border-left:4px solid #D06A5A;border-radius:12px;padding:12px 16px;display:flex;gap:10px;align-items:flex-start}.tip p{margin:0;font-size:14px}.tip-tag{flex:none;background:#fbe9e5;color:#a3483a;border-radius:6px;padding:1px 8px;font-size:12px;margin-top:2px}.tip.low{border-left-color:#C98A2B}.tip.low .tip-tag{background:#faedd1;color:#906326}.chips.ok{margin-top:12px}.chip.good{background:#e4ede3;color:#2f6b52}.mini-row{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}.mini{background:#fdf3dc;border-radius:10px;padding:6px 14px;font-size:13px;display:flex;gap:8px;align-items:baseline}.mini span{color:#8b633b}.mini b{font-size:16px;font-weight:600}.tr-list{width:100%;display:flex;flex-direction:column;gap:9px}.tr-row{display:grid;grid-template-columns:minmax(0,1fr) 52px auto;align-items:baseline;gap:8px;font-size:13px}.tr-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tr-dots{color:#287B65;letter-spacing:1px;font-size:11px}.tr-meta{color:#6e7971;font-size:12px;white-space:nowrap;text-align:right;min-width:70px}.chips{display:flex;flex-wrap:wrap;gap:6px}.chip{background:#f1ece2;border-radius:999px;padding:2px 10px;font-size:12px;color:#5b4f3a}\n@media(max-width:720px){main{margin:0;padding:18px;border-radius:0}.hero{padding:22px}.sun{opacity:.3;right:25px;top:85px}.metric-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.cover-grid{grid-template-columns:repeat(var(--cover-mobile-columns),minmax(0,1fr))}.metric .number{font-size:23px}.domain-grid{grid-template-columns:1fr}h2{font-size:22px}}\n@media print{body{background:#fff}main{margin:0;padding:0;border-radius:0}article,.hero{break-inside:avoid}h2,h3{break-after:avoid}.section-title{break-after:avoid}.domain-grid{display:block}.domain{margin-bottom:14px}thead{display:table-header-group}tr{break-inside:avoid}}\n";
  const cover = reportCoverCards(report, recipe);
  const htmlSections = report.sleep_detail ? report.sections.map(section => ({ ...section, items: section.items.filter(item => !item.sleep) })).filter(section => section.items.length) : report.sections;
  const tableTrends = report.trends.filter(trend => trend.metric_id !== 'sleep_h');
  const onCover = new Set(cover.filter(item => item.type === 'metric').map(item => item.id ?? item.label)), restMetrics = report.metrics.filter(item => !onCover.has(item.id ?? item.label));
  const coverCard = item => item.type === 'metric' ? metric(item) : '<article class="metric"' + style(domainPalette(item.domain)) + '><div class="label">' + e(item.label) +
    '</div><div class="number">' + e(l.recorded) + '</div><p class="record">' + e(item.text.length > 140 ? item.text.slice(0, 140) + ' …' : item.text) + '</p>' + meta(plainNote(item, l)) + '</article>';
  const adviceHTML = () => {
    const advice = report.advice;
    if (!advice || (!advice.flags.length && !advice.ok.length)) return '';
    return heading('', l.chart.advice) + (advice.flags.length
      ? '<div class="tips" style="--cols:' + cardColumns(advice.flags.length) + '">' + advice.flags.map(item => '<article class="tip' + (item.level === 'low' ? ' low' : '') + '"><span class="tip-tag">' + e(l.chart[item.level]) + '</span><p>' + e(item.text) + '</p></article>').join('') + '</div>'
      : '<p class="meta">' + e(l.chart.allGood) + '</p>') +
      (advice.ok.length ? '<div class="chips ok">' + advice.ok.map(item => '<span class="chip good">✓ ' + e(item.text) + '</span>').join('') + '</div>' : '');
  };
  const empty = !report.metrics.length && !report.sections.length && !report.actions.length && !report.followups.length && !report.summary.length && !report.trends.length;
  return '<!doctype html><html lang="' + e(report.language) + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'"><title>' +
    e(report.date + ' ' + l.title) + '</title><style>' + css + '</style></head><body><main><header class="hero"><span class="brand">LifeOS / DAILY NOTES</span><h1>' + e(l.snapshot) + '</h1><div class="date">' + e(report.date) +
    '</div><div class="sun" aria-hidden="true"></div></header>' + (report.basis === 'fictional' ? '<p class="demo">' + e(l.fictional) + '</p>' : '') +
    '<div class="scope"><p>' + e(l.title) + '</p>' + (report.sleep_context ? '<p class="meta">' + e(l.sleepDate + report.sleep_context.wake_date) + '</p>' : '') +
    '</div>' + (empty ? '<p class="meta">' + e(l.emptyReport) + '</p>' : '') +
    (cover.length ? '<div class="metric-grid cover-grid" style="--cover-columns:' + cover.length + ';--cover-mobile-columns:' + Math.min(2, cover.length) + '">' + cover.map(coverCard).join('') + '</div>' : '') +
    chartsHTML(report, e) +
    adviceHTML() +
    (report.actions.length ? heading('01', l.actionDetail) + report.actions.map(item => '<article class="action"' + style(actionPalette(item)) + '><header><h3>' + e(domainName(item.domain, l)) +
      '</h3></header><p class="record">' + e(item.text) + '</p><span class="badge">' + e(actionLabel(item, l)) + '</span>' + meta(l.due + ': ' + (item.due ?? l.unknown) + ' · ' + l.owner + ': ' + item.owner) + '</article>').join('') : '') +
    (report.followups.length ? heading('02', l.followups, l.actionNote) + report.followups.map(item => '<article class="action"' + style(domainPalette(item.domain)) + '><header><h3>' +
      e(domainName(item.domain, l)) + '</h3></header><p>' + e(item.text) + '</p></article>').join('') : '') +
    (report.summary.length ? heading('02', l.summary) + report.summary.map(item => '<article class="action"' + style(domainPalette(item.domain ?? 'health')) + '><span class="badge">' +
      e(item.kind === 'hypothesis' ? l.inferred : l.recorded) + '</span><p>' + e(item.text) + '</p></article>').join('') : '') +
    (restMetrics.length ? '<div class="mini-row">' + restMetrics.map(item => '<div class="mini"><span>' + e(item.label) + '</span><b>' + e(displayValue(item, l)) + '</b></div>').join('') + '</div>' : '') +
    (tableTrends.length ? heading('04', l.trends) + '<div class="domain-grid">' + tableTrends.map(trend => '<article class="domain"' + style(domainPalette(trend.domain)) + '><h3>' +
      e(trend.label) + '</h3>' + table([l.date, l.value], trend.points.map(point => [point.date, point.value == null ? l.unknown : point.value + ' ' + (l.units[trend.unit] ?? trend.unit)])) + '</article>').join('') + '</div>' : '') +
    (htmlSections.length ? heading('05', l.domainDetail) + '<div class="domain-grid">' + htmlSections.map(section => '<article class="domain"' + style(domainPalette(section.domain)) + '><header><h3>' +
      e(domainName(section.domain, l)) + '</h3></header>' + section.items.map(note).join('') + '</article>').join('') + '</div>' : '') +
    (report.gaps.length ? heading('06', l.gaps) + '<div class="gaps"><ul>' + report.gaps.map(gap => '<li>' + e((gap.domain ? domainName(gap.domain, l) + ': ' : '') + (l.gap[gap.code] ?? gap.code)) + '</li>').join('') + '</ul></div>' : '') +
    '<footer class="footer">LifeOS / ' + e(report.date) + '</footer></main></body></html>';
}
