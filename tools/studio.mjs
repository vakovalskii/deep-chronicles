// Студия ассетов: редактор привязки моделей и иконок. node tools/studio.mjs → откроется в браузере.
// Правки сохраняются в public/assets/rig.json — игра читает его и применяет к моделям.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';

const PORT = Number(process.argv[2]) || 5181;
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const MODELS = path.join(ROOT, 'public/assets/models');
const ICONS = path.join(ROOT, 'public/assets/icons');
const RIG = path.join(ROOT, 'public/assets/rig.json');
const CLIPS = path.join(ROOT, 'public/assets/clips.json');
const TYPES = { '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png' };
const ALLOW = ['tools/studio.html', 'public/assets/', 'src/', 'node_modules/three/'];

const ANIMS = path.join(ROOT, 'public/assets/anims');
const list = (dir, ext) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(ext)).map((f) => f.slice(0, -ext.length)).sort() : []);
const readJson = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {});
const readRig = () => readJson(RIG);

const body = (req) => new Promise((res) => { let s = ''; req.on('data', (d) => (s += d)); req.on('end', () => res(s)); });

http.createServer(async (req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const json = (code, data) => { res.writeHead(code, { 'Content-Type': TYPES['.json'] }); res.end(JSON.stringify(data)); };

  if (url === '/api/list') return json(200, { anims: list(ANIMS, '.gltf'), models: list(MODELS, '.glb'), icons: list(ICONS, '.png').filter((i) => !i.startsWith('_')), rig: readRig(), clips: readJson(CLIPS) });

  if (url === '/api/clips' && req.method === 'POST') { // клипы, нарисованные руками в студии
    const data = JSON.parse(await body(req));
    fs.writeFileSync(CLIPS, JSON.stringify(data) + '\n');
    const n = Object.values(data).reduce((a, m) => a + Object.keys(m).length, 0);
    console.log('клипы сохранены:', n);
    return json(200, { ok: true });
  }

  if (url === '/api/rig' && req.method === 'POST') { // сохранение привязки: пишем целиком, файл маленький
    const data = JSON.parse(await body(req));
    fs.writeFileSync(RIG, JSON.stringify(data, null, 2) + '\n');
    console.log('сохранено:', Object.keys(data).join(', '));
    return json(200, { ok: true });
  }

  if (url === '/api/icon' && req.method === 'POST') { // перерисовать иконку: дергаем конвейер
    const { id } = JSON.parse(await body(req));
    if (!/^\w+$/.test(id)) return json(400, { error: 'плохой id' });
    const p = spawn('node', ['tools/gen-icons.mjs', '--force', id], { cwd: ROOT });
    let out = '';
    p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (out += d));
    return p.on('close', (code) => json(code ? 500 : 200, { ok: !code, log: out.trim().slice(-400) }));
  }

  const rel = (url === '/' ? 'tools/studio.html' : url.slice(1)).replace(/\.\.+/g, '');
  const file = path.join(ROOT, rel);
  if (!ALLOW.some((a) => rel.startsWith(a)) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('нет файла'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => {
  const url = `http://localhost:${PORT}/`;
  console.log(`студия: ${url}  модели: ${list(MODELS, '.glb').length}, иконки: ${list(ICONS, '.png').length}`);
  spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], { stdio: 'ignore', detached: true }).unref();
});
