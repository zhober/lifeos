// 部署/升级：把系统文件复制到目标库；个人数据只在不存在时用模板初始化，绝不覆盖。
// 目标库里被手动改过的系统文件（与上次部署的哈希不同）默认跳过，--force 才覆盖。
// 目标库里已被移除/改名的系统文件（在清单里、但不在当前系统集合里）按“孤立文件”处理：
// 未修改的删除，改过的保留并报告，--force 时先归档再删除。
// 用法: node tools/deploy.mjs <目标目录> [--apply] [--force]   （默认只预览）
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT } from './lib.mjs';
import { checkLayout } from './check-layout.mjs';

const args = process.argv.slice(2);
const target = args.find(a => !a.startsWith('--'));
if (!target) { console.error('用法: node tools/deploy.mjs <目标目录> [--apply] [--force]'); process.exit(1); }
const dst = path.resolve(target);
const apply = args.includes('--apply'), force = args.includes('--force');
if (dst === ROOT) { console.error('目标不能是源目录'); process.exit(1); }
const layout = checkLayout();
if (!layout.ok) { console.error('Source layout check failed:\n' + layout.errors.join('\n')); process.exit(1); }
const project = JSON.parse(fs.readFileSync(path.join(ROOT, 'project.json'), 'utf8'));
const rootEntries = fs.existsSync(dst) ? fs.readdirSync(dst) : [];
const legacyEntries = project.configuration.forbidden_root_entries.filter(name => rootEntries.some(entry => entry.toLowerCase() === name.toLowerCase()));
if (legacyEntries.length) {
  console.error('Target layout migration required: ' + legacyEntries.join(', ') + '. Review config/CONFIGURATION.md and preserve existing contents.');
  if (apply) process.exit(1);
}

// 系统文件：覆盖更新
const SYSTEM = [...Object.values(project.entrypoints), 'project.json', project.definitions.agents_directory,
  project.definitions.disabled_agents_directory, project.definitions.workflows_directory, 'config',
  'experts/_common.md', 'tools', 'templates', 'data/food/README.md'];
// Optional reference tables the user installs for personal use (data/food/README.md); they are not distributed.
// Copied only into a vault that has none, never overwritten, never recorded in the manifest and never removed,
// so an upgrade from a source without them leaves a vault's existing copies untouched.
const REFERENCE = ['data/food/cn-fct6.json', 'data/food/gi.json'];
// 迭代线：只分发使用库要读的记录和 evolver 的写作位置；调研报告、下载原文与草稿属于开发过程。
const EVOLVE = ['evolve/README.md', 'evolve/changelog.md', 'evolve/lineage.md', 'evolve/candidates.md'];
// 个人数据：仅在不存在时从模板创建（null = 写空数组）
const SEED = { 'profile/me.md': 'templates/me.md', 'profile/goals.md': 'templates/goals.md',
  'profile/preferences.json': 'templates/preferences.json',
  'memory/insights.md': 'templates/insights.md', 'data/food/custom.json': null };
// 领域记录、专家知识库：按模板目录镜像初始化
const SEED_DIRS = { 'templates/records': 'records', 'templates/experts': 'experts', 'templates/reports': 'reports' };
const DIRS = ['journal', 'reviews/weekly', 'reviews/monthly', 'advice', 'inbox', 'memory', 'memory/entries', 'profile', 'records', 'tasks', 'actions', 'history',
  'evolve/research', 'evolve/sources', 'evolve/drafts',
  'records/nutrition/meals', 'records/nutrition/days', 'records/nutrition/totals', 'inbox/meal-photos',
  'records/health/entries', 'records/cases', 'inbox/health', 'inbox/fitness',
  'records/fitness/sessions', 'records/fitness/plans', 'records/fitness/plan-events', 'records/fitness/recovery', 'records/fitness/assessments',
  'records/career/entries', 'inbox/career', 'records/shopping/entries', 'inbox/shopping', 'records/finance/entries', 'inbox/finance', 'inbox/travel', 'reports/daily'];
// 个人数据与用户自行维护的目录：永远不删除其中的任何东西。
const PERSONAL_ROOTS = ['journal', 'profile', 'records', 'inbox', 'advice', 'reviews', 'memory', 'tasks', 'actions', 'history', 'reports', 'experts', 'data', '.lifeos'];
const key = rel => rel.replaceAll('\\', '/');
const under = (relative, roots) => { const parts = key(relative).split('/'); return roots.includes(parts[0]); };

const MANIFEST = path.join(dst, '.lifeos-deploy.json');
const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {};
const unmanaged = !fs.existsSync(MANIFEST);
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const roleAliases = project.definitions.role_aliases ?? {};

const files = (rel) => {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return [];
  if (!fs.statSync(abs).isDirectory()) return [rel];
  return fs.readdirSync(abs).flatMap(f => files(path.join(rel, f)));
};

