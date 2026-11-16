// Optional PDFKit runtime. All decoration is local vector drawing; CJK text is embedded.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT } from './lib.mjs';
import { digest } from './store.mjs';
import { ensure } from './record-data.mjs';
import { labels, displayValue, plainNote, domainName, actionLabel, domainPalette, actionPalette, recordBlocks, reportPresentationRecipe, reportForDisplay, reportCoverCards, chartModel, cardColumns, CHART_COLORS, trainingName, trainingMeta, trainingSummary } from './report-format.mjs';

export function pdfRuntime(options = {}) {
  // Order: --runtime > LIFEOS_PDF_RUNTIME > ~/lifeos-runtime/pdf (per-machine, outside synced folders) > <workspace>/runtime/lifeos-pdf.
  // The automatic after-sleep report passes no options, so it relies on the two default locations.
  const defaults = [path.join(os.homedir(), 'lifeos-runtime', 'pdf'), path.resolve(ROOT, '..', 'runtime', 'lifeos-pdf')];
  const root = options.runtime ?? process.env.LIFEOS_PDF_RUNTIME ?? defaults.find(dir => fs.existsSync(path.join(dir, 'node_modules/pdfkit/package.json'))) ?? null;
  ensure(root && path.isAbsolute(root), 'PDF output needs an external runtime directory; run tools/report-setup.mjs first.');
  const require = createRequire(path.join(root, 'package.json'));
  const PDFDocument = require('pdfkit'), version = JSON.parse(fs.readFileSync(path.join(root, 'node_modules/pdfkit/package.json'), 'utf8')).version;
  const fonts = options.font ? [{ path: options.font, family: options.font_family ?? undefined }] : [
    { path: 'C:/Windows/Fonts/msyh.ttc', family: 'MicrosoftYaHei' }, { path: 'C:/Windows/Fonts/simhei.ttf' },
    { path: '/System/Library/Fonts/PingFang.ttc', family: 'PingFangSC-Regular' },
    { path: '/System/Library/Fonts/Supplemental/Arial Unicode.ttf' }, { path: '/Library/Fonts/Arial Unicode.ttf' },
    { path: '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', family: 'NotoSansCJKsc-Regular' },
    { path: path.join(root, 'fonts/NotoSansCJKsc-Regular.otf') }
  ];
  const font = fonts.find(font => fs.existsSync(font.path)); ensure(font, 'An embeddable CJK font is required; pass --font and optional --font-family.');
  return { PDFDocument, font, identity: { engine: 'pdfkit', version, font_sha256: digest(fs.readFileSync(font.path)), ...reportPresentationRecipe() } };
}

