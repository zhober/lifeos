// 轻量快捷记录：一次调用完成原话归档 + 规范记录 + 日志投影 + 日程汇总。
// 复用既有数据模块与 CLI（nutrition/fitness/health/day/report），不复制其校验或计算逻辑。
// 用法: node tools/quick-log.mjs <input.json | -> [--dry-run] [--no-sleep-report]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ROOT, addDays, normDate, journalPath, weekday, parseDoc, stringifyDoc, readIfExists, localParts, timezone } from './lib.mjs';
import { digest, stable, immutable, vaultPath, currentHash, walk } from './store.mjs';
import { calculateMeal, latestMeals, mealsOn, mealPhotoOriginal } from './meal-data.mjs';
import { nutritionView } from './nutrition-view.mjs';
import { fitnessRecords, fitnessOriginal } from './fitness-data.mjs';
import { fitnessDay } from './fitness-day.mjs';
import { healthRecords, healthOriginal } from './health-data.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const USAGE = '用法: node tools/quick-log.mjs <input.json> [--dry-run] [--no-sleep-report]\n'
  + '字段与取值见 workflows/log/QUICK.md。';

// ------------------------------------------------------------------ 输入取值
const fail = message => { throw new Error(message); };
const text = value => typeof value === 'string' && value.trim() ? value.trim() : null;
const array = (value, label) => {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) fail('[' + label + '] 必须是数组。');
  return value;
};
const numeric = (value, label) => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) fail('[' + label + '] 必须是有限数字，未报告时留空(null)。');
  return value;
};
const enumValue = (value, allowed, fallback, label) => {
  const chosen = text(value) ?? fallback;
  if (!allowed.includes(chosen)) fail('[' + label + '] 取值不合法：' + chosen + '；允许 ' + allowed.join('/') + '。');
  return chosen;
};
const strings = (value, label) => array(value, label).map(item => typeof item === 'string' ? item.trim() : fail('[' + label + '] 只能包含文本。')).filter(Boolean);

// 时刻必须带显式时区偏移：无偏移的本地时间无法可靠换算到配置的时区（tools/lib.mjs timezone()）。
function instant(value, label) {
  const candidate = value ?? new Date().toISOString();
  if (typeof candidate !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:[+-]\d{2}:\d{2}|Z)$/.test(candidate))
    fail('[' + label + '] 需要带时区偏移的时刻，例如 2026-10-13T01:02:00+08:00；省略时使用当前时刻。');
  const value2 = new Date(candidate);
  if (Number.isNaN(value2.getTime())) fail('[' + label + '] 不是有效时刻：' + candidate);
  return value2;
}

// -------------------------------------------------------------- 日期解析规则
// 凌晨补记时，用户口中的"今天/中午/晚上"指刚结束的那一天；睡眠记在醒来日。
// 若报告的事件时刻（餐次/运动的 time、睡眠的 wake_time）晚于发送时刻，日期有歧义：拒绝并要求调用方按原话显式给出 date，
// 而不是静默把整条记录（包括"今天早上"的体重等）挪到前一天。
export function resolveDates(captured, supplied, eventTimes = [], zone = timezone()) {
  const parts = localParts(captured, zone), today = parts.date;
  const hour = Number(parts.hour), beforeDawn = hour < 4, now = parts.hour + ':' + parts.minute;
  const times = eventTimes.map(text).filter(Boolean);
  for (const value of times) if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) fail('事件时刻使用 HH:MM（24 小时制）：' + value);
  const later = times.filter(value => value > now);
  if (!text(supplied) && !beforeDawn && later.length)
    fail('事件时刻 ' + later.join('、') + ' 晚于发送时刻 ' + now + '，日期有歧义：按用户原话显式填写 date（今天 ' + today
      + ' 或昨天 ' + addDays(today, -1) + '）。用户没说具体时刻时不要填 time。');
  const basis = text(supplied) ? 'supplied_date' : beforeDawn ? 'pre_dawn_backdated' : 'capture_day';
  const journal = text(supplied) ? normDate(text(supplied)) : beforeDawn ? addDays(today, -1) : today;
  return { journal, capture_date: today, capture_time: now, timezone: zone, after_midnight: beforeDawn, basis };
}
// 更正既有餐次时日期取自原记录，不参与歧义判断。
const eventTimes = input => [...(Array.isArray(input.meals) ? input.meals.filter(meal => !meal?.supersedes) : []),
  ...(Array.isArray(input.exercise) ? input.exercise : [])].map(item => item?.time).concat([input.sleep?.wake_time]);

// ------------------------------------------------------------------ 餐次默认值
const PORTION_METHODS = ['user_reported', 'weighed', 'label_quantity', 'recipe_estimate', 'photo_estimate', 'unknown'];
const VISIBILITIES = ['visible', 'assumed', 'label', 'reported', 'unknown'];
const CONFIDENCES = ['low', 'medium', 'high', 'unknown'];

