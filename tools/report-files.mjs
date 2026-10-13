// Immutable derived reports; source/disclosure checks precede release and archived body reads.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib.mjs';
import { digest, stable, immutable, immutableBlob, withLock, readJSON, walk, vaultPath, currentHash } from './store.mjs';
import { ensure } from './record-data.mjs';
import { normalizeDailyReport, reportSourcePermitted, verifyReportSources } from './report-data.mjs';
import { reportMarkdown, reportHTML, reportPresentationRecipe } from './report-format.mjs';
import { pdfRuntime, renderReportPDF } from './report-pdf.mjs';

const archiveRoot = () => readJSON('project.json')?.reporting?.archive_directory ?? 'reports/daily';
function storedMetadata(selector) {
  ensure(typeof selector === 'string' && selector, 'Supply a report date, ID or exact archive-relative directory.');
  const all = walk(archiveRoot(), '.meta.json').filter(file => file.endsWith('/bundle.meta.json')).map(file => ({ ...readJSON(file), meta_path: file }));
  const candidates = all.filter(item => item.date === selector || item.report_id === selector || item.directory === selector);
  return candidates.sort((a, b) => b.generated_at.localeCompare(a.generated_at))[0] ?? null;
}
const metaAllowed = meta => meta.sources.every(reportSourcePermitted);
export async function generateDailyReport(input, options = {}) {
  const report = normalizeDailyReport(input);
  // The PDF renderer is an optional external runtime. With no renderer configured the export
  // downgrades to text-only and says so; an explicitly requested runtime that cannot be used is a
  // configuration error and still fails, so a mistyped path is never silently ignored.
  let runtime = null, pdfError = null;
  if (options.pdf !== false) {
    const required = options.runtime != null || process.env.LIFEOS_PDF_RUNTIME != null;
    try { runtime = pdfRuntime(options); } catch (error) {
      if (required) throw error;
      pdfError = error.message;
    }
  }
  const recipe = runtime?.identity ?? { engine: 'text_only', ...reportPresentationRecipe() };
  const fingerprint = digest(stable({ report, recipe })), reportId = 'report-' + fingerprint.slice(0, 24);
  const directory = archiveRoot() + '/' + report.date.slice(0, 4) + '/' + report.date + '/' + reportId;
  const rendered = runtime ? await renderReportPDF(report, runtime) : null;
  ensure(verifyReportSources(report).current, 'Report source changed during rendering; recollect before publishing.');
  const result = withLock('daily-report/' + report.date, () => {
    const metadataFile = directory + '/bundle.meta.json', old = readJSON(metadataFile);
    const meta = old ?? { schema_version: 1, report_id: reportId, directory, date: report.date, basis: report.basis,
      language: report.language, style: report.style, generated_at: new Date().toISOString(), fingerprint, recipe, sources: report.sources };
    ensure(meta.fingerprint === fingerprint && metaAllowed(meta), 'Stored report metadata differs or current disclosure blocks it.');
    immutable(metadataFile, meta);
    const json = { ...report, generated_at: meta.generated_at, report_id: reportId };
    immutable(directory + '/report.json', json);
    immutable(directory + '/report.md', reportMarkdown(report, recipe));
    immutable(directory + '/report.html', reportHTML(report, recipe));
    const publicationFile = directory + '/publication.json', existing = readJSON(publicationFile);
    // PDF metadata can vary by rendering instant; preserve an existing successful exact export.
    if (rendered && !fs.existsSync(vaultPath(directory + '/report.pdf'))) immutableBlob(directory + '/report.pdf', rendered.bytes);
    const files = ['bundle.meta.json', 'report.json', 'report.md', 'report.html', ...(runtime ? ['report.pdf'] : [])];
    const publication = existing ?? { schema_version: 1, report_id: reportId, generated_at: meta.generated_at,
      files: files.map(file => ({ path: directory + '/' + file, sha256: currentHash(vaultPath(directory + '/' + file)) })),
      pdf_pages: rendered?.pages ?? null, unsupported_codepoints: rendered?.unsupported_codepoints ?? [], mode: runtime ? 'pdf' : 'text_only' };
    ensure(publication.files.every(file => currentHash(vaultPath(file.path)) === file.sha256), 'Archived report bytes changed; preserve and review the damaged export.');
    ensure(verifyReportSources(report).current, 'Source changed before publication; retain incomplete artifacts and recollect.');
    immutable(publicationFile, publication);
    return { report_id: reportId, date: report.date, basis: report.basis, path: directory, pdf: runtime ? directory + '/report.pdf' : null,
      markdown: directory + '/report.md', json: directory + '/report.json', html: directory + '/report.html', pages: publication.pdf_pages,
      replay: Boolean(existing), source_status: 'current_at_publication', trigger: options.trigger ?? 'on_demand',
      status: runtime ? 'generated' : pdfError ? 'generated_without_pdf' : 'generated_text_only',
      // A later run in an environment that does have the renderer adds report.pdf to the same bundle.
      pdf_unavailable: pdfError };
  });
  return result;
}

export function verifyDailyReport(selector) {
  const meta = storedMetadata(selector); ensure(meta, 'No saved report matches this selector.');
  if (!metaAllowed(meta)) return { report_id: meta.report_id, date: meta.date, allowed: false, complete: false, current: false, reason: 'current_disclosure_blocks_report' };
  const publication = readJSON(meta.directory + '/publication.json');
  if (!publication) return { report_id: meta.report_id, date: meta.date, allowed: true, complete: false, current: false, reason: 'publication_incomplete' };
  const metadataBinding = publication.files.find(file => file.path === meta.meta_path);
  if (!metadataBinding || currentHash(vaultPath(meta.meta_path)) !== metadataBinding.sha256) return { report_id: meta.report_id, date: meta.date, allowed: true, complete: false, current: false, reason: 'metadata_binding_missing_or_changed' };
  const files = publication.files.map(file => ({ path: file.path, current: currentHash(vaultPath(file.path)) === file.sha256 }));
  const sources = verifyReportSources({ sources: meta.sources });
  return { report_id: meta.report_id, date: meta.date, basis: meta.basis, allowed: true, complete: files.every(file => file.current), current: sources.current,
    sources, files, pdf: publication.mode === 'pdf' ? meta.directory + '/report.pdf' : null, generated_at: meta.generated_at };
}
export function readDailyReport(selector, options = {}) {
  const status = verifyDailyReport(selector); ensure(status.allowed && status.complete, 'Report is withheld, incomplete or modified.');
  ensure(status.current || options.historical === true, 'Source changed; recollect or explicitly view this historical snapshot.');
  const meta = storedMetadata(selector); return { report: readJSON(meta.directory + '/report.json'), status };
}
