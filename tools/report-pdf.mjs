// Optional PDFKit runtime. All decoration is local vector drawing; CJK text is embedded.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT } from './lib.mjs';
import { digest } from './store.mjs';
import { ensure } from './record-data.mjs';
import { labels, displayValue, plainNote, domainName, actionLabel, domainPalette, actionPalette, recordBlocks, reportPresentationRecipe, reportForDisplay, reportCoverCards } from './report-format.mjs';

export function pdfRuntime(options = {}) {
  const localRuntime = path.resolve(ROOT, '..', 'runtime', 'lifeos-pdf');
  const root = options.runtime ?? process.env.LIFEOS_PDF_RUNTIME ?? (fs.existsSync(path.join(localRuntime, 'package.json')) ? localRuntime : null);
  ensure(root && path.isAbsolute(root), 'PDF output needs an external runtime directory; run tools/report-setup.mjs first.');
  const require = createRequire(path.join(root, 'package.json'));
  const PDFDocument = require('pdfkit'), version = JSON.parse(fs.readFileSync(path.join(root, 'node_modules/pdfkit/package.json'), 'utf8')).version;
  const fonts = options.font ? [{ path: options.font, family: options.font_family ?? undefined }] : [
    { path: 'C:/Windows/Fonts/msyh.ttc', family: 'MicrosoftYaHei' }, { path: 'C:/Windows/Fonts/simhei.ttf' },
    { path: '/System/Library/Fonts/PingFang.ttc', family: 'PingFangSC-Regular' },
    { path: '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', family: 'NotoSansCJKsc-Regular' },
    { path: path.join(root, 'fonts/NotoSansCJKsc-Regular.otf') }
  ];
  const font = fonts.find(font => fs.existsSync(font.path)); ensure(font, 'An embeddable CJK font is required; pass --font and optional --font-family.');
  return { PDFDocument, font, identity: { engine: 'pdfkit', version, font_sha256: digest(fs.readFileSync(font.path)), ...reportPresentationRecipe() } };
}

