import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

export const sourcePaths = ['.github', '.nvmrc', 'package.json', 'package-lock.json', 'godot/project.godot', 'godot/export_presets.cfg', 'godot/scripts', 'godot/scenes', 'godot/resources', 'godot/shaders', 'godot/assets', 'godot/tests', 'tools/godot', 'tools/site', 'site', 'deploy', 'tests', 'src', 'server', 'public/assets'];
export const releaseSteps = ['pipeline', 'rules', 'server', 'client-server', 'weapons', 'economy', 'build-macos', 'build-windows', 'site-build', 'site-check'];
export const digest = (root, file) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
export function snapshotInputs(root) {
  const names = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ...sourcePaths], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  return Object.fromEntries([...new Set(names)].sort().filter(file => fs.existsSync(path.join(root, file))).map(file => [file, digest(root, file)]));
}
export function validateRelease(root, report) {
  if (!report.ok || releaseSteps.some(name => !report.steps?.some(s => s.name === name && s.ok))) throw Error('A complete passing native + download-site verification report is required');
  const current = snapshotInputs(root);
  if (JSON.stringify(Object.keys(current).sort()) !== JSON.stringify(Object.keys(report.inputs || {}).sort())) throw Error('Source file set changed after verification');
  for (const [file, expected] of Object.entries({ ...report.inputs, ...report.outputs })) {
    if (path.isAbsolute(file) || file.split(/[\\/]/).includes('..')) throw Error('Invalid report path');
    if (!fs.existsSync(path.join(root, file)) || digest(root, file) !== expected) throw Error(`Changed after verification: ${file}`);
  }
  for (const dir of ['server', 'src', 'dist']) for (const file of fs.readdirSync(path.join(root, dir), { recursive: true })) {
    const name = `${dir}/${file.split(path.sep).join('/')}`;
    if (dir === 'server' && name.startsWith('server/data/')) continue;
    if (fs.statSync(path.join(root, name)).isFile() && !(name in report.inputs) && !(name in report.outputs)) throw Error(`Untested release file: ${name}`);
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'dist/release.json'), 'utf8'));
  if (manifest.commit !== report.commit) throw Error('Download manifest and tested commit differ');
  for (const target of ['windows', 'macos']) {
    const entry = manifest.files?.[target];
    if (!entry || entry.url !== `/downloads/khroniki-glubin-${target}.zip`) throw Error(`Missing ${target} download`);
    const file = `dist${entry.url}`;
    if (!report.outputs[file] || digest(root, file) !== entry.sha256 || fs.statSync(path.join(root, file)).size !== entry.bytes) throw Error(`Download manifest mismatch: ${target}`);
  }
}
