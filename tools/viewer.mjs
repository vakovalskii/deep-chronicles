// Локальный сервер просмотрщика моделей: node tools/viewer.mjs [порт] → открывает tools/viewer.html в браузере.
// Отдаёт только то, что нужно просмотрщику: сам html, three из node_modules и GLB из tools/models-out.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';

const PORT = Number(process.argv[2]) || 5180;
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'tools/models-out');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary' };
const ALLOW = ['tools/viewer.html', 'tools/models-out/', 'node_modules/three/'];

const models = () => (fs.existsSync(OUT) ? fs.readdirSync(OUT).filter((f) => f.endsWith('.glb')).map((f) => f.slice(0, -4)).sort() : []);

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const rel = (url === '/' ? 'tools/viewer.html' : url.slice(1)).replace(/\.\.+/g, '');
  if (rel === 'tools/models.json') { // список моделей — собираем на лету, чтобы новые появлялись без перезапуска
    res.writeHead(200, { 'Content-Type': TYPES['.json'] });
    return res.end(JSON.stringify(models()));
  }
  const file = path.join(ROOT, rel);
  if (!ALLOW.some((a) => rel.startsWith(a)) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); return res.end('нет такого файла');
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => {
  const url = `http://localhost:${PORT}/`;
  console.log(`просмотрщик: ${url}  (моделей: ${models().length})`);
  spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], { stdio: 'ignore', detached: true }).unref();
});