const systemFiles = new Set([...SYSTEM.flatMap(files), ...EVOLVE].map(key));
const plan = [];
for (const rel of systemFiles) {
  const src = path.join(ROOT, rel), out = path.join(dst, rel);
  if (!fs.existsSync(out)) { plan.push(['新增', rel, src]); continue; }
  const cur = hash(out), next = hash(src);
  if (cur === next) { manifest[rel] = next; continue; }
  if (manifest[rel] !== cur && !force) { plan.push(['跳过', rel, null, '目标库中已手动修改，--force 覆盖']); continue; }
  plan.push(['更新', rel, src]);
}
for (const rel of REFERENCE) {
  delete manifest[rel];   // recorded by deployments that still shipped the tables as system files
  if (fs.existsSync(path.join(ROOT, rel)) && !fs.existsSync(path.join(dst, rel))) plan.push(['初始化', rel, path.join(ROOT, rel)]);
}
for (const [rel, src] of Object.entries(SEED))
  if (!fs.existsSync(path.join(dst, rel))) plan.push(['初始化', rel, src ? path.join(ROOT, src) : null]);
for (const [from, to] of Object.entries(SEED_DIRS))
  for (const rel of files(from)) {
    if (to === 'experts' && Object.hasOwn(roleAliases, path.relative(from, rel).split(path.sep)[0])) continue;
    const out = key(path.join(to, path.relative(from, rel)));
    if (!fs.existsSync(path.join(dst, out))) plan.push(['初始化', out, path.join(ROOT, rel)]);
  }

// 目标路径必须先证明位于目标库内、且不穿越符号链接，再参与任何删除或归档。
const insideLibrary = relativePath => relativePath !== '..' && !relativePath.startsWith('..' + path.sep) && !path.isAbsolute(relativePath);
const libraryTarget = (relative, label) => {
  const out = path.resolve(dst, relative);
  if (!insideLibrary(path.relative(dst, out))) throw new Error(label + ' escapes the target vault: ' + relative);
  let ancestor = path.dirname(out);
  while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
  if (!insideLibrary(path.relative(fs.realpathSync(dst), fs.realpathSync(ancestor))))
    throw new Error(label + ' traverses outside the target vault: ' + relative);
  return out;
};
const archivePath = (relative, digest) => key(path.join(project.definitions.disabled_agents_directory, 'deployment-history', relative + '-' + digest));

// Orphaned managed files: recorded in the manifest, absent from the current system set.
// Only a byte-identical deployed copy is removed; anything else needs --force and is archived first.
// A missing manifest leaves nothing to compare against, so no removals are proposed.
// A role that is being deliberately retired below keeps its own archive rule, so it is not also an
// orphan here: retirement preserves the bytes under a name that names the role, which is what the
// agents-disabled convention expects.
const retirementKeys = new Set(Object.keys(roleAliases).map(alias => key(path.join(project.definitions.agents_directory, alias + '.md'))));
const orphans = [], orphanErrors = [], live = [];
for (const rel of Object.keys(manifest).sort()) {
  const file = path.join(dst, rel);
  if (!fs.existsSync(file)) { delete manifest[rel]; continue; }   // already gone; drop the stale entry
  if (systemFiles.has(rel) || under(rel, PERSONAL_ROOTS) || retirementKeys.has(rel)) continue;
  try {
    const out = libraryTarget(rel, 'Orphan removal path');
    if (!fs.lstatSync(out).isFile()) throw new Error('Orphaned managed entry must be a regular file: ' + rel);
    const digest = hash(out), unmodified = manifest[rel] === digest;
    if (!unmodified && !force) { live.push({ key: rel, reason: '目标库中已手动修改，保留并报告（--force 归档后删除）' }); continue; }
    const archive = force ? archivePath(rel, digest) : null, archiveFile = archive && libraryTarget(archive, 'Removal archive path');
    if (archiveFile && fs.existsSync(archiveFile) && (!fs.lstatSync(archiveFile).isFile() || hash(archiveFile) !== digest))
      throw new Error('Removal archive conflict: ' + archive);
    orphans.push({ key: rel, out, digest, archive, archiveFile });
  } catch (error) { orphanErrors.push(error.message); }
}
if (orphanErrors.length) {
  console.error('Target file removal required:\n' + orphanErrors.join('\n'));
  if (apply) process.exit(1);
}

