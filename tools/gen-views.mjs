// Виды сзади и сбоку по готовому виду спереди — вход для многоракурсного текстурирования.
// TRELLIS красит меш по тому, что видел; с одной картинки он выдумывает бока и спину,
// и на швах между увиденным и выдуманным получается грязь. Дорисовываем недостающее.
//
// node tools/gen-views.mjs body_female          — сзади и с боков
// node tools/gen-views.mjs body_female --back   — только спина
//
// ГЛАВНОЕ ПРАВИЛО: свет и материалы во всех ракурсах одинаковые. Свет, который гуляет
// между видами, модель читает как рисунок на поверхности — это прямая причина пятен.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { drawImage, KEY } from './ai.mjs';

const SRC = 'tools/models-src';

// Общая часть промпта: то же тело, та же поза, тот же свет — меняется только камера.
const SAME = 'This is the SAME character as the reference image: identical body proportions, identical hair, '
  + 'identical clothing and identical colors. Keep the exact same T-pose with arms straight out to the sides. '
  + 'Keep the SAME neutral studio lighting as the reference — same brightness, same soft shadows, no new highlights, '
  + 'no rim light, no colored light. Full body from head to feet, centered, same scale and same framing as the reference. '
  + 'Plain flat pure white background, no ground plane, no cast shadow, no text, no frame. '
  + 'Anime style (cel-shaded, clean lineart, flat vivid colors), matching the reference exactly. ';

export const VIEWS = {
  back: 'Render this character seen strictly from BEHIND (camera at 180 degrees, looking at the back of the head and the back of the body). ',
  left: 'Render this character seen strictly from the LEFT SIDE (camera at 90 degrees, exact profile view). ',
  right: 'Render this character seen strictly from the RIGHT SIDE (camera at 270 degrees, exact profile view). ',
};

export async function makeView(id, view) {
  const front = path.join(SRC, id + '.png');
  if (!fs.existsSync(front)) throw new Error('нет вида спереди: ' + front);
  const { png, cost } = await drawImage(VIEWS[view] + SAME, { refs: [front] });
  const out = path.join(SRC, `${id}.${view}.png`);
  await sharp(png).resize(1024, 1024, { fit: 'contain', background: '#fff' }).png().toFile(out);
  return { out, cost };
}

// контактный лист: смотрим глазами до того, как тратить время видеокарты
function preview(id, views) {
  const cards = ['', ...views].map((v) => {
    const f = v ? `${id}.${v}.png` : `${id}.png`;
    return `<figure><img src="${f}"><figcaption>${v || 'спереди (исходник)'}</figcaption></figure>`;
  }).join('');
  const f = path.join(SRC, `_${id}_views.html`);
  fs.writeFileSync(f, `<!doctype html><meta charset="utf-8"><title>${id}: ракурсы</title>
<style>body{margin:0;padding:24px;background:#14161c;color:#dfe3ee;font:13px ui-sans-serif,system-ui}
h1{font-size:14px;text-transform:uppercase;letter-spacing:.04em;color:#8992a8}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px}
figure{margin:0;padding:10px;background:#1c1f28;border:1px solid #2c3040;border-radius:10px;text-align:center}
img{width:100%;background:#fff;border-radius:6px}
figcaption{margin-top:8px;font-size:12px;color:#8992a8}</style>
<h1>${id} · ракурсы для текстурирования</h1><div class="grid">${cards}</div>`);
  return f;
}

if (process.argv[1].endsWith('gen-views.mjs')) {
  if (!KEY) throw new Error('нет OPENROUTER_API_KEY в .env');
  const args = process.argv.slice(2);
  const id = args.find((a) => !a.startsWith('--'));
  if (!id) throw new Error('укажи модель: node tools/gen-views.mjs body_female');
  const want = args.filter((a) => a.startsWith('--')).map((a) => a.slice(2)).filter((v) => VIEWS[v]);
  const views = want.length ? want : Object.keys(VIEWS);

  let total = 0;
  const done = [];
  await Promise.all(views.map(async (v) => {
    for (let k = 0; k < 2; k++) {
      try { const r = await makeView(id, v); total += r.cost; done.push(v); console.log(`✓ ${v} → ${r.out}`); return; }
      catch (e) { if (k) console.log(`✗ ${v}: ${e.message}`); }
    }
  }));
  const f = preview(id, views.filter((v) => done.includes(v)));
  console.log(`готово ${done.length} из ${views.length}, $${total.toFixed(3)}\nпосмотреть: open ${f}`);
}
