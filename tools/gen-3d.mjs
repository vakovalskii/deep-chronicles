// Клиент API генерации 3D (tools/trellis/api.py): tools/models-src/<id>.png → tools/models-out/<id>.glb
// node tools/gen-3d.mjs [id ...]      — без id: всё, чего ещё нет, в порядке приоритета
// Адрес: TRELLIS_URL (по умолчанию http://127.0.0.1:8765); TRELLIS_SSH=хост — сам поднимет туннель ssh -L.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { MODELS } from './gen-models.mjs';

const URL_ = process.env.TRELLIS_URL || 'http://127.0.0.1:8765';
const SRC = 'tools/models-src', OUT = 'tools/models-out';
const concept = id => fs.readFileSync(fs.existsSync(path.join(SRC, id + '.png')) ? path.join(SRC, id + '.png') : path.join('art/concepts', id + '.png'));
// сначала персонажи и стартовый город
const FIRST = ['warrior_cloth', 'mage_cloth', 'warrior_leather', 'warrior_chain', 'mage_apprentice', 'mage_mystic', 'warrior_bone', 'merchant', 'gatekeeper',
  'house_a', 'house_b', 'tower', 'temple', 'wall', 'fountain', 'portal'];
// параметры: мелочь — меньше треугольников и текстура поменьше
const PARAMS = (id) => (/^(sword|staff|shield|bush|rock)/.test(id) ? { dec: 8000, tex: 512 }
  : /^body_/.test(id) ? { dec: 15000, tex: 1024 } // тело под одеждой — лишние треугольники не нужны
  : { dec: 30000, tex: 1024 });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// сеть и туннель иногда рвутся — повторяем
async function api(p, o) {
  for (let k = 0; ; k++) {
    try { const r = await fetch(URL_ + p, o); if (!r.ok && r.status !== 409 && r.status !== 404) throw new Error(`${r.status} ${await r.text()}`); return r; }
    catch (e) { if (k >= 30) throw e; await sleep(5000); }
  }
}

let tunnel = null;
if (process.env.TRELLIS_SSH) {
  const parsed = spawnSync('python3', ['-c', 'import sys, shlex, json; print(json.dumps(shlex.split(sys.stdin.read())))'], { input: process.env.TRELLIS_SSH, encoding: 'utf8' });
  if (parsed.status !== 0) throw new Error('Cannot parse TRELLIS_SSH');
  const port = new globalThis.URL(URL_).port || '8765';
  tunnel = spawn('ssh', ['-N', '-o', 'BatchMode=yes', '-o', 'ExitOnForwardFailure=yes', '-o', 'ServerAliveInterval=30', '-L', `127.0.0.1:${port}:127.0.0.1:8765`, ...JSON.parse(parsed.stdout)], { stdio: 'ignore' });
  process.on('exit', () => tunnel.kill());
}
for (let i = 0; ; i++) {
  try { const h = await (await api('/health')).json(); console.log('API готов, очередь:', h.queue); break; }
  catch (e) { if (i > 60) throw new Error('API недоступно: ' + e.message); await sleep(5000); }
}

fs.mkdirSync(OUT, { recursive: true });
const args = process.argv.slice(2);
const all = [...FIRST, ...Object.keys(MODELS).filter((id) => !FIRST.includes(id))];
const ids = (args.length ? args : all).filter((id) => args.length || !fs.existsSync(path.join(OUT, id + '.glb')));
for (const id of ids) {
  const { dec, tex } = PARAMS(id);
  await api(`/jobs?id=${id}&dec=${dec}&tex=${tex}`, { method: 'POST', body: concept(id), headers: { 'Content-Type': 'image/png' } });
}
console.log(`в очереди: ${ids.length}`);
const left = new Set(ids);
while (left.size) {
  await sleep(10000);
  for (const id of [...left]) {
    const j = await (await api(`/jobs/${id}`)).json();
    if (j.error === 'нет такой задачи') { // сервис перезапускался — ставим заново
      const { dec, tex } = PARAMS(id);
      await api(`/jobs?id=${id}&dec=${dec}&tex=${tex}`, { method: 'POST', body: concept(id) });
      continue;
    }
    if (j.status === 'done') {
      fs.writeFileSync(path.join(OUT, id + '.glb'), Buffer.from(await (await api(`/jobs/${id}/glb`)).arrayBuffer()));
      console.log(`✓ ${id} (${j.secs} с), осталось ${left.size - 1}`); left.delete(id);
    } else if (j.status === 'error') { console.log(`✗ ${id}: ${j.error}`); left.delete(id); }
  }
}
console.log('ГОТОВО');
process.exit(0);