// Retire only explicitly registered historical roles, preserving their exact bytes.
// Preflight conflicts before any deployment writes, including edited destination prompts/config.
const retirements = [], retirementErrors = [];
for (const [alias, canonical] of Object.entries(roleAliases)) {
  const rel = key(path.join(project.definitions.agents_directory, alias + '.md'));
  if (!fs.existsSync(path.join(dst, rel))) continue;
  try {
    const out = libraryTarget(rel, 'Retirement path');
    if (!fs.lstatSync(out).isFile()) throw new Error('Retired active role must be a regular file: ' + rel);
    const digest = hash(out);
    const original = path.join(ROOT, project.definitions.disabled_agents_directory, alias + '.md');
    const known = manifest[rel] === digest || (fs.existsSync(original) && hash(original) === digest);
    if (!known && !force) throw new Error('Retired role has local or unmanaged edits: ' + rel + '. Reconcile it or use --force to archive it unchanged.');
    const required = ['project.json', key(path.join(project.definitions.agents_directory, canonical + '.md'))];
    if (plan.some(([kind, item]) => kind === '跳过' && required.includes(item)))
      throw new Error('Retirement requires the canonical role and shared alias configuration to be updated: ' + alias + '. Reconcile local edits or select --force.');
    const archive = key(path.join(project.definitions.disabled_agents_directory, 'deployment-history', alias + '-' + digest + '.md'));
    const archiveFile = libraryTarget(archive, 'Retirement archive path');
    if (fs.existsSync(archiveFile) && (!fs.lstatSync(archiveFile).isFile() || hash(archiveFile) !== digest))
      throw new Error('Retirement archive conflict: ' + archive);
    retirements.push({ key: rel, out, digest, archive, archiveFile });
  } catch (error) { retirementErrors.push(error.message); }
}
if (retirementErrors.length) {
  console.error('Target role migration required:\n' + retirementErrors.join('\n'));
  if (apply) process.exit(1);
}

// Directories emptied by a removal are pruned, but never a personal, seeded or user-maintained one.
function pruneEmptyDirectories(relative) {
  for (let dir = path.dirname(relative); dir && dir !== '.' && dir !== path.sep; dir = path.dirname(dir)) {
    const name = key(dir);
    if (under(name, PERSONAL_ROOTS) || DIRS.includes(name)) break;
    const abs = path.join(dst, dir);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory() || fs.readdirSync(abs).length) break;
    try { fs.rmdirSync(abs); } catch { break; }
  }
}

for (const orphan of orphans) {
  console.log(`移除  ${orphan.key}${orphan.archive ? ` -> ${orphan.archive}` : ''}`);
  if (!apply) continue;
  libraryTarget(orphan.key, 'Orphan removal path');
  if (fs.existsSync(orphan.out) && hash(orphan.out) !== orphan.digest) throw new Error('Orphaned file changed since preflight: ' + orphan.key);
  if (orphan.archive) {
    libraryTarget(orphan.archive, 'Removal archive path');
    fs.mkdirSync(path.dirname(orphan.archiveFile), { recursive: true });
    if (fs.existsSync(orphan.archiveFile)) { if (hash(orphan.archiveFile) !== orphan.digest) throw new Error('Removal archive changed since preflight: ' + orphan.archive); fs.unlinkSync(orphan.out); }
    else fs.renameSync(orphan.out, orphan.archiveFile);
  } else fs.unlinkSync(orphan.out);
  delete manifest[orphan.key];
  pruneEmptyDirectories(orphan.key);
}
for (const item of live) console.log(`保留  ${item.key}  （${item.reason}）`);

for (const retirement of retirements) {
  console.log(`归档  ${retirement.key} -> ${retirement.archive}`);
  if (!apply) continue;
  libraryTarget(retirement.key, 'Retirement path'); libraryTarget(retirement.archive, 'Retirement archive path');
  if (hash(retirement.out) !== retirement.digest) throw new Error('Retired role changed since preflight: ' + retirement.key);
  fs.mkdirSync(path.dirname(retirement.archiveFile), { recursive: true });
  if (fs.existsSync(retirement.archiveFile)) {
    if (hash(retirement.archiveFile) !== retirement.digest) throw new Error('Retirement archive changed since preflight: ' + retirement.archive);
    fs.unlinkSync(retirement.out);
  } else fs.renameSync(retirement.out, retirement.archiveFile);
  delete manifest[retirement.key];
}

for (const [kind, rel, src, note] of plan) {
  console.log(`${kind}  ${rel}${note ? `  （${note}）` : ''}`);
  if (!apply || kind === '跳过') continue;
  const out = path.join(dst, rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  if (src) fs.copyFileSync(src, out); else fs.writeFileSync(out, '[]\n');
  if (kind === '新增' || kind === '更新') manifest[rel] = hash(out);
}
if (apply) {
  for (const d of DIRS) fs.mkdirSync(path.join(dst, d), { recursive: true });
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
}
if (!plan.length && !orphans.length && !live.length && !retirements.length) console.log('无变化');
if (!fs.existsSync(path.join(dst, REFERENCE[0])) && !plan.some(([, rel]) => rel === REFERENCE[0]))
  console.log('Note: no food composition table in the target; data/food/custom.json works without it (see data/food/README.md).');
console.log(apply ? `已部署到 ${dst}` : '（预览）确认无误后加 --apply 执行');
if (apply) {
  if (unmanaged) console.log('提示：目标库此前没有部署清单，本次只做了新增/初始化；从下次升级开始才会识别孤立系统文件。');
  const preferenceFile = path.join(dst, 'profile', 'preferences.json');
  const preference = fs.existsSync(preferenceFile) ? JSON.parse(fs.readFileSync(preferenceFile, 'utf8')) : {};
  if (preference.language_confirmed !== true)
    console.log('First interaction: use the setup workflow to confirm the interaction language before completing the profile (it is chosen on first use; English until chosen).');
}