// photos 不为 null 时是照片餐：份量默认按照片估算、组分默认可见、整份吃完属于假设，照片也作为组分来源。
function component(raw, index, sourcePath, photos = null) {
  // id 只是组分内的稳定标签：规范成小写字母、数字和连字符，无法规范时按位置编号。
  const id = (text(raw.id) ?? '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'component-' + (index + 1);
  const name = text(raw.name) ?? fail('meal.components[] 需要 name（食物名）。');
  const unknownPortion = raw.grams === undefined || raw.grams === null;
  const method = enumValue(raw.portion_method, PORTION_METHODS, unknownPortion ? 'unknown' : photos ? 'photo_estimate' : 'user_reported', 'portion_method');
  const confidence = {};
  for (const key of ['identity', 'portion', 'recipe']) {
    confidence[key] = enumValue(raw.confidence?.[key], CONFIDENCES, key === 'identity' ? 'medium' : 'unknown', 'confidence.' + key);
  }
  const assumptions = strings(raw.assumptions, 'component.assumptions');
  if (['photo_estimate', 'recipe_estimate'].includes(method) && assumptions.length === 0)
    fail('估算份量（' + method + '）必须写明 assumptions，否则区间无法复核。');
  return { id, name, food_key: text(raw.food_key), cooking_state: text(raw.cooking_state) ?? '未报告',
    basis_match: enumValue(raw.basis_match, ['confirmed', 'assumed', 'unknown'], raw.food_key ? 'assumed' : 'unknown', 'basis_match'),
    visibility: enumValue(raw.visibility, VISIBILITIES, photos ? 'visible' : 'reported', 'visibility'),
    portion_method: method, grams: raw.grams ?? null, milliliters: raw.milliliters ?? null, servings: raw.servings ?? null,
    consumed_fraction: raw.consumed_fraction ?? 1,
    consumption_basis: enumValue(raw.consumption_basis, ['reported', 'assumed', 'unknown'], photos ? 'assumed' : 'reported', 'consumption_basis'),
    confidence, structural_zeros: raw.structural_zeros ?? {}, assumptions,
    sources: [{ path: sourcePath, quote: text(raw.quote) ?? undefined }, ...(photos ?? []).map(photo => ({ path: photo.path }))] };
}
// photos：本次已保留的原图 {path, sha256, stage}；previous：被更正餐次的最新版本（其照片、名称与时刻沿用）。
export function mealPayload(raw, index, sourcePath, { photos = [], previous = null } = {}) {
  const label = text(raw.label) ?? text(raw.name) ?? previous?.meal_name ?? '记录餐次';
  const kept = (previous?.photos ?? []).map(({ path: file, sha256, stage }) => ({ path: file, sha256, stage }));
  for (const photo of photos) if (!kept.some(item => item.sha256 === photo.sha256)) kept.push(photo);
  const supplied = photoInputs(raw).length, photoMeal = kept.length > 0 || supplied > 0;
  const components = array(raw.components, 'meal.components').map((item, position) => component(item, position, sourcePath, photoMeal ? kept : null));
  if (components.length === 0) fail('餐次 "' + label + '" 至少需要一个组分（components）。');
  const assumptions = strings(raw.assumptions, 'meals[].assumptions');
  const described = (text(raw.description) ?? label).replace(/[。．.]+$/, '');
  const review = photoMeal ? enumValue(raw.image_review, ['viewed', 'unavailable'], 'viewed', 'meals[].image_review') : 'not_applicable';
  const visual = components.every(item => ['photo_estimate', 'unknown'].includes(item.portion_method));
  const payload = { meal_name: label,
    input_method: photoMeal ? enumValue(raw.input_method, ['photo', 'mixed'], visual && review === 'viewed' ? 'photo' : 'mixed', 'meals[].input_method') : 'text',
    image_review: review, photos: kept,
    observation: text(raw.observation) ?? previous?.observation ?? (photoMeal ? '照片（' + Math.max(kept.length, supplied) + ' 张）估算：' : '用户文字报告：') + described + '。',
    assumptions: assumptions.length ? assumptions : [photoMeal ? '份量按照片可见内容估算；看不见的油、酱和配料未计入，整份吃完为假设。'
      : '份量按用户报告处理；未报告的组分保持未知。'],
    components, sources: [{ path: sourcePath, quote: text(raw.quote) ?? undefined }, ...kept.map(photo => ({ path: photo.path }))] };
  const time = text(raw.time) ?? previous?.meal_time;
  if (time) payload.meal_time = time;
  if (previous) Object.assign(payload, { meal_id: previous.meal_id, supersedes: previous.file });
  return payload;
}
// 干跑预览：新照片尚未保留，按文字餐计算同一组分（已保留的旧照片照常校验）。
const previewable = payload => payload.photos.length ? payload : { ...payload, input_method: 'text', image_review: 'not_applicable' };

// ------------------------------------------------------- 原始文件（照片/截图）
// 路径可为绝对路径或相对 vault；vault 外的文件也可以，原件按既有工具复制进 inbox/。
const located = value => path.resolve(ROOT, value);
const PHOTO_STAGES = ['before', 'after', 'label', 'other'];
const ATTACHMENT_KINDS = ['sleep', 'body', 'health', 'fitness'];
function originalInputs(list, label, field, allowed, fallback) {
  return array(list, label).map(item => {
    const source = text(typeof item === 'string' ? item : item?.path)
      ?? fail('[' + label + '] 每项是文件路径（绝对或相对 vault），或 {path, ' + field + '}。');
    if (!fs.existsSync(located(source))) fail('[' + label + '] 找不到文件：' + source);
    return { source: located(source), [field]: enumValue(typeof item === 'string' ? null : item[field], allowed, fallback, label + '[].' + field) };
  });
}
const photoInputs = raw => originalInputs(raw.photos, 'meals[].photos', 'stage', PHOTO_STAGES, 'before');
const attachmentInputs = input => originalInputs(input.attachments, 'attachments', 'kind', ATTACHMENT_KINDS, 'sleep');
// 写入前先在进程内校验（大小、格式），得到保留路径与哈希；真正保留走既有 CLI。
const ORIGINAL_TOOLS = { meal: ['nutrition.mjs', 'photo'], fitness: ['fitness.mjs', 'original'], health: ['health.mjs', 'original'] };
const originalTool = kind => kind === 'meal' ? 'meal' : kind === 'fitness' ? 'fitness' : 'health';
function checkOriginal(kind, source, date) {
  try {
    const checked = kind === 'meal' ? mealPhotoOriginal(source, date)
      : kind === 'fitness' ? fitnessOriginal({ source_path: source, date }) : healthOriginal({ source_path: source, date });
    return { path: checked.path, sha256: checked.sha256 };
  } catch (error) { return fail('原始文件无法保留（' + path.basename(source) + '）：' + error.message); }
}
function retainOriginal(kind, source, date) {
  const [tool, command] = ORIGINAL_TOOLS[originalTool(kind)];
  return cliJson(tool, [command, scratchFile({ source_path: source, date })]);
}

// 更正：supersedes 指向既有 meal_id，按其最新版本生成新版本，日期沿用原餐次。
function correctionTarget(raw, meals) {
  if (raw.supersedes === undefined || raw.supersedes === null) return null;
  const id = text(raw.supersedes) ?? fail('[meals[].supersedes] 填写要更正的 meal_id。');
  const previous = meals.find(meal => meal.meal_id === id)
    ?? fail('[meals[].supersedes] 未找到餐次 ' + id + '：填写既有记录的 meal_id（回执 records.meals[].meal_id，或日志饮食行里的 meal:<id>）。');
  if (text(raw.date) && normDate(text(raw.date)) !== previous.date)
    fail('[meals[].date] 更正沿用原餐次日期 ' + previous.date + '；改日期请走 workflows/log/SKILL.md。');
  return previous;
}

// ------------------------------------------------------------------ 运动默认值
const EXERCISE_TYPES = ['resistance', 'endurance', 'mobility', 'sport', 'other'];
function exerciseType(name) {
  if (/瑜伽|拉伸|体操|yoga|stretch|mobility/i.test(name)) return 'mobility';
  if (/跑|走|骑|游泳|椭圆|划船|跳绳|爬楼|run|walk|cycl|swim|row|jump/i.test(name)) return 'endurance';
  if (/篮球|足球|羽毛球|乒乓|网球|排球|爬山|徒步|basket|foot|badminton|tennis|volley|hike/i.test(name)) return 'sport';
  if (/力量|深蹲|硬拉|卧推|推举|哑铃|杠铃|引体|lift|squat|bench|deadlift|press|pull/i.test(name)) return 'resistance';
  return 'other';
}
export function sessionPayload(raw, sourcePath) {
  const name = text(raw.name) ?? fail('exercise[].name 必填（项目名，如"跑步"）。');
  const type = enumValue(raw.type, EXERCISE_TYPES, exerciseType(name), 'exercise.type');
  const duration = numeric(raw.duration_min, 'exercise.duration_min');
  if (duration !== null && duration < 0) fail('exercise.duration_min 不能为负。');
  const rpeValue = numeric(raw.rpe, 'exercise.rpe');
  if (rpeValue !== null && (rpeValue < 0 || rpeValue > 10)) fail('exercise.rpe 使用显式 0–10 量表。');
  const activity = { id: 'activity-1', name, exercise_key: text(raw.exercise_key) ?? 'unclassified',
    equipment_key: text(raw.equipment_key) ?? 'unknown', type, duration_min: duration,
    distance: raw.distance ?? null, rpe: null, sets: [] };
  if (type === 'resistance') activity.sets_complete = false;
  return { subject: 'self', title: text(raw.title) ?? name, completion: enumValue(raw.completion, ['completed', 'partial', 'not_performed', 'unknown'], 'completed', 'exercise.completion'),
    recording_complete: false, duration_min: duration,
    session_rpe: rpeValue === null ? null : { value: rpeValue, scale: '0_to_10' },
    activities: [activity], plan_link: null, case_ids: [],
    evidence: 'reported', review_status: 'reviewed', extraction_confidence: 'high',
    assumptions: ['用户文字报告；未报告强度、配速、距离或设备数据。'],
    sources: [{ path: sourcePath, quote: text(raw.quote) ?? undefined }] };
}

// ------------------------------------------------------------------ 健康默认值
export function healthPayload(raw, date, sourcePath) {
  const common = { subject: 'self', state: 'active', evidence: 'reported', review_status: 'reviewed',
    extraction_confidence: 'high', case_ids: [], related_record_ids: [],
    occurred_start: date, occurred_end: date, date_precision: 'day',
    sources: [{ path: sourcePath, quote: text(raw.quote) ?? undefined }] };
  if (raw.value !== undefined && raw.value !== null) {
    const unit = text(raw.unit) ?? fail('测量需要 unit（单位；无量纲写 "1"）。');
    if (typeof raw.value !== 'number' || !Number.isFinite(raw.value)) fail('测量 value 必须是数字；未知值不要写成 0。');
    return { ...common, kind: 'measurement', title: text(raw.title) ?? '记录测量',
      details: { name: text(raw.name) ?? fail('测量需要 name。'), value: raw.value, unit } };
  }
  const description = text(raw.description) ?? fail('症状需要 description（用户原话或要点）。');
  const severity = numeric(raw.severity, 'symptom.severity');
  if (severity !== null && (severity < 0 || severity > 10)) fail('symptom.severity 使用已报告的 0–10 量表。');
  return { ...common, kind: 'symptom', title: text(raw.title) ?? description.slice(0, 40),
    details: { description, course: enumValue(raw.course, ['onset', 'ongoing', 'recurrent', 'resolved', 'unknown'], 'unknown', 'symptom.course'),
      location: text(raw.location), frequency: null,
      severity: severity === null ? null : { value: severity, scale: 'reported_0_to_10' },
      triggers: strings(raw.triggers, 'symptom.triggers'), associated: [], measures: [], resolved_on: null } };
}

// ------------------------------------------------------------- 睡眠（描述性）
export function sleepPayload(raw, wakeDate, sourcePath) {
  const bed = text(raw.bed_time), wake = text(raw.wake_time);
  for (const [value, label] of [[bed, 'sleep.bed_time'], [wake, 'sleep.wake_time']])
    if (value && !/^\d{1,2}:\d{2}$/.test(value)) fail('[' + label + '] 用 HH:MM 24 小时制，例如 01:00。');
  const minutes = value => value ? Number(value.split(':')[0]) * 60 + Number(value.split(':')[1]) : null;
  let hours = numeric(raw.sleep_h, 'sleep.sleep_h');
  if (hours === null && bed && wake) {
    let span = minutes(wake) - minutes(bed);
    if (span <= 0) span += 24 * 60;
    hours = Math.round(span / 6) / 10;
  }
  const quality = numeric(raw.sleep_quality, 'sleep.sleep_quality');
  if (quality !== null && (quality < 1 || quality > 5)) fail('sleep.sleep_quality 使用 1–5 主观评分；其他量表请另行保留。');
  return { wake_date: wakeDate, bed_time: bed, wake_time: wake, sleep_h: hours, sleep_quality: quality, sourcePath,
    notes: text(raw.notes) ?? ('用户报告：' + [bed ? bed + ' 入睡' : null, wake ? wake + ' 起床' : null].filter(Boolean).join('、') + '。') };
}
// 描述性分析：只复述已报告的时刻与评分，不做解释、评分或建议。
function descriptiveAnalysis(payload, wakeDate) {
  const span = payload.sleep_h === null ? '未报告可计算时长' : '按报告时刻计算约 ' + payload.sleep_h + ' 小时（未扣除入睡耗时或夜醒）';
  const observations = [payload.bed_time || payload.wake_time
    ? { kind: 'observation', text: '用户报告 ' + (payload.bed_time ?? '未报告') + ' 入睡、' + (payload.wake_time ?? '未报告')
      + ' 起床（醒来日 ' + wakeDate + '），' + span + '。' }
    : { kind: 'observation', text: '醒来日 ' + wakeDate + '：' + span + '。' },
  payload.sleep_quality === null
    ? { kind: 'observation', text: '主观睡眠质量未报告。' }
    : { kind: 'observation', text: '用户自评睡眠质量 ' + payload.sleep_quality + '（1–5 量表，原样保留）。' }];
  return { observations, limitations: ['用户回忆报告的时刻，非设备测量', '入睡耗时与夜醒次数未报告',
    '仅描述已报告的时刻与评分，不含解读、评分或建议'] };
}

// 单条记录的日期：默认与本条消息解析出的日志日期一致；只有需要分开补录时才显式覆盖。
function entryDate(raw, journalDate) { return text(raw.date) ? normDate(text(raw.date)) : journalDate; }

// -------------------------------------------------------------- 日志读写助手
const rawBounds = lines => {
  const start = lines.findIndex(line => line.trim() === '## 原始记录');
  if (start < 0) fail('日志缺少"## 原始记录"标题；请检查 templates/day.md 与既有日志结构。');
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index++) if (/^## /.test(lines[index])) { end = index; break; }
  return [start, end];
};
function insertRow(body, heading, row) {
  const lines = body.split('\n');
  const start = lines.findIndex(line => line.trim() === '## ' + heading);
  if (start < 0) return body;
  let last = start;
  for (let index = start + 1; index < lines.length; index++) {
    if (/^## /.test(lines[index])) break;
    if (lines[index].trim().startsWith('|')) last = index;
  }
  lines.splice(last + 1, 0, row);
  return lines.join('\n');
}
function insertNote(body, heading, note) {
  const lines = body.split('\n');
  const start = lines.findIndex(line => line.trim() === '## ' + heading);
  if (start < 0) return body;
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index++) if (/^## /.test(lines[index])) { end = index; break; }
  while (end > start + 1 && lines[end - 1].trim() === '') end -= 1;
  lines.splice(end, 0, note);
  return lines.join('\n');
}

// 更正：替换该餐次在表中的投影行（按 meal:<id>; 定位），找不到时追加，避免同一餐次出现两行。
function replaceRow(body, heading, marker, row) {
  const lines = body.split('\n');
  const start = lines.findIndex(line => line.trim() === '## ' + heading);
  for (let index = start + 1; start >= 0 && index < lines.length && !/^## /.test(lines[index]); index++)
    if (lines[index].trim().startsWith('|') && lines[index].includes(marker)) { lines[index] = row; return lines.join('\n'); }
  return insertRow(body, heading, row);
}

// 组装整份日志文本；调用方在干跑时使用同一函数预览。capture 为 null 时只投影行（更正较早日期的餐次）。
const NO_EDITS = { rows: [], notes: [], replace: [] };
function journalText(date, capture, edits, metrics) {
  const file = journalPath(date), existed = fs.existsSync(file);
  const before = existed ? readIfExists(file) : fs.readFileSync(path.join(HERE, '..', 'templates', 'day.md'), 'utf8')
    .replaceAll('{{date}}', date).replaceAll('{{weekday}}', weekday(date));
  const doc = parseDoc(before);
  let body = doc.body;
  for (const [heading, marker, row] of edits.replace) body = replaceRow(body, heading, marker, row);
  for (const [heading, row] of edits.rows) body = insertRow(body, heading, row);
  for (const [heading, note] of edits.notes) body = insertNote(body, heading, note);
  const lines = body.split('\n');
  if (capture) {
    const [start, end] = rawBounds(lines);
    // 原话逐字保留；捕获日与日志日不同（凌晨补记/补录）时把实际捕获时刻写在同一行，保留的原件路径也写在这一行。
    const marker = capture.capture_date === date ? '' : ' <!-- captured ' + capture.capture_date + ' ' + capture.capture_time + ' ' + capture.timezone + ' -->';
    const originals = capture.originals?.length ? ' <!-- originals ' + capture.originals.map(item => item.path).join(' ') + ' -->' : '';
    const raw = '- ' + capture.capture_time + ' ' + capture.statement + marker + originals;
    if (!lines.slice(start, end).some(line => line.trim() === raw)) lines.splice(end, 0, raw);
  }
  const data = { ...doc.data };
  for (const [key, value] of Object.entries(metrics)) if (value !== null && value !== undefined) data[key] = value;
  const content = stringifyDoc({ data, keys: doc.keys, body: lines.join('\n') });
  const old = new Set(before.split('\n'));
  return { relative: path.relative(ROOT, file).replaceAll('\\', '/'), existed, content,
    added: content.split('\n').filter(line => line.trim() && !old.has(line)) };
}

// --------------------------------------------------------------- CLI 复用层
// 子命令读取 JSON 文件；临时输入写在被忽略的 .lifeos 目录，进程结束前删除。
let scratchSerial = 0;
const scratchFiles = [];
function scratchFile(value) {
  const directory = path.join(ROOT, '.lifeos', 'quick-log');
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, 'input-' + process.pid + '-' + (++scratchSerial) + '.json');
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
  scratchFiles.push(file);
  return file;
}
function removeScratch() {
  for (const file of scratchFiles.splice(0)) { try { fs.unlinkSync(file); } catch {} }
}
// 统一运行既有 CLI：既返回解析后的 JSON，也保留失败原因供上层判断。
function cli(tool, args) {
  const result = spawnSync(process.execPath, [path.join(HERE, tool), ...args], { cwd: ROOT, encoding: 'utf8', timeout: 60000 });
  const stdout = (result.stdout ?? '').trim(), stderr = (result.stderr ?? '').trim();
  if (result.status !== 0) return { ok: false, error: stderr || stdout || ('exit ' + result.status) };
  try { return { ok: true, value: JSON.parse(stdout) }; }
  catch { return { ok: false, error: '无法解析 ' + tool + ' 的输出：' + stdout.slice(0, 400) }; }
}
const cliJson = (tool, args) => {
  const result = cli(tool, args);
  if (!result.ok) fail(tool + ' ' + args[0] + ' 失败：' + result.error);
  return result.value;
};
// 干跑预览也要通过来源校验，但不应在库里留下记录：临时副本写在被忽略的 .lifeos 目录内。
function stagedCapture(capture) {
  const directory = path.join(ROOT, '.lifeos', 'quick-log');
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, capture.operation_id + '.dry-run.json');
  fs.writeFileSync(file, JSON.stringify(capture, null, 2) + '\n');
  scratchFiles.push(file);
  return path.relative(ROOT, file).replaceAll('\\', '/');
}

// -------------------------------------------------------------------- 主流程
const CORE = ['kcal', 'protein', 'fat', 'carb'];
const core = values => values ? Object.fromEntries(CORE.map(key => [key, values[key] ?? null])) : null;
// 回执只带四项主要营养素的数值与区间；完整结果在记录文件里。
const mealReceipt = (entry, derived) => ({ ...entry, totals: core(derived?.total), ranges: core(derived?.ranges),
  quality: derived?.quality ?? null, flags: derived?.flags ?? [] });

function run(input) {
  const statement = text(input.statement) ?? fail('[statement] 必填：用户原话，逐字保留。');
  const captured = instant(input.captured_at, 'captured_at');
  const dates = resolveDates(captured, input.date, eventTimes(input));
  const rawMeals = array(input.meals, 'meals');
  // 更正目标与原始文件都在写入任何文件之前校验。
  const targets = rawMeals.some(raw => raw?.supersedes !== undefined && raw?.supersedes !== null)
    ? (meals => rawMeals.map(raw => correctionTarget(raw, meals)))(latestMeals()) : rawMeals.map(() => null);
  const corrected = targets.filter(Boolean).map(target => target.meal_id);
  if (new Set(corrected).size !== corrected.length) fail('[meals[].supersedes] 一次输入里同一餐次只能更正一次。');
  const mealDate = index => targets[index]?.date ?? entryDate(rawMeals[index], dates.journal);
  const photoPlans = rawMeals.map((raw, index) => photoInputs(raw)
    .map(item => ({ ...item, kind: 'meal_photo', ...checkOriginal('meal', item.source, mealDate(index)) })));
  const attachmentPlans = attachmentInputs(input).map(item => ({ ...item, ...checkOriginal(item.kind, item.source, dates.journal) }));
  const originals = [...photoPlans.flat(), ...attachmentPlans];
  // 操作 ID 由内容派生：同样的输入重放同一操作，改动内容则产生新操作。
  // 省略 captured_at 时按发送日区分：同一天重放幂等，不同日的同样原话是新记录。原件按字节哈希参与。
  const operationId = digest(stable({ captured_at: input.captured_at ?? dates.capture_date, statement, date: input.date ?? null,
    meals: input.meals ?? null, exercise: input.exercise ?? null, sleep: input.sleep ?? null, symptoms: input.symptoms ?? null,
    measurement: input.measurement ?? null, weight_kg: input.weight_kg ?? null, mood: input.mood ?? null,
    energy: input.energy ?? null, stress: input.stress ?? null, study: input.study ?? null, work: input.work ?? null,
    ...(originals.length ? { attachments: input.attachments ?? null, originals: originals.map(item => item.sha256) } : {}) })).slice(0, 24);
  const capturePath = 'history/quick-log/' + operationId + '.json';
  const capture = { schema_version: 1, kind: 'quick_log_capture', operation_id: operationId,
    captured_at: input.captured_at ?? null, capture_date: dates.capture_date, capture_time: dates.capture_time, timezone: dates.timezone,
    journal_date: dates.journal, date_basis: dates.basis, statement,
    ...(originals.length ? { originals: originals.map(item => ({ kind: item.kind, path: item.path })) } : {}),
    note: '逐字原话与解析出的日期；规范记录以此为来源。' };
  // 同一操作重放时，规范化记录、日志与派生汇总都已按相同内容写入：只重建回执，不重复写文件。
  const replayed = fs.existsSync(vaultPath(capturePath)), fresh = !dryRun && !replayed;
  // 先校验全部条目，再保留原件、写原话存档：被拒绝的输入不留下孤立的存档文件。
  rawMeals.forEach((raw, index) => mealPayload(raw, index, capturePath, { previous: targets[index] }));
  array(input.exercise, 'exercise').forEach(raw => sessionPayload(raw, capturePath));
  array(input.symptoms, 'symptoms').forEach(raw => healthPayload(raw, entryDate(raw, dates.journal), capturePath));
  // 餐次再按共享计算器整体校验一遍（引文、食物、区间、照片规则），失败时库里还没有任何新文件。
  if (!replayed && rawMeals.length) {
    const staged = stagedCapture(capture);
    rawMeals.forEach((raw, index) => {
      try { calculateMeal(previewable(mealPayload(raw, index, staged, { previous: targets[index] }))); }
      catch (error) { fail('meals[' + index + '] 未通过校验：' + error.message); }
    });
  }
  if (fresh) {
    rawMeals.forEach((raw, index) => photoPlans[index].forEach(plan => retainOriginal('meal', plan.source, mealDate(index))));
    attachmentPlans.forEach(plan => retainOriginal(plan.kind, plan.source, dates.journal));
    immutable(capturePath, capture);
  }
  const receipt = { operation_id: operationId, dates, capture: { path: capturePath, replayed }, journal: {},
    records: { meals: [], exercise: [], health: [] }, sleep: null, report: null, totals: {}, coverage: {},
    assumptions: ['未报告的份量、时长、强度和量表保持 null，不作推测。'], notes: [], unknown: [], dry_run: dryRun };
  if (originals.length) receipt.originals = originals.map(item => ({ kind: item.kind, path: item.path, ...(dryRun ? { stored: false } : {}) }));
  if (dates.journal !== dates.capture_date)
    receipt.date_notice = '记在 ' + dates.journal + '（发送于 ' + dates.capture_date + ' ' + dates.capture_time + '，依据 ' + dates.basis + '）；回复时告诉用户。';
  if (replayed) return replayReceipt(receipt, input, capturePath, targets);
  // 干跑不写库内文件，但来源校验要求真实存在的文件：用 .lifeos 下的临时副本代替。
  const sourcePath = dryRun ? stagedCapture(capture) : capturePath;
  const edits = new Map(), metrics = {};
  const edit = date => { if (!edits.has(date)) edits.set(date, { rows: [], notes: [], replace: [] }); return edits.get(date); };
  edit(dates.journal);

  // 餐次：复用 nutrition.mjs record 与其日志投影；更正走同一 supersede 机制并替换原投影行。
  rawMeals.forEach((raw, index) => {
    const previous = targets[index], date = mealDate(index);
    const correction = previous ? { supersedes: previous.meal_id } : {};
    if (!fresh) {
      const payload = mealPayload(raw, index, sourcePath, { previous });
      receipt.records.meals.push(mealReceipt({ meal_name: payload.meal_name, date, ...correction,
        ...(photoPlans[index].length ? { photos: photoPlans[index].map(plan => plan.path) } : {}) }, calculateMeal(previewable(payload))));
      return;
    }
    const photos = photoPlans[index].map(plan => ({ path: plan.path, sha256: plan.sha256, stage: plan.stage }));
    const payload = mealPayload(raw, index, sourcePath, { photos, previous });
    const saved = cliJson('nutrition.mjs', ['record', scratchFile({ ...payload, date, date_basis: previous?.date_basis ?? 'supplied_date',
      operation_id: operationId + '/meal-' + (index + 1) })]);
    receipt.records.meals.push(mealReceipt({ meal_id: saved.meal_id, path: saved.path, replayed: saved.replay,
      ...(date === dates.journal ? {} : { date }), ...correction, version: saved.version,
      ...(payload.photos.length ? { photos: payload.photos.map(photo => photo.path) } : {}) }, saved.derived));
    if (saved.journal_projection) {
      if (previous) edit(date).replace.push(['饮食', 'meal:' + saved.meal_id + ';', saved.journal_projection.row]);
      else edit(date).rows.push(['饮食', saved.journal_projection.row]);
    }
    if (derivedEstimated(saved.derived)) receipt.assumptions.push(payload.meal_name + ' 为估算：' + payload.assumptions.join('；'));
  });
  // 运动：复用 fitness.mjs session 与其日志投影。
  array(input.exercise, 'exercise').forEach((raw, index) => {
    const payload = sessionPayload(raw, sourcePath), date = entryDate(raw, dates.journal);
    if (!fresh) { receipt.records.exercise.push({ title: payload.title, date, duration_min: payload.duration_min }); return; }
    const saved = cliJson('fitness.mjs', ['session', scratchFile({ ...payload, date, date_basis: 'supplied_date',
      operation_id: operationId + '/fitness-' + (index + 1) })]);
    receipt.records.exercise.push({ session_id: saved.session_id, path: saved.path, replayed: saved.replay,
      duration_min: saved.derived?.duration_min ?? null });
    if (saved.journal_projection) edit(date).rows.push(['运动', saved.journal_projection.row]);
  });
  // 症状/测量：复用 health.mjs record。
  array(input.symptoms, 'symptoms').forEach((raw, index) => {
    const date = entryDate(raw, dates.journal);
    const payload = healthPayload(raw, date, sourcePath);
    if (!fresh) { receipt.records.health.push({ kind: payload.kind, title: payload.title }); }
    else receipt.records.health.push({ kind: payload.kind, ...recordHealth(payload, operationId + '/health-' + (index + 1)) });
    if (fresh && payload.kind === 'symptom') edit(dates.journal).notes.push(['睡眠与身体', '- ' + payload.details.description + '（' + payload.occurred_start
      + '，用户报告；部位、程度与持续时间未说明：' + payload.details.location + '）']);
  });
  // 体重等简单测量：既有 frontmatter 键 + 一条可追溯测量记录。
  const weight = numeric(input.weight_kg, 'weight_kg');
  if (weight !== null) {
    if (fresh) receipt.records.health.push({ kind: 'measurement',
      ...recordHealth({ kind: 'measurement', title: '体重记录', subject: 'self', state: 'active', evidence: 'reported',
        review_status: 'reviewed', extraction_confidence: 'high', occurred_start: dates.journal, occurred_end: dates.journal,
        date_precision: 'day', details: { name: '体重', value: weight, unit: 'kg' }, case_ids: [], related_record_ids: [],
        sources: [sourcePath] }, operationId + '/weight-1') });
    metrics.weight_kg = weight; receipt.totals.weight_kg = weight;
  }
  // 心情/精力/压力：仅接受模板声明的 1–5 自评，其他量表如实跳过。
  for (const key of ['mood', 'energy', 'stress']) {
    const value = numeric(input[key], key);
    if (value === null) continue;
    if (value < 1 || value > 5) { receipt.unknown.push(key + ' 不在 1–5 自评量表内，未写入 frontmatter'); continue; }
    metrics[key] = value; receipt.totals[key] = value;
  }
  const study = numeric(input.study?.min, 'study.min');
  if (study !== null && study >= 0) {
    const row = '| ' + (text(input.study?.time) ?? '') + ' | ' + (text(input.study?.content) ?? '用户报告') + ' | ' + study
      + ' | ' + (text(input.study?.output) ?? '') + ' |';
    if (fresh) edit(dates.journal).rows.push(['学习', row]);
    receipt.records.study_min = study;
  }
  const work = numeric(input.work?.h, 'work.h');
  if (work !== null && work >= 0) { metrics.work_h = work; receipt.records.work_h = work; }

  // 睡眠：输入 + 脚本生成的描述性分析落在本次操作的任务目录，再调用既有 after-sleep 钩子。
  if (input.sleep) {
    const payload = sleepPayload(input.sleep, dates.journal, sourcePath);
    const taskDirectory = 'tasks/' + dates.journal.slice(0, 4) + '/' + operationId;
    const inputPath = taskDirectory + '/sleep-input.json', analysisPath = taskDirectory + '/sleep-analysis.json';
    const eventPath = taskDirectory + '/sleep-report-event.json';
    const analysis = descriptiveAnalysis(payload, dates.journal);
    const event = { schema_version: 1, kind: 'sleep_report_event',
      basis: fs.existsSync(vaultPath('.lifeos-deploy.json')) ? 'personal' : 'fictional', wake_date: dates.journal,
      sleep_input: { path: inputPath, sha256: null, scopes: ['health'],
        fields: ['sleep_h', 'sleep_quality', 'bed_time', 'wake_time', 'sleep_notes', 'dates'], mixed: false, precision: 'detailed' },
      analysis: { path: analysisPath, sha256: null, scopes: ['health'], fields: ['sleep_analysis', 'dates'], mixed: false, precision: 'summary' } };
    if (fresh) {
      // 睡眠截图（kind sleep）作为同一睡眠输入的原始来源。
      const screenshots = attachmentPlans.filter(plan => plan.kind === 'sleep').map(plan => ({ path: plan.path }));
      immutable(inputPath, { schema_version: 1, kind: 'sleep_input', episode_type: 'main_sleep', subject: 'self',
        wake_date: dates.journal, timezone: dates.timezone, sleep_h: payload.sleep_h,
        sleep_quality: payload.sleep_quality, bed_time: payload.bed_time, wake_time: payload.wake_time,
        notes: payload.notes, original_sources: [{ path: capturePath }, ...screenshots] });
      event.sleep_input.sha256 = currentHash(vaultPath(inputPath));
      immutable(analysisPath, { schema_version: 1, kind: 'sleep_analysis', subject: 'self', wake_date: dates.journal,
        timezone: dates.timezone, status: 'completed',
        performed_by: 'tools/quick-log.mjs 脚本生成的描述性分析（无模型解读）',
        input_sources: [{ path: inputPath, sha256: event.sleep_input.sha256 }],
        observations: analysis.observations, limitations: analysis.limitations });
      event.analysis.sha256 = currentHash(vaultPath(analysisPath));
      immutable(eventPath, event);
    }
    receipt.sleep = { wake_date: dates.journal, sleep_h: payload.sleep_h, sleep_quality: payload.sleep_quality,
      input: inputPath, analysis: analysisPath, event: eventPath };
    for (const key of ['bed_time', 'wake_time', 'sleep_h', 'sleep_quality']) if (payload[key] !== null) metrics[key] = payload[key];
    if (fresh) edit(dates.journal).notes.push(['睡眠与身体', '- 睡眠（醒来日 ' + dates.journal + '）：'
      + [payload.bed_time ? payload.bed_time + ' 入睡' : null, payload.wake_time ? payload.wake_time + ' 起床' : null].filter(Boolean).join('、')
      + (payload.sleep_h === null ? '' : '，约 ' + payload.sleep_h + ' 小时') + '；用户报告，未扣入睡耗时或夜醒。']);
    if (fresh && !skipSleepReport) receipt.report = afterSleep(eventPath);
  }

  // 日志写入与日程汇总：先落一条"## 原始记录"，再让既有 day.mjs sum 计算派生字段。
  const draft = journalText(dates.journal, capture, dryRun ? NO_EDITS : edit(dates.journal), metrics);
  receipt.journal = { path: draft.relative, created: !draft.existed };
  if (dryRun) {
    // 只列出将新增或改动的行，不打印整份日志。
    receipt.journal.dry_run = true; receipt.journal.added = draft.added;
    const preview = rawMeals.map((raw, index) => calculateMeal(previewable(mealPayload(raw, index, sourcePath, { previous: targets[index] }))));
    if (preview.length) receipt.totals.preview_kcal = { low: preview.reduce((sum, meal) => sum + (meal.ranges.kcal?.low ?? 0), 0),
      estimate: preview.reduce((sum, meal) => sum + (meal.total.kcal ?? meal.ranges.kcal?.estimate ?? 0), 0),
      high: preview.reduce((sum, meal) => sum + (meal.ranges.kcal?.high ?? 0), 0),
      note: '预览值直接来自 calculateMeal；尚未写入记录。' };
    receipt.context = adviceContext(dates.journal);
    receipt.context.note = '干跑：上下文只含已写入的记录，不含本次输入。';
    return receipt;
  }
  // 重放或内容已一致时不重复写入；派生字段交给既有 day.mjs sum，脚本对同一输入保持幂等。
  for (const [date, changes] of edits) {
    const current = date === dates.journal ? draft : journalText(date, null, changes, {});
    const written = writeJournal(date, current, operationId, date === dates.journal);
    if (date === dates.journal) receipt.journal.written = written;
    const summed = cli('day.mjs', ['sum', date]);
    if (!summed.ok) { receipt.notes.push('day.mjs sum ' + date + ' 未成功：' + summed.error); continue; }
    if (date !== dates.journal) {
      // 更正较早日期的餐次：那一天的日志与汇总也随之更新。
      const other = summarize(date);
      (receipt.other_days ??= []).push({ date, journal: current.relative, written, kcal: other.totals.kcal,
        protein_g: other.totals.protein_g, fat_g: other.totals.fat_g, carb_g: other.totals.carb_g });
      continue;
    }
    receipt.coverage = summarize(date);
    receipt.totals = receipt.coverage.totals;
    receipt.notes.push(...receipt.coverage.flags.filter(flag => !ownFlag(receipt, flag)).map(flag => '记录：' + flag));
    delete receipt.coverage.totals; delete receipt.coverage.flags;
  }
  receipt.context = adviceContext(dates.journal);
  return receipt;
}
// 单餐提示已在各餐次记录里（本次的在 records.meals[].flags），notes 只保留当日层面的提示。
const ownFlag = (receipt, flag) => /^meal-[a-z0-9-]+: /.test(flag);
function writeJournal(date, draft, operationId, main) {
  if (readIfExists(journalPath(date)) === draft.content) return false;
  cliJson('files.mjs', ['write', scratchFile({ operation_id: 'quick-log/' + operationId + '/journal' + (main ? '' : '/' + date),
    path: draft.relative, mode: 'replace', expected_hash: draft.existed ? digest(readIfExists(journalPath(date))) : null,
    content: draft.content })]);
  return true;
}

// 重放：不再写任何文件，只从既有记录重读本次操作的结果，供重复调用得到稳定回执。
function replayReceipt(receipt, input, capturePath, targets) {
  const date = receipt.dates.journal;
  for (const [index] of array(input.meals, 'meals').entries()) {
    const file = storedVersion('records/nutrition/meals', 'meal-version', receipt.operation_id + '/meal-' + (index + 1));
    const saved = file ? JSON.parse(readIfExists(vaultPath(file))) : null;
    if (!saved) receipt.notes.push('meals[' + index + '] 没有对应记录：上次写入可能中途失败；修正输入后重新提交会生成新操作。');
    receipt.records.meals.push(mealReceipt({ meal_id: saved?.meal_id ?? null, path: file, replayed: true,
      ...(saved && saved.date !== date ? { date: saved.date } : {}),
      ...(targets[index] ? { supersedes: targets[index].meal_id } : {}) }, saved?.derived));
  }
  for (const [index, raw] of array(input.exercise, 'exercise').entries()) {
    const payload = sessionPayload(raw, capturePath);
    receipt.records.exercise.push({ title: payload.title, date, duration_min: payload.duration_min, replayed: true,
      path: storedVersion('records/fitness/sessions', 'fitness-version', receipt.operation_id + '/fitness-' + (index + 1)) });
  }
  for (const [index, raw] of array(input.symptoms, 'symptoms').entries()) {
    const payload = healthPayload(raw, text(raw.date) ?? date, capturePath);
    receipt.records.health.push({ kind: payload.kind, title: payload.title, replayed: true,
      path: storedVersion('records/health/entries', 'health-version', receipt.operation_id + '/health-' + (index + 1)) });
  }
  if (input.weight_kg !== undefined && input.weight_kg !== null) receipt.records.health.push({ kind: 'measurement', replayed: true,
    path: storedVersion('records/health/entries', 'health-version', receipt.operation_id + '/weight-1') });
  if (input.sleep) {
    const payload = sleepPayload(input.sleep, date, capturePath);
    const taskDirectory = 'tasks/' + date.slice(0, 4) + '/' + receipt.operation_id;
    receipt.sleep = { wake_date: date, sleep_h: payload.sleep_h, sleep_quality: payload.sleep_quality,
      input: taskDirectory + '/sleep-input.json', analysis: taskDirectory + '/sleep-analysis.json',
      event: taskDirectory + '/sleep-report-event.json' };
  }
  receipt.journal = { path: path.relative(ROOT, journalPath(date)).replaceAll('\\', '/'), existed: true, written: false };
  const summary = summarize(date);
  receipt.totals = summary.totals;
  receipt.coverage = { ...summary };
  delete receipt.coverage.totals; delete receipt.coverage.flags;
  receipt.notes.push(...summary.flags.filter(flag => !ownFlag(receipt, flag)).map(flag => '记录：' + flag));
  receipt.context = adviceContext(date);
  return receipt;
}
// 版本文件名由操作 ID 派生，重放时据此定位既有记录，避免再写一次。
function storedVersion(root, prefix, operationId) {
  const versionId = prefix + '-' + digest(String(operationId)).slice(0, 24) + '.json';
  return walk(root, '.json').find(candidate => candidate.endsWith('/' + versionId)) ?? null;
}

// 读取既有日志与记录，复述当日派生汇总（day.mjs sum 已写入同一组字段）。
export function summarize(date) {
  const doc = parseDoc(readIfExists(journalPath(date)) ?? '');
  const nutrition = nutritionView(date, doc, latestMeals());
  const fitness = fitnessDay(date, doc, fitnessRecords('sessions').current);
  return { intake_day_status: doc.data.intake_day_status, nutrition_state: doc.data.nutrition_state,
    nutrition_quality: doc.data.nutrition_quality, exercise_min_origin: doc.data.exercise_min_origin,
    flags: [...nutrition.flags, ...fitness.flags],
    note: 'complete_recorded 只表示当日已记录项目的数值齐全；一天是否记全看 intake_day_status。',
    totals: { kcal: { value: doc.data.kcal, low: doc.data.kcal_low, high: doc.data.kcal_high,
      status: doc.data.kcal_status, day_status: doc.data.intake_day_status },
      exercise_min: fitness.total_duration_min,
      protein_g: doc.data.protein_g, fat_g: doc.data.fat_g, carb_g: doc.data.carb_g } };
}

// 建议用的紧凑上下文：当日已记录的餐次与主要营养素（已知小计+区间+覆盖状态），
// 前两天的运动、近三晚的睡眠（按醒来日）与近三天仍在的症状标题。只用既有解析器，不读全文日志。
export function adviceContext(date) {
  const doc = parseDoc(readIfExists(journalPath(date)) ?? ''), meals = latestMeals(), view = nutritionView(date, doc, meals);
  const nutrient = key => ({ known: view.known_subtotal[key] ?? null,
    range: view.known_ranges[key] ? [view.known_ranges[key].low, view.known_ranges[key].high] : null, status: view.coverage[key]?.status ?? 'unknown' });
  const from = addDays(date, -2), yesterday = addDays(date, -1);
  const exercise = fitnessRecords('sessions').current
    .filter(record => record.state === 'active' && record.subject === 'self' && record.date >= from && record.date <= yesterday)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(record => ({ date: record.date, title: record.title,
      type: [...new Set((record.activities ?? []).map(activity => activity.type))].join('+') || null,
      duration_min: record.derived?.duration_min ?? record.duration_min ?? null }));
  const sleep = [from, yesterday, date].map(day => {
    const data = parseDoc(readIfExists(journalPath(day)) ?? '').data;
    return { wake_date: day, bed: data.bed_time ?? null, wake: data.wake_time ?? null, hours: data.sleep_h ?? null };
  }).filter(night => night.bed !== null || night.wake !== null || night.hours !== null);
  const symptoms = [...new Set(healthRecords().current.filter(record => record.kind === 'symptom' && record.state === 'active'
    && record.subject === 'self' && record.details?.course !== 'resolved' && record.occurred_start
    && record.occurred_start <= date && (record.occurred_end ?? record.occurred_start) >= from).map(record => record.title))];
  return { today_so_far: { date, meals: mealsOn(date, meals).length, kcal: nutrient('kcal'), protein_g: nutrient('protein'),
    fat_g: nutrient('fat'), carb_g: nutrient('carb'), intake_day_status: view.intake_day_status },
  recent: { exercise, sleep, symptoms } };
}

// 估算/部分量化的餐次需要把假设一并回执。
function derivedEstimated(derived) { return derived.quality === 'estimated' || derived.quality === 'partially_quantified'; }
function recordHealth(payload, operationId) { return cliJson('health.mjs', ['record', scratchFile({ ...payload, operation_id: operationId })]); }

// after-sleep 钩子：兼容"缺 PDF 运行时"报错（改用 --no-pdf 重试）与"无内容可报"的 skipped 结果。
// skipped / not_ready 都是钩子的正常结论，不是失败；回执里保留原因供人查看。
function afterSleepStatus(value, extra = {}) {
  const status = value?.skipped ? 'skipped' : value?.ready === false ? 'not_ready' : value === undefined ? 'failed' : 'generated';
  return { status, ...extra, ...value };
}
function afterSleep(eventPath) {
  const first = cli('report.mjs', ['after-sleep', eventPath]);
  if (!first.ok) {
    // 缺 PDF 运行时/字体是环境问题：按文本模式重试，并在回执中说明。
    if (!/external runtime|pdfkit|CJK font/i.test(first.error)) return { status: 'failed', error: first.error };
    const retry = cli('report.mjs', ['after-sleep', eventPath, '--no-pdf']);
    if (!retry.ok) return { status: 'failed', error: retry.error, first_error: first.error };
    const result = afterSleepStatus(retry.value, { retried_without_pdf: true, pdf_unavailable: first.error });
    if (result.status === 'generated') { result.status = 'generated_without_pdf'; result.mode = 'text_only'; }
    return result;
  }
  return afterSleepStatus(first.value);
}

// 回执排版：只含标量的对象/数组若够短就写在一行，其余逐层缩进；仍是合法 JSON。
function compactJson(value, indent = '') {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  const list = Array.isArray(value), inner = indent + '  ';
  const parts = (list ? value.map(item => [null, item]) : Object.entries(value).filter(([, item]) => item !== undefined))
    .map(([key, item]) => (key === null ? '' : JSON.stringify(key) + ': ') + compactJson(item, inner));
  const [open, close] = list ? ['[', ']'] : ['{', '}'], flat = open + parts.join(', ') + close;
  if (!parts.length || !flat.includes('\n') && flat.length <= 120) return flat;
  return open + '\n' + parts.map(part => inner + part).join(',\n') + '\n' + indent + close;
}

// ---------------------------------------------------------------------- 入口
const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const skipSleepReport = argv.includes('--no-sleep-report');
const inputFile = argv.find(argument => !argument.startsWith('--'));
try {
  if (!inputFile) fail(USAGE);
  // "-" reads the input from stdin, so callers need no scratch file inside the vault.
  const source = inputFile === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(path.resolve(inputFile), 'utf8');
  console.log(compactJson(run(JSON.parse(source))));
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { removeScratch(); }
