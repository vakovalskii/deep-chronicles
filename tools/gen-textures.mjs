// Генерация бесшовных пиксельных тайлов через OpenRouter (модель изображений).
// node tools/gen-textures.mjs [имя ...]   — без имён: всё, чего ещё нет. --force — перегенерировать. --process — только пересобрать из raw.
// Ключ: OPENROUTER_API_KEY в .env (не коммитится). Сырые → public/assets/tex/raw, готовые 64×64 → public/assets/tex/<имя>.png
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const env = fs.existsSync('.env') ? Object.fromEntries(fs.readFileSync('.env', 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => l.split(/=(.*)/s).slice(0, 2))) : {};
const KEY = process.env.OPENROUTER_API_KEY || env.OPENROUTER_API_KEY;
const MODEL = process.env.IMG_MODEL || 'google/gemini-3.1-flash-image';
const RAW = 'public/assets/tex/raw', OUT = 'public/assets/tex', SIZE = 64;

const STYLE = 'Seamless tileable texture, retro 16-bit pixel art for a classic fantasy MMORPG, crisp chunky pixels, limited palette, flat even lighting, no shadows from outside, orthographic straight-on view filling the whole square, no border, no frame, no text, no watermark, edges wrap seamlessly. Subject: ';
export const TILES = {
  ground: 'lush meadow ground: short grass tufts mixed with patches of soil and tiny pebbles, top-down.',
  brick: 'castle wall of large weathered grey stone blocks in staggered courses with mortar lines.',
  cobble: 'town square cobblestone pavement, rounded irregular stones with dark gaps, top-down.',
  roof: 'medieval clay roof tiles, overlapping scalloped shingles in rows.',
  house: 'medieval half-timbered house wall: white plaster with dark wooden beams (vertical, horizontal and diagonal braces) and one small leaded glass window.',
  wood: 'vertical wooden planks with grain, knots and nails.',
  bark: 'tree bark with deep vertical grooves.',
  leaves: 'dense tree foliage canopy, many overlapping leaves in clusters.',
  stone: 'rough natural boulder rock surface with cracks and lichen spots.',
  water: 'calm lake water surface with small ripples and light sparkles, top-down.',
  chain: 'chainmail armor, interlocking small metal rings in regular rows.',
  plate: 'polished steel plate armor segments with rivets and edge bevels.',
  leather: 'dark brown tooled leather surface with a stitched seam and a few brass rivets.',
  cloth: 'simple beige tunic cloth, woven fabric pattern.',
  robe: 'deep violet velvet mage robe fabric, soft folds, with one horizontal band of ornate golden embroidery along the very bottom edge.',
  fur: 'animal fur pelt, short dense strands.',
  bone: 'old bleached bone surface with cracks and pores.',
};
// сохранить насыщенность выше у тех, где цвет важен в самой текстуре
const SAT = { robe: 0.3, ground: 0.15 };
// кайма мантии внизу — по вертикали не смешиваем, иначе она уедет
const ONLY_X = new Set(['robe']);
// контраст (1 — как есть): земля тайлится на километры, пятна не должны бросаться в глаза
const CONTRAST = { ground: 0.45, leaves: 0.8 };

async function generate(name) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', 'X-Title': 'Realms textures' },
    body: JSON.stringify({ model: MODEL, modalities: ['image', 'text'], image_config: { aspect_ratio: '1:1' }, messages: [{ role: 'user', content: STYLE + TILES[name] }] }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(j).slice(0, 300)}`);
  const url = j.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url) throw new Error('нет изображения: ' + JSON.stringify(j).slice(0, 200));
  fs.writeFileSync(path.join(RAW, name + '.png'), Buffer.from(url.split(',')[1], 'base64'));
  return j.usage?.cost || 0;
}

// бесшовность: смесь с копией, сдвинутой на половину (швы копии — в центре, где вес оригинала 1)
async function processTile(name) {
  const W = 256;
  const { data } = await sharp(path.join(RAW, name + '.png')).resize(W, W, { fit: 'cover' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(W * W * 3);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const wx = Math.sin((Math.PI * (x + 0.5)) / W) ** 2, wy = Math.sin((Math.PI * (y + 0.5)) / W) ** 2;
    const ox = ONLY_X.has(name);
    const w = Math.min(1, (ox ? wx : Math.min(wx, wy)) * 2.2);
    const i = (y * W + x) * 3, j = ((ox ? y : (y + W / 2) % W) * W + ((x + W / 2) % W)) * 3;
    for (let c = 0; c < 3; c++) out[i + c] = data[i + c] * w + data[j + c] * (1 - w);
  }
  // 256 → 64 со сглаживанием, затем нормализация: средняя яркость ~0.85, приглушённая насыщенность
  const { data: s } = await sharp(out, { raw: { width: W, height: W, channels: 3 } }).resize(SIZE, SIZE, { kernel: 'mitchell' }).raw().toBuffer({ resolveWithObject: true });
  let mean = 0;
  for (let i = 0; i < s.length; i += 3) mean += 0.299 * s[i] + 0.587 * s[i + 1] + 0.114 * s[i + 2];
  mean /= s.length / 3;
  const k = (0.85 * 255) / Math.max(1, mean), sat = SAT[name] ?? 0.35;
  for (let i = 0; i < s.length; i += 3) {
    const l = 0.299 * s[i] + 0.587 * s[i + 1] + 0.114 * s[i + 2], l2 = mean + (l - mean) * (CONTRAST[name] ?? 1);
    for (let c = 0; c < 3; c++) s[i + c] = Math.max(0, Math.min(255, (l2 + (s[i + c] - l) * sat) * k));
  }
  await sharp(s, { raw: { width: SIZE, height: SIZE, channels: 3 } }).png({ palette: true, colors: 24, dither: 0 }).toFile(path.join(OUT, name + '.png'));
}

const args = process.argv.slice(2);
const force = args.includes('--force'), only = args.includes('--process');
const names = args.filter((a) => !a.startsWith('--'));
const list = names.length ? names : Object.keys(TILES);
let cost = 0;
await Promise.all(list.map(async (n) => {
  if (!TILES[n]) return console.log('нет такого:', n);
  try {
    const have = fs.existsSync(path.join(RAW, n + '.png'));
    if (!only && (force || !have)) { cost += await generate(n); }
    await processTile(n);
    console.log('готово', n);
  } catch (e) { console.log('ошибка', n, e.message); }
}));
console.log(`стоимость: $${cost.toFixed(3)}`);
console.log('файлы:', JSON.stringify(fs.readdirSync(OUT).filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -4)).sort()));
