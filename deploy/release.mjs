// Validate the exact tested input/output hashes, then stage and promote atomically per component.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { root } from '../tools/godot/runtime.mjs';
const host = process.env.DEPLOY_HOST;
if (!host || host.startsWith('-') || /[\s\x00-\x1f]/.test(host)) throw Error('Set DEPLOY_HOST in .env or the environment');
const safe = value => String(value).replaceAll(host, '[deployment host]').replaceAll(host.split('@').at(-1), '[deployment host]');
async function run(command, args) {
  const child = spawn(command, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  for (const stream of [child.stdout, child.stderr]) stream.on('data', data => process.stdout.write(safe(data)));
  const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', resolve); });
  if (code !== 0) throw Error(`Release step failed: ${command} (${code})`);
}
if (!process.argv.includes('--verified')) await run(process.execPath, ['tools/godot/verify.mjs', '--headless', '--offline', '--web']);
const report = JSON.parse(fs.readFileSync(path.join(root, '.native-run/verification/report.json'), 'utf8'));
if (!report.ok || ['rules', 'server', 'client-server', 'weapons', 'web-build', 'web-browser'].some(name => !report.steps.some(s => s.name === name && s.ok))) throw Error('A complete passing native + web verification report is required');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
for (const [file, expected] of Object.entries({ ...report.inputs, ...report.outputs })) if (!fs.existsSync(path.join(root, file)) || hash(file) !== expected) throw Error(`Changed after verification: ${file}`);
// Check for new source files as well, so an untested addition cannot enter the release.
for (const dir of ['server', 'src', 'dist']) for (const file of fs.readdirSync(path.join(root, dir), { recursive: true })) {
  const name = `${dir}/${file}`;
  if (dir === 'server' && file.startsWith('data/')) continue;
  if (fs.statSync(path.join(root, name)).isFile() && !(name in report.inputs) && !(name in report.outputs)) throw Error(`Untested release file: ${name}`);
}
const id = `${report.commit.slice(0, 12)}-${new Date().toISOString().replace(/[-:.]/g, '')}`;
const remote = `/opt/realms/releases/${id}`;
await run('ssh', ['-o', 'BatchMode=yes', host, `mkdir -p '${remote}'`]);
for (const dir of ['server', 'src', 'dist']) await run('rsync', ['-az', '--exclude', 'data', `${dir}/`, `${host}:${remote}/${dir}/`]);
await run('rsync', ['-az', 'package.json', 'package-lock.json', 'deploy/promote.sh', `${host}:${remote}/`]);
await run('ssh', ['-o', 'BatchMode=yes', host, `bash '${remote}/promote.sh' '${remote}'`]);
await run(process.execPath, ['tools/godot/probe.mjs', '--require-loot']);
fs.writeFileSync(path.join(root, '.native-run/deployment.json'), JSON.stringify({ id, commit: report.commit, verified: report.finished, promoted: new Date().toISOString(), groundLoot: 1 }, null, 2) + '\n');
console.log(`Deployment verified: ${id}`);