export async function renderReportPDF(report, runtime) {
  report = reportForDisplay(report);
  const l = labels(report.language);
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
      let current = ''; for (const char of [...paragraph]) { if (current && doc.widthOfString(current + char) > maxWidth) { result.push(current); current = char; } else current += char; } result.push(current);
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
    doc.roundedRect(x, yy, w, h, cover ? 12 : 8).fill(p.pale); icon(p.icon, x + w - 32, yy + 11, cover ? 23 : 17, p.accent);
    titleLines.forEach((line, index) => put(line, x + 12, yy + 10 + index * 12, cover ? 10 : 8.5, p.accent));
    let size = metric.type === 'note' ? 17 : metric.value == null ? 9.5 : cover ? 27 : 19;
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
  doc.roundedRect(left, 36, width, 151, 17).fill('#F5E7D5');
  put('LifeOS  /  DAILY NOTES', left + 19, 53, 9, '#8B633B');
  put(l.snapshot, left + 19, 78, 25, ink);
  put(report.date, left + 19, 113, 22, '#8B633B');
  put(l.snapshotNote, left + 19, 153, 10, '#7D6B55');
  // Decoration carries no score, mood or health judgment.
  doc.save().strokeColor('#B8905D').lineWidth(1.2);
  const sunX = left + width - 67, sunY = 108;
  doc.circle(sunX, sunY, 21).fill('#E6BC75');
  for (const angle of [-150, -110, -70, -30, 10]) {
    const a = angle * Math.PI / 180; doc.moveTo(sunX + Math.cos(a) * 29, sunY + Math.sin(a) * 29).lineTo(sunX + Math.cos(a) * 35, sunY + Math.sin(a) * 35).stroke();
  }
  doc.moveTo(sunX - 38, sunY + 15).lineTo(sunX + 38, sunY + 15).stroke();
  doc.moveTo(sunX - 26, sunY + 23).lineTo(sunX + 26, sunY + 23).stroke(); doc.restore();
  y = 202;
  if (report.basis === 'fictional') {
    doc.roundedRect(left, y, width, 24, 7).fill('#FAEDD1'); put(l.fictional, left + 12, y + 6, 8.5, '#906326'); y += 33;
  }
  paragraph(l.title, 10, '#477761', 0, 3);
  if (report.sleep_context) paragraph(l.sleepDate + report.sleep_context.wake_date, 8.5, muted, 0, 3);
  paragraph(l.scope, 8.3, muted, 0, 7);
  paragraph(l.visibilityNote, 8.1, muted, 0, 5);
  const coverMetrics = reportCoverCards(report, runtime.identity);
  for (let index = 0; index < coverMetrics.length; index += 2) {
    const row = coverMetrics.slice(index, index + 2), coverWidth = (width - 12 * (row.length - 1)) / row.length, height = row.some(item => item.type === 'note') ? 110 : 96;
    ensureRoom(height + 2); row.forEach((metric, col) => metricCard(metric, left + col * (coverWidth + 12), y, coverWidth, height, true)); y += height + 12;
  }
  if (!report.metrics.length && !report.sections.length && !report.actions.length && !report.followups.length && !report.summary.length && !report.trends.length) paragraph(l.emptyReport, 10, muted);
  if (report.actions.length) heading(l.actionPreview, '01');
  for (const [index, action] of report.actions.slice(0, 3).entries()) {
    const p = actionPalette(action); ensureRoom(57); doc.roundedRect(left, y, width, 51, 9).fill('#FFFFFF');
    doc.circle(left + 19, y + 18, 9).fill(p.pale); put(index + 1, left + 16, y + 12, 8.5, p.accent);
    const preview = lines(action.text, width - 57, 9.5);
    put(preview.length > 1 ? preview[0] + ' …' : preview[0], left + 36, y + 8, 9.5);
    put(actionLabel(action, l), left + 36, y + 29, 8, p.accent); y += 57;
  }
  if (report.actions.length) paragraph(l.allActions, 8, muted);

  if (report.actions.length || report.followups.length || report.summary.length) {
    beginDetails(90 + report.actions.length * 105 + report.followups.length * 95 + report.summary.length * 95);
    if (report.actions.length) heading(l.actionDetail, '02', l.actionScope);
    for (const action of report.actions) card({ title: domainName(action.domain, l), text: action.text, palette: actionPalette(action), symbol: domainPalette(action.domain).icon,
      meta: actionLabel(action, l) + '\n' + l.due + ': ' + (action.due ?? l.unknown) + '  ·  ' + l.owner + ': ' + action.owner });
    if (report.followups.length) heading(l.followups, '03', l.actionNote);
    for (const item of report.followups) card({ title: domainName(item.domain, l), text: item.text, palette: domainPalette(item.domain), symbol: 'chat', size: 9.5 });
    if (report.summary.length) heading(l.summary, '03');
    for (const item of report.summary) card({ title: item.kind === 'hypothesis' ? l.inferred : l.recorded, text: item.text, palette: domainPalette(item.domain ?? 'health'), symbol: 'note', size: 9.5 });
  }

  if (report.metrics.length || report.trends.length) beginDetails(70 + Math.ceil(report.metrics.length / 3) * 85 + Math.ceil(report.trends.length / 2) * 150);
  if (report.metrics.length) heading(l.dataDetail, '04', l.detailNote);
  const columns = 3, gutter = 7;
  for (let index = 0; index < report.metrics.length; index += columns) {
    const row = report.metrics.slice(index, index + columns);
    const cellWidth = (width - gutter * (row.length - 1)) / row.length;
    const height = Math.max(...row.map(metric => 48 + lines(metric.label, cellWidth - 48, 8.5).length * 12
      + lines(plainNote(metric, l), cellWidth - 24, 7.1).length * 10));
    ensureRoom(height + gutter); row.forEach((metric, col) => metricCard(metric, left + col * (cellWidth + gutter), y, cellWidth, height)); y += height + gutter;
  }
  if (report.metrics.some(metric => metric.domain === 'nutrition' && metric.coverage !== 'complete' && metric.value != null)) paragraph(l.foodNote, 8, '#9A6227', 0, 1);
  if (report.sleep_context) paragraph(l.sleepDate + report.sleep_context.wake_date, 8, muted, 0, 1);
  if (report.trends.length) {
    heading(l.trends, '05');
    const chart = (trend, x, yy, w, h) => {
      const p = domainPalette(trend.domain), chartX = x + 26, chartY = yy + 33, chartW = w - 39, chartH = 50;
      doc.roundedRect(x, yy, w, h, 9).fill('#FFFFFF'); put(trend.label + ' / ' + (l.units[trend.unit] ?? trend.unit), x + 12, yy + 10, 8.5, p.accent);
      const known = trend.points.filter(point => point.value != null).map(point => point.value), min = Math.min(0, ...known), max = Math.max(1, ...known), span = max - min || 1;
      for (const fraction of [0, .5, 1]) doc.moveTo(chartX, chartY + chartH * fraction).lineTo(chartX + chartW, chartY + chartH * fraction).lineWidth(.5).strokeColor(border).stroke();
      put(max, x + 6, chartY - 3, 6, muted); put(min, x + 6, chartY + chartH - 6, 6, muted);
      let previous = null;
      trend.points.forEach((point, index) => {
        const xx = chartX + chartW * index / Math.max(1, trend.points.length - 1), yyPoint = point.value == null ? null : chartY + chartH - chartH * (point.value - min) / span;
        const stride = Math.max(1, Math.ceil(trend.points.length / 7));
        if (yyPoint != null) {
          if (previous) doc.moveTo(previous.x, previous.y).lineTo(xx, yyPoint).lineWidth(1.6).strokeColor(p.accent).stroke();
          doc.circle(xx, yyPoint, 2.6).fill(p.accent);
          if (index % stride === 0 || index === trend.points.length - 1) put(point.value, xx - 8, yyPoint - 13, 6.2, ink);
          previous = { x: xx, y: yyPoint };
        } else { doc.circle(xx, chartY + chartH / 2, 2.4).lineWidth(.8).strokeColor(muted).stroke(); previous = null; }
        // Dense charts space dates; complete points remain in JSON/Markdown.
        if (index % stride === 0 || index === trend.points.length - 1) put(point.date.slice(5), xx - 9, chartY + chartH + 8, 6, muted);
      });
    };
    for (let index = 0; index < report.trends.length; index += 2) {
      const row = report.trends.slice(index, index + 2), w = (width - 12) / 2, height = 112;
      ensureRoom(height + 9); row.forEach((trend, col) => chart(trend, left + col * (w + 12), y, w, height)); y += height + 9;
    }
    paragraph(l.trendNote, 7.5, muted);
  }

  if (report.sections.length) { beginDetails(55 + report.sections.reduce((height, section) => height + 42 + section.items.reduce((total, item) => total + Math.ceil(item.text.length / 45) * 14 + 5, 0), 0)); heading(l.domainDetail, '06', l.recordsNote); }
  for (const [index, section] of report.sections.entries()) {
    const p = domainPalette(section.domain); ensureRoom(58);
    icon(p.icon, left + 1, y + 1, 19, p.accent); put(String(index + 1).padStart(2, '0') + '  ' + domainName(section.domain, l), left + 31, y + 2, 11, p.accent);
    const status = l[section.status] ?? section.status; doc.fontSize(8);
    put(status, left + width - doc.widthOfString(safeText(status)), y + 4, 8, muted); y += 26;
    if (!section.items.length) paragraph(status, 8.5, muted, 31, 3);
    for (const item of section.items) {
      const prefix = l.plain[item.evidence] ? l.plain[item.evidence] + ': ' : '';
      for (const block of recordBlocks(item.text)) {
        if (block.type === 'table') {
          for (const row of block.rows) paragraph(row.map((cell, col) => block.headers[col] + ': ' + (cell || '—')).join(' · '), 8.5, ink, 31, 2);
          if (prefix) paragraph(l.plain[item.evidence], 7.5, muted, 31, 3);
        } else paragraph(prefix + block.text, 9, item.evidence === 'inferred' ? '#78639C' : ink, 31, 3);
      }
    }
    doc.moveTo(left + 31, y + 3).lineTo(left + width, y + 3).lineWidth(.5).strokeColor(border).stroke(); y += 13;
  }

  if (report.gaps.length) { beginDetails(70 + report.gaps.length * 28); heading(l.gaps, '08'); }
  for (const gap of report.gaps) paragraph('• ' + (gap.domain ? domainName(gap.domain, l) + ': ' : '') + (l.gap[gap.code] ?? gap.code), 9, '#906326');
  // Source paths and checksums stay in report.json/bundle metadata; the human view keeps one pointer line.
  y += 6; paragraph(l.sourceFooter, 7.5, muted);
  const range = doc.bufferedPageRange();
  for (let page = 0; page < range.count; page++) {
    doc.switchToPage(range.start + page); doc.font('Body');
    doc.moveTo(left, doc.page.height - 34).lineTo(left + width, doc.page.height - 34).strokeColor(border).lineWidth(.5).stroke();
    put('LifeOS  /  ' + report.date, left, doc.page.height - 25, 7.5, muted);
    put(String(page + 1).padStart(2, '0') + ' / ' + String(range.count).padStart(2, '0'), left + width - 42, doc.page.height - 25, 7.5, muted);
  }
  doc.end(); return { bytes: await completed, pages: range.count, unsupported_codepoints: [...unsupported].map(point => 'U+' + point.toString(16).toUpperCase()), renderer: runtime.identity };
}
