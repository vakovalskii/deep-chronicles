import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import WebSocket from 'ws';
import { godotBinary, root, run } from './runtime.mjs';

const args = process.argv.slice(2);
const binary = godotBinary();
const runtime = path.join(root, '.native-run');
fs.mkdirSync(runtime, { recursive: true });
const url = args.find(a => a.startsWith('--server='))?.slice(9) || 'ws://127.0.0.1:8790';
const ready = () => new Promise(resolve => {
  const socket = new WebSocket(url);
  const timer = setTimeout(() => { socket.terminate(); resolve(false); }, 1500);
  socket.on('error', () => { clearTimeout(timer); resolve(false); });
  socket.on('message', raw => {
    let message; try { message = JSON.parse(raw); } catch { return; }
    if (message.t !== 'hi') return;
    clearTimeout(timer); socket.close(); resolve(true);
  });
});
if (!args.includes('--skip-assets')) {
  await run(process.execPath, ['tools/godot/export.mjs']);
  await run(binary, ['--headless', '--path', 'godot', '--editor', '--import', '--quit']);
}
if (!(await ready())) {
  const parsed = new URL(url);
  if (!['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)) throw new Error(`Нет соединения с ${url}`);
  const log = fs.openSync(path.join(runtime, 'server.log'), 'a');
  const env = { ...process.env, PORT: parsed.port || '8790', DB: path.join(runtime, 'world.db') };
  delete env.DEV_CMD;
  const server = spawn(process.execPath, ['--no-warnings', 'server/server.js'], { cwd: root, detached: true, stdio: ['ignore', log, log], env });
  server.unref(); fs.closeSync(log);
  fs.writeFileSync(path.join(runtime, 'server.pid'), String(server.pid));
  let connected = false;
  for (let i = 0; i < 30; i++) { if (await ready()) { connected = true; break; } await new Promise(r => setTimeout(r, 200)); }
  if (!connected) throw new Error('Сервер не запустился: .native-run/server.log');
}
const extra = args.filter(a => !['--skip-assets', '--editor', '--built', '--foreground'].includes(a) && !a.startsWith('--server='));
const built = path.join(root, 'godot/builds/macos/Хроники Глубин.app/Contents/MacOS/Хроники Глубин');
const useBuilt = args.includes('--built') && fs.existsSync(built);
const options = useBuilt ? [] : ['--path', path.join(root, 'godot')];
if (args.includes('--editor')) options.push('--editor');
options.push('--', `--server=${url}`);
if (!args.includes('--editor')) options.push('--quick-start');
options.push(...extra);
if (args.includes('--foreground')) await run(useBuilt ? built : binary, options);
else {
  const log = fs.openSync(path.join(runtime, 'client.log'), 'w');
  const game = spawn(useBuilt ? built : binary, options, { cwd: root, detached: true, stdio: ['ignore', log, log] });
  game.unref(); fs.closeSync(log); fs.writeFileSync(path.join(runtime, 'client.pid'), String(game.pid));
  console.log(`Игра запущена (PID ${game.pid}). Сервер: ${url}\nСохранения: .native-run/world.db\nЛоги: .native-run/client.log`);
}
