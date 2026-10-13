// Descriptive sleep analysis generated from the submitted record alone: times, duration and the
// user-supplied quality figure. No interpretation, no model call, no health claim.
// Use the health-advisor procedure instead when the user reports concerning signs or asks for one.
import { readJSON } from './store.mjs';
import { addDays } from './lib.mjs';
import { ensure, textValue } from './record-data.mjs';
import { getLanguagePreference } from './language.mjs';

const clock = value => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : null;
const minutes = value => { const matched = /^(\d{1,2}):(\d{2})$/.exec(value ?? ''); return matched ? Number(matched[1]) * 60 + Number(matched[2]) : null; };
const hours = value => (Math.round(value * 100) / 100).toFixed(2).replace(/\.?0+$/, '');

// The analysis artifact contract: schema_version/kind/subject/wake_date/timezone/status/input_sources/
// observations/limitations, plus analysis_method so a caller can tell a rule-based description from a
// model review. observations keep the observation/hypothesis split; a descriptive script emits only
// observations and states plainly which derivations it could not make.
export function descriptiveSleepAnalysis(input, options = {}) {
  ensure(input && input.schema_version === 1 && input.kind === 'sleep_input', 'Descriptive analysis needs a sleep_input record.');
  ensure(textValue(input.subject) && typeof input.wake_date === 'string' && textValue(input.timezone), 'Sleep input needs its subject, waking date and timezone.');
  ensure(input.episode_type === 'main_sleep', 'Only a confirmed main sleep episode is described here; a nap or unknown episode stays unanalyzed.');
  const language = typeof options.language === 'string' && options.language ? options.language : getLanguagePreference().interaction_language;
  const english = !language.startsWith('zh');
  const observations = [], limitations = [];
  const bed = clock(input.bed_time), wake = clock(input.wake_time);
  const duration = typeof input.sleep_h === 'number' && Number.isFinite(input.sleep_h) ? input.sleep_h : null;
  const line = (zh, en) => observations.push({ kind: 'observation', text: english ? en : zh });

  if (bed && wake) {
    const span = (minutes(wake) - minutes(bed) + 1440) % 1440;
    // A recorded bedtime equal to the wake time is a full day, not a zero-length episode.
    const derived = (span === 0 ? 1440 : span) / 60;
    line(`提交的入睡时间 ${bed}、起床时间 ${wake}，据此间隔为 ${hours(derived)} 小时。`,
      `Submitted bedtime ${bed} and wake time ${wake}; the interval between them is ${hours(derived)} hours.`);
    if (duration != null && Math.abs(derived - duration) > 1 / 60)
      line(`提交的睡眠时长 ${hours(duration)} 小时与该间隔相差 ${hours(Math.abs(derived - duration))} 小时；两个值都按原样保留，不取平均也不改写。`,
        `The submitted duration of ${hours(duration)} hours differs from that interval by ${hours(Math.abs(derived - duration))} hours; both values are kept as submitted, without averaging or rewriting.`);
  } else if (bed) line(`只提交了入睡时间 ${bed}，没有起床时间，无法据此推算间隔。`, `Only a bedtime (${bed}) was submitted, with no wake time, so no interval can be derived.`);
  else if (wake) line(`只提交了起床时间 ${wake}，没有入睡时间，无法据此推算间隔。`, `Only a wake time (${wake}) was submitted, with no bedtime, so no interval can be derived.`);

  if (duration != null) line(`提交的自我记录睡眠时长为 ${hours(duration)} 小时。`, `Submitted self-recorded sleep duration is ${hours(duration)} hours.`);
  else limitations.push(english ? 'No sleep duration was submitted.' : '未提交睡眠时长。');
  if (typeof input.sleep_quality === 'number' && Number.isFinite(input.sleep_quality)) {
    ensure(input.sleep_quality >= 1 && input.sleep_quality <= 5, 'Sleep self-rating uses the declared 1–5 scale; keep other source scales separate.');
    line(`提交的主观评分 ${input.sleep_quality}/5（原量表自评，不作目标或评分解释）。`, `Submitted self-rating ${input.sleep_quality}/5 on its original scale, with no target or score interpretation.`);
  } else limitations.push(english ? 'No self-rated quality was submitted.' : '未提交主观评分。');
  if (textValue(input.notes)) line(`${english ? 'User-submitted note' : '用户提交的备注'}：${input.notes}`, `User-submitted note: ${input.notes}`);

  limitations.push(english
    ? 'Descriptive summary of the submitted record only: no interpretation, no trend claim, no health assessment.'
    : '本段只复述已提交的记录：不作解释、不判断趋势，也不作健康评估。');
  if (!(input.original_sources ?? []).length) limitations.push(english ? 'No device or document original was retained alongside this entry.' : '本条记录没有附带设备或文档原件。');
  limitations.push(english
    ? 'Report this to the health-advisor when the user describes concerning signs or asks for assessment.'
    : '用户描述令人担心的迹象或主动要求评估时，交由 health-advisor 按 docs/domains/HEALTH.md 处理。');
  return { schema_version: 1, kind: 'sleep_analysis', analysis_method: 'descriptive_script', subject: input.subject,
    wake_date: input.wake_date, timezone: input.timezone, status: 'completed', generated_at: new Date().toISOString(),
    input_sources: options.input_sources ?? [], observations, limitations };
}

// Convenience for callers that hold the sleep input as a vault-relative path.
export function analyzeSleepInput(relative, options = {}) {
  const input = readJSON(relative);
  ensure(input, 'No sleep input record at this path.');
  return descriptiveSleepAnalysis(input, { ...options, input_sources: options.input_sources ?? [{ path: relative }] });
}

export const sleepReportDate = wakeDate => addDays(wakeDate, -1);
