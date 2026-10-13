// Install the optional pinned renderer in a caller-selected execution directory outside the vault.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from './lib.mjs';
const [directory, ...args] = process.argv.slice(2);
try {
  if (!directory) throw new Error('Usage: node tools/report-setup.mjs <external-runtime-directory> [--npm-cli PATH]');
  const target = path.resolve(directory), relative = path.relative(ROOT, target);
  if (relative === '' || !relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)) throw new Error('PDF dependencies stay outside the synced LifeOS vault.');
  fs.mkdirSync(target, { recursive: true });
  const actual = path.relative(fs.realpathSync(ROOT), fs.realpathSync(target));
  if (actual === '' || !actual.startsWith('..' + path.sep) && actual !== '..' && !path.isAbsolute(actual)) throw new Error('External runtime must not resolve into the vault.');
  for (const name of ['package.json', 'package-lock.json']) {
    const bytes = fs.readFileSync(path.join(ROOT, 'config/runtimes/pdf', name)), file = path.join(target, name);
    if (fs.existsSync(file) && !fs.readFileSync(file).equals(bytes)) throw new Error('Existing runtime package manifest differs; select a separate runtime directory.');
    if (!fs.existsSync(file)) fs.writeFileSync(file, bytes, { flag: 'wx' });
  }
  const index = args.indexOf('--npm-cli'), candidates = [index >= 0 ? args[index + 1] : null,
    path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'), '/usr/share/nodejs/npm/bin/npm-cli.js', '/usr/local/lib/node_modules/npm/bin/npm-cli.js'];
  const npm = candidates.find(file => file && fs.existsSync(file)); if (!npm) throw new Error('Node npm CLI not found; pass --npm-cli to an existing npm-cli.js.');
  const result = spawnSync(process.execPath, [npm, 'ci', '--prefix', target, '--ignore-scripts', '--no-audit', '--no-fund', '--cache', path.join(target, '.npm-cache')],
    { cwd: target, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error('PDF runtime installation failed: ' + result.stderr);
  console.log(JSON.stringify({ runtime: target, renderer: 'pdfkit', version: '0.20.2', font: 'Use an existing embeddable CJK font; configure --font/--font-family when needed.', global_install: false }, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
