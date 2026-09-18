import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { godotBinary, root, run } from './runtime.mjs';

const binary = godotBinary();
await run(process.execPath, ['tools/godot/export.mjs']);
await run(binary, ['--headless', '--path', 'godot', '--editor', '--import', '--quit']);
const probe = net.createServer();
await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chronicles-native-'));
const server = spawn(process.execPath, ['--no-warnings', 'server/server.js'], { cwd: root, env: { ...process.env, PORT: String(port), DB: path.join(dir, 'test.db'), DEV_CMD: '1', AUTH_TRIES: '1000' }, stdio: ['ignore', 'pipe', 'pipe'] });
let godot;
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Test server startup timeout')), 10000);
    server.once('error', reject); server.once('exit', () => reject(new Error('Test server exited')));
    server.stdout.once('data', () => { clearTimeout(timer); resolve(); });
    server.stderr.on('data', chunk => process.stderr.write(chunk));
  });
  const flags = process.argv.includes('--headless') ? ['--headless'] : [];
  const artifacts = path.join(root, '.native-run', process.argv.includes('--touch') ? 'test-touch-artifacts' : 'test-artifacts');
  fs.mkdirSync(artifacts, { recursive: true });
  godot = spawn(binary, [...flags, '--path', 'godot', '--max-fps', '60', '--script', 'res://tests/smoke.gd', '--', '--test-mode', `--server=ws://127.0.0.1:${port}`, `--artifacts=${artifacts}`, ...(process.argv.includes('--touch') ? ['--touch'] : [])], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  for (const stream of [godot.stdout, godot.stderr]) stream.on('data', b => { output += b; process.stdout.write(b); });
  const code = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { godot.kill(); reject(new Error('Native smoke test timeout')); }, 90000);
    godot.on('error', reject); godot.on('exit', code => { clearTimeout(timer); resolve(code); });
  });
  fs.mkdirSync(path.join(root, '.native-run'), { recursive: true });
  fs.writeFileSync(path.join(root, '.native-run', 'test.log'), output);
  if (code !== 0 || !output.includes('failures=0') || /ERROR:|FAIL:/.test(output)) throw new Error('Native smoke test failed');
} finally {
  godot?.kill(); server.kill();
  await new Promise(resolve => server.exitCode !== null ? resolve() : server.once('exit', resolve));
  fs.rmSync(dir, { recursive: true, force: true });
}
