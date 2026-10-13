// 公共工具：路径、日期、frontmatter 读写、Markdown 表格解析。无第三方依赖。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

// Timezone resolution, in order: the user's saved preference (profile/preferences.json "timezone"),
// project.json "timezone" when not null, the LIFEOS_TIMEZONE environment variable (a declared host
// timezone for tests and runtime adapters whose clock differs from the user's), then the runtime
// system timezone. Every value is a validated IANA name. An invalid configured
// value is an error rather than a silent fallback, because it decides which day a record belongs to.
export const TIMEZONE_ENV = 'LIFEOS_TIMEZONE';

export function canonicalTimezone(value) {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!/^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)*$/.test(name))
    throw new Error('Use an IANA timezone name such as Europe/Berlin, America/New_York or Asia/Tokyo: ' + value);
  try { return new Intl.DateTimeFormat('en-US', { timeZone: name }).resolvedOptions().timeZone; }
  catch { throw new Error('Unknown IANA timezone: ' + value); }
}

export function systemTimezone() {
  try { return canonicalTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone); } catch { return 'UTC'; }
}

function settingsJSON(relative) {
  const file = path.resolve(ROOT, relative);
  if (!file.startsWith(ROOT + path.sep)) throw new Error('Settings files must stay inside the vault: ' + relative);
  const text = readIfExists(file);
  return text ? JSON.parse(text) : null;
}

export function resolveTimezone() {
  const project = settingsJSON('project.json') ?? {};
  const preferences = settingsJSON(project.interaction?.preferences_file ?? 'profile/preferences.json') ?? {};
  if (preferences.timezone != null) return { timezone: canonicalTimezone(preferences.timezone), source: 'preference' };
  if (project.timezone != null) return { timezone: canonicalTimezone(project.timezone), source: 'project' };
  const host = process.env[TIMEZONE_ENV];
  if (host) return { timezone: canonicalTimezone(host), source: 'environment' };
  return { timezone: systemTimezone(), source: 'system' };
}

export const timezone = () => resolveTimezone().timezone;

// Local calendar and clock parts of an instant in the configured (or a given) timezone.
export function localParts(instant = new Date(), zone = timezone()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(instant)).map(part => [part.type, part.value]));
  return { ...parts, date: parts.year + '-' + parts.month + '-' + parts.day, time: parts.hour + ':' + parts.minute, timezone: zone };
}

export const localDate = (instant, zone = timezone()) => localParts(instant, zone).date;

// Today's date in the configured timezone.
export function today(zone = timezone()) {
  return localDate(new Date(), zone);
}

export function normDate(s) {
  if (!s || s === 'today' || s === '今天') return today();
  if (s === 'yesterday' || s === '昨天') return addDays(today(), -1);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error(`日期格式应为 YYYY-MM-DD：${s}`);
  return s;
}

export function addDays(date, n) {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function weekday(date) {
  return WEEKDAYS[new Date(date + 'T00:00:00Z').getUTCDay()];
}

export function journalPath(date) {
  return path.join(ROOT, 'journal', date.slice(0, 4), `${date}.md`);
}

// 只支持本库用到的扁平 frontmatter：标量 与 [a, b] 行内列表
export function parseDoc(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: {}, keys: [], body: text };
  const data = {}, keys = [];
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (!kv) continue;
    keys.push(kv[1]);
    data[kv[1]] = parseValue(kv[2].trim());
  }
  return { data, keys, body: text.slice(m[0].length) };
}

function parseValue(v) {
  if (v === '') return null;
  if (v.startsWith('[') && v.endsWith(']'))
    return v.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean);
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v.replace(/^["']|["']$/g, '');
}

export function stringifyDoc({ data, keys, body }) {
  const allKeys = [...keys, ...Object.keys(data).filter(k => !keys.includes(k))];
  const lines = allKeys.map(k => {
    const v = data[k];
    if (v === null || v === undefined) return `${k}:`;
    if (Array.isArray(v)) return `${k}: [${v.join(', ')}]`;
    return `${k}: ${v}`;
  });
  return `---\n${lines.join('\n')}\n---\n${body}`;
}

// 取某个 "## 标题" 下的第一张表，返回对象数组（键为表头）
export function sectionTable(body, heading) {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex(l => l.trim() === `## ${heading}`);
  if (start < 0) return [];
  const rows = [];
  let header = null;
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i].trim();
    if (l.startsWith('## ')) break;
    if (!l.startsWith('|')) { if (header && rows.length) break; continue; }
    const cells = l.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
    if (!header) { header = cells; continue; }
    if (cells.every(c => /^:?-+:?$/.test(c))) continue;
    rows.push(Object.fromEntries(header.map((h, j) => [h, cells[j] ?? ''])));
  }
  return rows;
}

export function num(v) {
  const n = parseFloat(String(v ?? '').replace(/[^\d.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function readIfExists(p) {
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}
