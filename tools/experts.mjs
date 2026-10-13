// Expert discovery: scan the manifest's neutral role directory.
//   node tools/experts.mjs          表格
//   node tools/experts.mjs --json   JSON（含「数据与记录」）
//   node tools/experts.mjs --all    含系统 agent（正文含 <!-- lifeos:kind=system -->，如 evolver），默认只列生活领域专家
//   node tools/experts.mjs --resolve <name> --json   Resolve a canonical or historical role name.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, parseDoc } from './lib.mjs';
import { readJSON, vaultPath } from './store.mjs';

const project = readJSON('project.json');
const aliases = project.definitions.role_aliases ?? {};
const dir = vaultPath(project.definitions.agents_directory);
const all = fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort().map(f => {
  const { data, body } = parseDoc(fs.readFileSync(path.join(dir, f), 'utf8'));
  const desc = String(data.description ?? '');
  const tools = String(data.tools ?? '').split(',').map(s => s.trim()).filter(Boolean);
  const sec = body.match(/## (?:Data and records|数据与记录)\r?\n([\s\S]*?)(?=\r?\n## |$)/);
  const records = sec ? [...sec[1].matchAll(/`(records\/[^`]+)`/g)].map(m => m[1]) : [];
  return {
    name: data.name ?? f.replace(/\.md$/, ''),
    aliases: Object.entries(aliases).filter(([, canonical]) => canonical === (data.name ?? f.replace(/\.md$/, ''))).map(([alias]) => alias),
    kind: /<!--\s*lifeos:kind=system\s*-->/.test(body) ? 'system' : 'expert',
    title: desc.split(/[。.]/)[0],
    when: desc,
    online: tools.some(t => /^Web/.test(t)),
    records,
    knowledge: fs.existsSync(path.join(ROOT, 'experts', data.name ?? '')) ? `experts/${data.name}/` : null,
  };
});
const experts = process.argv.includes('--all') ? all : all.filter(x => x.kind === 'expert');
const resolveIndex = process.argv.indexOf('--resolve');
if (resolveIndex !== -1) {
  const requested = process.argv[resolveIndex + 1];
  if (!requested || requested.startsWith('--')) { console.error('Usage: --resolve <role-name> [--json]'); process.exit(1); }
  const canonical = Object.hasOwn(aliases, requested) ? aliases[requested] : requested;
  const role = all.find(expert => expert.name === canonical);
  if (!role) { console.error('Unknown active role or alias: ' + requested); process.exit(1); }
  if (process.argv.includes('--json')) console.log(JSON.stringify({ ...role, requested_name: requested, canonical_name: canonical }, null, 2));
  else console.log(`${requested} -> ${canonical} (${role.kind})`);
  process.exit(0);
}

if (process.argv.includes('--json')) console.log(JSON.stringify(experts, null, 2));
else {
  console.log('| name | 专家 | 类型 | 联网 | 领域记录 | 何时调用 |\n|---|---|---|---|---|---|');
  for (const e of experts)
    console.log(`| ${e.name} | ${e.title} | ${e.kind === 'system' ? '系统' : '领域'} | ${e.online ? '是' : ''} | ${e.records.join('<br>')} | ${e.when} |`);
}