export async function renderReportPDF(report, runtime) {
  report = reportForDisplay(report);
  const l = labels(report.language), T = l.chart;
  const doc = new runtime.PDFDocument({ size: 'A4', margins: { top: 36, bottom: 46, left: 36, right: 36 }, bufferPages: true,
    info: { Title: report.date + ' · ' + l.title, Author: 'LifeOS', Subject: report.basis === 'fictional' ? l.fictional : l.scope, Creator: 'LifeOS daily reporting' } });
  doc.registerFont('Body', runtime.font.path, runtime.font.family); doc.font('Body');
  const chunks = [], completed = new Promise((resolve, reject) => { doc.on('data', chunk => chunks.push(chunk)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject); });
  const left = 36, width = doc.page.width - 72, bottom = () => doc.page.height - 50;
  const ink = '#303D38', muted = '#6E7971', paper = '#FCFAF6', border = '#E5E5DA';
  let y = 36, sectionNumber = 0; const unsupported = new Set();
  const safeText = value => [...String(value ?? '')].map(character => {
    const point = character.codePointAt(0); if (character === '\n' || character === '\t' || doc._font.font.hasGlyphForCodePoint(point)) return character;
    unsupported.add(point); return '[U+' + point.toString(16).toUpperCase() + ']';
  }).join('');
  const put = (text, x, yy, size = 10, color = ink) => doc.font('Body').fontSize(size).fillColor(color).text(safeText(text), x, yy, { lineBreak: false });
  const lines = (text, maxWidth, size) => {
    doc.font('Body').fontSize(size); const result = [];
    for (const paragraph of safeText(text).replaceAll('\t', '  ').split('\n')) {
      // Break CJK text between characters and Latin text between words; a word wider than the line still breaks by character.
      const tokens = paragraph.match(/[⺀-￿]|[^\s⺀-￿]+\s*|\s+/g) ?? [];
      let current = '';
      for (const token of tokens) {
        if (!current || doc.widthOfString(current + token.trimEnd()) <= maxWidth) { current += token; continue; }
        result.push(current.trimEnd()); current = token.trimStart();
        while (current.length > 1 && doc.widthOfString(current.trimEnd()) > maxWidth) { let cut = current.length - 1; while (cut > 1 && doc.widthOfString(current.slice(0, cut)) > maxWidth) cut--; result.push(current.slice(0, cut)); current = current.slice(cut); }
      }
      result.push(current.trimEnd());
    }
    return result;
  };
  const background = () => doc.rect(0, 0, doc.page.width, doc.page.height).fill(paper);
  const newPage = () => {
    doc.addPage(); background(); doc.font('Body'); y = 64;
    put('LifeOS  /  DAILY NOTES', left, 28, 8.5, '#477761');
    put(report.date, left + width - 75, 28, 9, muted);
    if (report.basis === 'fictional') put(l.fictional, left, 44, 7.2, '#98682E');
  };
  const ensureRoom = height => { if (y + height > bottom()) newPage(); };
  const beginDetails = estimate => { ensureRoom(Math.min(estimate, bottom() - 64)); y += 8; };
  const paragraph = (text, size = 9.3, color = ink, indent = 0, gap = 5) => {
    for (const line of lines(text, width - indent, size)) { ensureRoom(size * 1.5); put(line, left + indent, y, size, color); y += size * 1.5; }
    y += gap;
  };
  const heading = (text, number, subtitle = null) => {
    number = String(++sectionNumber).padStart(2, '0');
    ensureRoom(55); y += 5;
    doc.roundedRect(left, y, 26, 22, 6).fill('#E4EDE3'); put(number, left + 6, y + 4, 9, '#477761');
    put(text, left + 36, y - 1, 17, ink); y += 31;
    if (subtitle) paragraph(subtitle, 8.5, muted);
  };
  const icon = (type, x, yy, size, accent) => {
    const shapes = {
      work: 'M5 8 L5 5 Q5 3 7 3 L17 3 Q19 3 19 5 L19 8 M3 8 L21 8 L21 21 L3 21 Z M3 12 Q12 17 21 12 M10 14 L14 14',
      book: 'M12 5 Q6 2 2 5 L2 20 Q7 17 12 20 Q17 17 22 20 L22 5 Q18 2 12 5 Z M12 5 L12 20',
      activity: 'M2 12 L7 12 L10 4 L14 20 L17 12 L22 12',
      moon: 'M20 16 Q10 19 8 9 Q7 5 10 2 Q2 4 2 12 Q2 21 11 22 Q18 22 20 16 Z',
      food: 'M8 2 L8 10 M4 2 L4 7 Q4 11 8 11 Q12 11 12 7 L12 2 M8 11 L8 22 M19 2 Q15 8 19 12 L21 12 L21 22 M21 2 L21 12',
      wallet: 'M3 5 L19 5 L19 9 M3 5 L3 20 L22 20 L22 9 L3 9 M22 12 L15 12 L15 17 L22 17',
      bag: 'M4 8 L20 8 L21 22 L3 22 Z M8 9 L8 6 Q8 1 12 1 Q16 1 16 6 L16 9',
      chat: 'M3 3 L21 3 L21 17 L10 17 L4 22 L4 17 L3 17 Z M7 8 L17 8 M7 12 L14 12',
      compass: 'M12 2 A10 10 0 1 1 11.99 2 M15 8 L13 14 L8 16 L10 10 Z',
      note: 'M5 2 L19 2 L19 22 L5 22 Z M8 8 L16 8 M8 12 L16 12 M8 16 L13 16'
    };
    doc.save().translate(x, yy).scale(size / 24).lineWidth(1.35).lineCap('round').lineJoin('round').strokeColor(accent);
    doc.path(shapes[type] ?? shapes.note).stroke(); doc.restore();
  };
  // Full cards continue onto another page rather than clipping source prose to fit.
  const card = ({ title, text, meta = '', palette, symbol = 'note', size = 10 }) => {
    const rows = [...lines(text, width - 34, size).map(text => ({ text, size, color: ink, height: size * 1.5 })),
      ...(meta ? lines(meta, width - 34, 8) : []).map(text => ({ text, size: 8, color: muted, height: 12 }))];
    let offset = 0;
    do {
      const desired = 50 + rows.slice(offset).reduce((total, row) => total + row.height, 0);
      ensureRoom(Math.min(desired + 9, bottom() - 64));
      let count = 0, bodyHeight = 0;
      while (offset + count < rows.length && y + 50 + bodyHeight + rows[offset + count].height <= bottom()) bodyHeight += rows[offset + count++].height;
      if (!count) { newPage(); continue; }
      const last = offset + count === rows.length, h = 50 + bodyHeight;
      doc.roundedRect(left, y, width, h, 10).fill(palette.pale);
      icon(symbol, left + 13, y + 11, 17, palette.accent); put(title + (offset ? ' / ' + l.continued : ''), left + 38, y + 11, 10, palette.accent);
      let rowY = y + 36;
      for (const row of rows.slice(offset, offset + count)) { put(row.text, left + 17, rowY, row.size, row.color); rowY += row.height; }
      y += h + 9; offset += count;
      if (!last) newPage();
    } while (offset < rows.length);
  };
  const metricCard = (metric, x, yy, w, h, cover = false) => {
    const p = domainPalette(metric.domain), titleLines = lines(metric.label, w - 48, cover ? 10 : 8.5);
    doc.roundedRect(x, yy, w, h, cover ? 12 : 8).fill(p.pale); icon(p.icon, x + w - (cover && w < 200 ? 24 : 32), yy + 11, cover ? (w > 200 ? 23 : 15) : 17, p.accent);
    titleLines.forEach((line, index) => put(line, x + 12, yy + 10 + index * 12, cover ? 10 : 8.5, p.accent));
    let size = metric.type === 'note' ? 17 : metric.value == null ? 9.5 : cover ? (w > 200 ? 27 : 19) : 19;
    const value = metric.type === 'note' ? l.recorded : displayValue(metric, l), valueWidth = w - 24;
    doc.font('Body').fontSize(size); while (doc.widthOfString(safeText(value)) > valueWidth && size > 7) doc.fontSize(size -= .5);
    put(value, x + 12, yy + (cover ? 14 : 11) + titleLines.length * 12, size, metric.value == null ? muted : ink);
    if (metric.type === 'note') {
      const preview = lines(metric.text.replaceAll('\n', ' '), w - 36, 8.5);
      put(preview[0] + (preview.length > 1 ? ' …' : ''), x + 12, yy + 57, 8.5, ink);
    }
    const metadata = lines(plainNote(metric, l), w - 24, cover ? 7.8 : 7.1);
    metadata.forEach((line, index) => put(line, x + 12, yy + h - 10 - metadata.length * 10 + index * 10, cover ? 7.8 : 7.1, muted));
  };

  background();
  doc.roundedRect(left, 36, width, 96, 14).fill('#F5E7D5');
  put('LifeOS  /  DAILY NOTES', left + 18, 50, 8.5, '#8B633B');
  put(l.snapshot, left + 18, 68, 22, ink);
  put(report.date, left + 18, 100, 15, '#8B633B');
  // Decoration carries no score, mood or health judgment.
  doc.save().strokeColor('#B8905D').lineWidth(1);
  const sunX = left + width - 52, sunY = 82;
  doc.circle(sunX, sunY, 15).fill('#E6BC75');
  doc.moveTo(sunX - 28, sunY + 11).lineTo(sunX + 28, sunY + 11).stroke();
  doc.moveTo(sunX - 19, sunY + 17).lineTo(sunX + 19, sunY + 17).stroke(); doc.restore();
  y = 148;
  if (report.basis === 'fictional') {
    doc.roundedRect(left, y, width, 24, 7).fill('#FAEDD1'); put(l.fictional, left + 12, y + 6, 8.5, '#906326'); y += 33;
  }
  paragraph(l.title, 9.5, '#477761', 0, 6);
  const coverMetrics = reportCoverCards(report, runtime.identity);
  if (coverMetrics.length) {
    const coverWidth = (width - 10 * (coverMetrics.length - 1)) / coverMetrics.length, height = coverMetrics.some(item => item.type === 'note') ? 96 : 66;
    ensureRoom(height + 2); coverMetrics.forEach((metric, col) => metricCard(metric, left + col * (coverWidth + 10), y, coverWidth, height, true)); y += height + 12;
  }
  if (!report.metrics.length && !report.sections.length && !report.actions.length && !report.followups.length && !report.summary.length && !report.trends.length) paragraph(l.emptyReport, 10, muted);

  // ---- helpers for the chart row (same numbers as the HTML view, from chartModel)
  const col = CHART_COLORS;
  const textWidth = (text, size) => { doc.font('Body').fontSize(size); return doc.widthOfString(safeText(text)); };
  const clip = (text, size, maxWidth) => { let out = String(text); if (textWidth(out, size) <= maxWidth) return out; while (out.length > 1 && textWidth(out + '…', size) > maxWidth) out = out.slice(0, -1); return out + '…'; };
  const right = (text, xRight, yy, size, color) => put(text, xRight - textWidth(text, size), yy, size, color);
  const sequence = (parts, x, yy) => { const biggest = Math.max(...parts.map(part => part[1])); let cursor = x; for (const [text, size, color] of parts) { put(text, cursor, yy + (biggest - size) * 0.8, size, color); cursor += textWidth(text, size) + 1; } };
  const dotLegend = (items, x, yy, maxWidth, size = 7) => {
    let lx = x, ly = yy;
    for (const item of items) {
      const w = textWidth(item.text, size) + 16;
      if (lx > x && lx + w > x + maxWidth) { lx = x; ly += 11; }
      doc.circle(lx + 2.5, ly + 4, 2.3).fill(item.color); put(item.text, lx + 8, ly, size, muted); lx += w;
    }
  };
  const model = chartModel(report), chartCards = [];
  if (model.meals.length) chartCards.push({ title: T.meals,
    footer: (fx, fy) => sequence([[T.day, 8, muted], [String(Math.round(model.dayKcal)), 9, ink], [T.kcal, 8, muted]], fx, fy + 6),
    body: (bx, by, bw, bh) => {
      const meals = model.meals, rowH = Math.min(26, bh / meals.length), top = by + (bh - rowH * meals.length) / 2, max = Math.max(...meals.map(m => m.kcal));
      meals.forEach((m, i) => {
        const labelW = Math.min(70, Math.max(30, ...meals.map(item => textWidth(String(item.meal), 7.5) + 6)));
        const yy = top + i * rowH, barH = Math.min(16, rowH - 7), barW = Math.max(4, (bw - labelW - 30) * m.kcal / max);
        put(m.meal, bx, yy + (rowH - 8) / 2 - 1, 7.5, muted);
        doc.roundedRect(bx + labelW, yy + (rowH - barH) / 2, barW, barH, 4).fill(col.kcal);
        put(String(Math.round(m.kcal)), bx + labelW + barW + 5, yy + (rowH - 8) / 2 - 1, 8, ink);
      });
    } });
  if (model.macro) chartCards.push({ title: T.macro,
    footer: (fx, fy, fw) => dotLegend(model.macro.order.map(key => ({ color: col[key], text: T[key] + ' ' + Math.round(model.macro.g[key]) + 'g ' + Math.round(model.macro.energy[key] / model.macro.sum * 100) + '%' })), fx, fy, fw),
    body: (bx, by, bw) => {
      const { energy, sum, order } = model.macro, cx = bx + bw / 2, cy = by + 40, r = 29; let angle = -Math.PI / 2;
      doc.save().lineWidth(10).lineCap('butt');
      doc.circle(cx, cy, r).strokeColor('#ECE6DA').stroke();
      for (const key of order) {
        const sweep = energy[key] / sum * Math.PI * 2; if (sweep <= 0) continue;
        if (sweep >= Math.PI * 2 - 1e-6) { doc.circle(cx, cy, r).strokeColor(col[key]).stroke(); continue; }
        const a1 = angle + sweep;
        doc.path('M ' + (cx + r * Math.cos(angle)) + ' ' + (cy + r * Math.sin(angle)) + ' A ' + r + ' ' + r + ' 0 ' + (sweep > Math.PI ? 1 : 0) + ' 1 ' + (cx + r * Math.cos(a1)) + ' ' + (cy + r * Math.sin(a1))).strokeColor(col[key]).stroke(); angle = a1;
      }
      doc.restore();
      const total = String(Math.round(model.dayKcal)); put(total, cx - textWidth(total, 15) / 2, cy - 9, 15, ink); put('kcal', cx - textWidth('kcal', 6.5) / 2, cy + 8, 6.5, muted);
    } });
  if (model.training) chartCards.push({ title: T.training, footer: (fx, fy) => put(trainingSummary(model.training, l), fx, fy + 6, 8, muted),
    body: (bx, by, bw, bh) => {
      const rows = model.training.flatMap(session => session.activities).slice(0, 8), rowH = Math.min(25, bh / rows.length), two = rowH >= 20, top = by + (bh - rowH * rows.length) / 2;
      rows.forEach((activity, i) => {
        const yy = top + i * rowH, meta = trainingMeta(activity, l), nameWidth = two ? bw - 46 : bw * 0.5;
        put(clip(trainingName(activity.name), 8.3, nameWidth), bx, yy + (two ? 1 : (rowH - 8) / 2), 8.3, ink);
        const dots = Math.min(activity.sets ?? 0, 6);
        for (let k = 0; k < dots; k++) doc.circle(bx + bw - 3 - (dots - 1 - k) * 5.5, yy + 5, 1.8).fill('#287B65');
        if (two) put(clip(meta, 7, bw), bx, yy + 12.5, 7, muted); else right(clip(meta, 7, bw * 0.45), bx + bw, yy + (rowH - 7) / 2, 7, muted);
      });
    } });
  if (model.sleep) chartCards.push({ title: T.stages,
    footer: (fx, fy, fw) => { const sd = model.sleep, chips = [sd.efficiency != null ? T.eff + ' ' + sd.efficiency + '%' : null, sd.score != null ? T.score + ' ' + sd.score : null, sd.heart_rate != null ? T.hr + ' ' + sd.heart_rate : null, sd.awakenings != null ? T.wake + ' ' + sd.awakenings + T.times : null].filter(Boolean);
      lines(chips.join('  ·  '), fw, 7.2).slice(0, 2).forEach((line, i) => put(line, fx, fy + i * 10, 7.2, muted)); },
    body: (bx, by, bw) => {
      const sd = model.sleep;
      sequence([[String(sd.hours), 22, '#4B3F8C'], [T.hUnit, 8, muted], [String(sd.minutes), 22, '#4B3F8C'], [T.mUnit, 8, muted]], bx, by);
      put(sd.bed + ' → ' + sd.wake, bx, by + 30, 8.5, muted);
      const parts = [[T.deep, sd.deep, col.deep], [T.light, sd.light, col.light], [T.rem, sd.rem, col.rem]].filter(item => item[1]);
      if (parts.length) {
        doc.save().roundedRect(bx, by + 50, bw, 9, 4.5).clip(); let cursor = bx;
        for (const [, stage, color] of parts) { const w = bw * stage.pct / 100; doc.rect(cursor, by + 50, w + .5, 9).fill(color); cursor += w; }
        doc.restore();
        const colW = bw / parts.length;
        parts.forEach(([name, stage, color], i) => { doc.circle(bx + i * colW + 2.5, by + 70, 2.3).fill(color); put(name + ' ' + stage.pct + '%', bx + i * colW + 8, by + 66.5, 7, ink); put(stage.time, bx + i * colW + 8, by + 76, 6.5, muted); });
      }
    } });
  if (model.week) chartCards.push({ title: T.week,
    footer: (fx, fy) => sequence([[T.avg, 8, muted], [(model.week.reduce((sum, point) => sum + point.value, 0) / model.week.length).toFixed(1), 9, ink], [T.h, 8, muted]], fx, fy + 6),
    body: (bx, by, bw, bh) => {
      const pts = model.week, max = Math.max(9, ...pts.map(point => point.value)), slot = bw / pts.length, barW = Math.min(18, slot * 0.6), chartH = bh - 24;
      pts.forEach((point, i) => {
        const h = Math.max(3, point.value / max * chartH), x = bx + i * slot + (slot - barW) / 2, top = by + 12 + chartH - h;
        doc.roundedRect(x, top, barW, h, 3).fill(col.sleep);
        const label = String(point.value); put(label, x + barW / 2 - textWidth(label, 7) / 2, top - 10, 7, ink);
        const date = point.date.slice(5); put(date, x + barW / 2 - textWidth(date, 6.3) / 2, by + 12 + chartH + 5, 6.3, muted);
      });
    } });
  if (chartCards.length) {
    const cardHeight = 148, gap = 10, cols = cardColumns(chartCards.length), cardWidth = (width - gap * (cols - 1)) / cols;
    for (let index = 0; index < chartCards.length; index += cols) {
      ensureRoom(cardHeight + gap);
      chartCards.slice(index, index + cols).forEach((item, k) => {
        const x = left + k * (cardWidth + gap);
        doc.roundedRect(x, y, cardWidth, cardHeight, 11).fill('#FFFFFF'); doc.roundedRect(x, y, cardWidth, cardHeight, 11).lineWidth(.6).strokeColor(border).stroke();
        put(item.title, x + 12, y + 11, 9.5, '#477761');
        item.body(x + 12, y + 32, cardWidth - 24, 90); item.footer(x + 12, y + cardHeight - 26, cardWidth - 24);
      });
      y += cardHeight + gap;
    }
  }

  // ---- shortfalls and improvements
  const advice = report.advice;
  if (advice && (advice.flags.length || advice.ok.length)) {
    heading(T.advice);
    const colWidth = (width - 10) / 2;
    for (let index = 0; index < advice.flags.length; index += 2) {
      const row = advice.flags.slice(index, index + 2), heights = row.map(item => 14 + lines(item.text, colWidth - 66, 8.6).length * 12.2), cardH = Math.max(...heights, 34);
      ensureRoom(cardH + 8);
      row.forEach((item, k) => {
        const x = left + k * (colWidth + 10), low = item.level === 'low';
        doc.roundedRect(x, y, colWidth, cardH, 9).fill('#FFFFFF'); doc.roundedRect(x, y, colWidth, cardH, 9).lineWidth(.6).strokeColor(border).stroke();
        doc.roundedRect(x, y + 6, 3.5, cardH - 12, 1.7).fill(low ? '#C98A2B' : '#D06A5A');
        doc.roundedRect(x + 13, y + 9, 32, 14, 5).fill(low ? '#FAEDD1' : '#FBE9E5'); put(T[item.level], x + 18, y + 12, 8, low ? '#906326' : '#A3483A');
        lines(item.text, colWidth - 66, 8.6).forEach((line, i) => put(line, x + 54, y + 9 + i * 12.2, 8.6, ink));
      });
      y += cardH + 8;
    }
    if (!advice.flags.length) paragraph(T.allGood, 9, muted);
    if (advice.ok.length) {
      let px = left; ensureRoom(24); put(T.met, px, y + 5, 8, muted); px += 30;
      for (const item of advice.ok) {
        const w = textWidth(item.text, 8) + 16; if (px + w > left + width) { px = left; y += 22; ensureRoom(24); }
        doc.roundedRect(px, y, w, 18, 9).fill('#E4EDE3'); put(item.text, px + 8, y + 5, 8, '#2F6B52'); px += w + 6;
      }
      y += 26;
    }
  }
  // remaining small metrics as a strip
  const onCover = new Set(coverMetrics.filter(item => item.type === 'metric').map(item => item.id ?? item.label)), restMetrics = report.metrics.filter(item => !onCover.has(item.id ?? item.label));
  if (restMetrics.length) {
    let px = left; ensureRoom(28);
    for (const metric of restMetrics) {
      const value = displayValue(metric, l), w = textWidth(metric.label, 7.5) + textWidth(value, 10.5) + 28; if (px + w > left + width) { px = left; y += 28; ensureRoom(28); }
      doc.roundedRect(px, y, w, 22, 8).fill('#FDF3DC'); put(metric.label, px + 10, y + 7, 7.5, '#8B633B'); put(value, px + 18 + textWidth(metric.label, 7.5), y + 5.5, 10.5, ink); px += w + 8;
    }
    y += 32;
  }

  if (report.actions.length || report.followups.length || report.summary.length) {
    beginDetails(90 + report.actions.length * 105 + report.followups.length * 95 + report.summary.length * 95);
    if (report.actions.length) heading(l.actionDetail);
    for (const action of report.actions) card({ title: domainName(action.domain, l), text: action.text, palette: actionPalette(action), symbol: domainPalette(action.domain).icon,
      meta: actionLabel(action, l) + '\n' + l.due + ': ' + (action.due ?? l.unknown) + '  ·  ' + l.owner + ': ' + action.owner });
    if (report.followups.length) heading(l.followups);
    for (const item of report.followups) card({ title: domainName(item.domain, l), text: item.text, palette: domainPalette(item.domain), symbol: 'chat', size: 9.5 });
    if (report.summary.length) heading(l.summary);
    for (const item of report.summary) card({ title: item.kind === 'hypothesis' ? l.inferred : l.recorded, text: item.text, palette: domainPalette(item.domain ?? 'health'), symbol: 'note', size: 9.5 });
  }

  // trends other than sleep (sleep has its own chart); the display projection already drops single-day trends
  const lineTrends = report.trends.filter(trend => trend.metric_id !== 'sleep_h');
  if (lineTrends.length) {
    beginDetails(70 + Math.ceil(lineTrends.length / 2) * 150); heading(l.trends);
    const chart = (trend, x, yy, w, h) => {
      const p = domainPalette(trend.domain), chartX = x + 26, chartY = yy + 33, chartW = w - 39, chartH = 50;
      doc.roundedRect(x, yy, w, h, 9).fill('#FFFFFF'); put(trend.label + ' / ' + (l.units[trend.unit] ?? trend.unit), x + 12, yy + 10, 8.5, p.accent);
      const known = trend.points.filter(point => point.value != null).map(point => point.value), min = Math.min(0, ...known), max = Math.max(1, ...known), span = max - min || 1;
      for (const fraction of [0, .5, 1]) doc.moveTo(chartX, chartY + chartH * fraction).lineTo(chartX + chartW, chartY + chartH * fraction).lineWidth(.5).strokeColor(border).stroke();
      put(max, x + 6, chartY - 3, 6, muted); put(min, x + 6, chartY + chartH - 6, 6, muted);
      let previous = null;
      trend.points.forEach((point, index) => {
        const xx = chartX + chartW * index / Math.max(1, trend.points.length - 1), yyPoint = chartY + chartH - chartH * (point.value - min) / span, stride = Math.max(1, Math.ceil(trend.points.length / 7));
        if (previous) doc.moveTo(previous.x, previous.y).lineTo(xx, yyPoint).lineWidth(1.6).strokeColor(p.accent).stroke();
        doc.circle(xx, yyPoint, 2.6).fill(p.accent);
        if (index % stride === 0 || index === trend.points.length - 1) { put(point.value, xx - 8, yyPoint - 13, 6.2, ink); put(point.date.slice(5), xx - 9, chartY + chartH + 8, 6, muted); }
        previous = { x: xx, y: yyPoint };
      });
    };
    for (let index = 0; index < lineTrends.length; index += 2) {
      const row = lineTrends.slice(index, index + 2), w = (width - 12) / 2, height = 112;
      ensureRoom(height + 9); row.forEach((trend, c) => chart(trend, left + c * (w + 12), y, w, height)); y += height + 9;
    }
  }

  // ---- detail tables and notes (the sleep card replaces the sleep table)
  const pdfSections = report.sleep_detail ? report.sections.map(section => ({ ...section, items: section.items.filter(item => !item.sleep) })).filter(section => section.items.length) : report.sections;
  const drawTable = (block, indent) => {
    const cols = block.headers.length, cellWidth = (width - indent) / cols, rowH = 17;
    const drawRow = (cells, header) => {
      ensureRoom(rowH + 2);
      if (header) doc.rect(left + indent, y, width - indent, rowH).fill('#F1F4EE');
      cells.forEach((cell, c) => put(clip(cell || '—', 8.4, cellWidth - 10), left + indent + c * cellWidth + 6, y + 4.5, 8.4, header ? muted : ink));
      doc.moveTo(left + indent, y + rowH).lineTo(left + width, y + rowH).lineWidth(.4).strokeColor(border).stroke(); y += rowH;
    };
    drawRow(block.headers, true); block.rows.forEach(row => drawRow(row, false)); y += 4;
  };
  if (pdfSections.length) {
    const itemHeight = item => recordBlocks(item.text).reduce((sum, block) => sum + (block.type === 'table' ? 17 * (block.rows.length + 1) + 8 : Math.ceil(block.text.length / 45) * 14 + 5), 0);
    beginDetails(40 + pdfSections.reduce((height, section) => height + 34 + section.items.reduce((total, item) => total + itemHeight(item), 0), 0)); heading(l.domainDetail);
    for (const section of pdfSections) {
      const p = domainPalette(section.domain); ensureRoom(58);
      icon(p.icon, left + 1, y + 1, 19, p.accent); put(domainName(section.domain, l), left + 31, y + 2, 11, p.accent); y += 26;
      for (const item of section.items) {
        for (const block of recordBlocks(item.text)) {
          if (block.type === 'table') drawTable(block, 31);
          else paragraph(block.text, 9, item.evidence === 'inferred' ? '#78639C' : ink, 31, 3);
        }
      }
      y += 8;
    }
  }
  const range = doc.bufferedPageRange();
  for (let page = 0; page < range.count; page++) {
    doc.switchToPage(range.start + page); doc.font('Body');
    doc.moveTo(left, doc.page.height - 34).lineTo(left + width, doc.page.height - 34).strokeColor(border).lineWidth(.5).stroke();
    put('LifeOS  /  ' + report.date, left, doc.page.height - 25, 7.5, muted);
    put(String(page + 1).padStart(2, '0') + ' / ' + String(range.count).padStart(2, '0'), left + width - 42, doc.page.height - 25, 7.5, muted);
  }
  doc.end(); return { bytes: await completed, pages: range.count, unsupported_codepoints: [...unsupported].map(point => 'U+' + point.toString(16).toUpperCase()), renderer: runtime.identity };
}
