// Генерация бесшовных пиксельных тайлов через OpenRouter (модель изображений).
// node tools/gen-textures.mjs [имя ...]   — без имён: всё, чего ещё нет. --force — перегенерировать. --process — только пересобрать из raw.
// Ключ: OPENROUTER_API_KEY в .env (не коммитится). Сырые → public/assets/tex/raw, готовые 64×64 → public/assets/tex/<имя>.png
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const env = fs.existsSync('.env') ? Object.fromEntries(fs.readFileSync('.env', 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => l.split(/=(.*)/s).slice(0, 2))) : {};
const KEY = process.env.OPENROUTER_API_KEY || env.OPENROUTER_API_KEY;
const MODEL = process.env.IMG_MODEL || 'google/gemini-3.1-flash-image';
const RAW = 'public/assets/tex/raw', OUT = 'public/assets/tex';

const STYLE = 'Seamless tileable texture, retro 16-bit pixel art for a classic fantasy MMORPG, crisp chunky pixels, limited palette, flat even lighting, no shadows from outside, orthographic straight-on view filling the whole square, no border, no frame, no text, no watermark, edges wrap seamlessly. Subject: ';
// size — сторона готового тайла; color — оставить цвет как есть (материал белый), иначе «детальная» карта:
// яркость к 0.85 и приглушённая насыщенность (цвет даёт материал). sat/contrast/colors — тонкая настройка.
export const TILES = {
  // рельеф по зонам (цветные, смешиваются шейдером)
  t_grass: { size: 128, color: true, contrast: 0.55, sat: 0.72, gain: 0.95, p: 'bright green meadow grass seen from directly above, short grass blades and small clover, a few tiny yellow flowers, even coverage, top-down.' },
  t_forest: { size: 128, color: true, contrast: 0.6, gain: 1.6, p: 'dark forest floor seen from above: dark green moss, fallen pine needles, small twigs and a few dry leaves, top-down.' },
  t_sand: { size: 128, color: true, contrast: 0.6, p: 'dry cracked desert earth seen from above: pale ochre sand with a network of dried mud cracks and tiny pebbles, top-down.' },
  t_dirt: { size: 128, color: true, contrast: 0.55, p: 'trampled light brown dirt road ground seen from above, packed earth with small stones and faint footprints, top-down.' },
  t_rock: { size: 128, color: true, contrast: 0.7, p: 'grey mountain cliff rock face seen straight on, layered stone with cracks and ledges.' },
  t_snow: { size: 128, color: true, contrast: 0.5, p: 'fresh white snow surface seen from above with soft blue shadows and small sparkles, top-down.' },
  // мир
  brick: { size: 128, p: 'castle wall of large weathered grey stone blocks in staggered courses with mortar lines.' },
  cobble: { size: 128, color: true, contrast: 0.8, p: 'town square cobblestone pavement, rounded irregular warm grey and beige stones with dark gaps, top-down.' },
  roof_red: { size: 128, color: true, p: 'medieval red-orange clay roof tiles, overlapping scalloped shingles in horizontal rows.' },
  roof_blue: { size: 128, color: true, p: 'medieval dark blue slate roof tiles, overlapping rounded shingles in horizontal rows.' },
  roof: { size: 64, p: 'medieval clay roof tiles, overlapping scalloped shingles in rows.' },
  house: { size: 128, p: 'medieval half-timbered house wall: white plaster with dark wooden beams (vertical, horizontal and diagonal braces) and one small leaded glass window.' },
  wood: { size: 64, p: 'vertical wooden planks with grain, knots and nails.' },
  bark: { size: 128, p: 'tree bark with deep vertical grooves.' },
  leaves: { size: 128, contrast: 0.8, p: 'dense tree foliage canopy, many overlapping leaves in clusters.' },
  stone: { size: 128, p: 'rough natural boulder rock surface with cracks and lichen spots.' },
  sandstone: { size: 128, color: true, p: 'weathered orange-tan desert sandstone rock with horizontal strata layers and erosion pits.' },
  dbrick: { size: 128, color: true, contrast: 0.9, p: 'ancient dark dungeon wall of damp black-grey stone bricks with green moss in the mortar and a few cracks, gloomy.' },
  dfloor: { size: 128, color: true, contrast: 0.9, p: 'ancient dungeon floor of large worn dark grey square stone slabs with cracks and dirt in the seams, top-down.' },
  water: { size: 128, color: true, contrast: 0.7, p: 'clear blue-green lake water surface seen from above with gentle ripples and small white light glints, top-down.' },
  // одежда и мобы
  chain: { size: 64, p: 'chainmail armor, interlocking small metal rings in regular rows.' },
  plate: { size: 64, p: 'polished steel plate armor segments with rivets and edge bevels.' },
  leather: { size: 64, p: 'plain brown leather armor surface, smooth hide with subtle grain, a straight stitched seam and two small rivets, no ornament.' },
  cloth: { size: 64, contrast: 0.7, p: 'coarse beige burlap canvas, visible woven threads in a grid.' },
  robe: { size: 64, sat: 0.2, contrast: 0.35, p: 'plain deep violet velvet fabric with soft vertical folds, uniform, no ornament.' },
  fur: { size: 64, p: 'animal fur pelt, short dense strands.' },
  bone: { size: 64, p: 'old bleached bone surface with cracks and pores.' },
};
const ONLY_X = new Set();

async function generate(name) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', 'X-Title': 'Realms textures' },
    body: JSON.stringify({ model: MODEL, modalities: ['image', 'text'], image_config: { aspect_ratio: '1:1' }, messages: [{ role: 'user', content: STYLE + TILES[name].p }] }),
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
  // 256 → size со сглаживанием, затем яркость/насыщенность/контраст
  const T = TILES[name], SIZE = T.size;
  const { data: s } = await sharp(out, { raw: { width: W, height: W, channels: 3 } }).resize(SIZE, SIZE, { kernel: 'mitchell' }).raw().toBuffer({ resolveWithObject: true });
  let mean = 0;
  for (let i = 0; i < s.length; i += 3) mean += 0.299 * s[i] + 0.587 * s[i + 1] + 0.114 * s[i + 2];
  mean /= s.length / 3;
  const k = T.color ? T.gain ?? 1 : (0.85 * 255) / Math.max(1, mean), sat = T.sat ?? (T.color ? 1 : 0.35), con = T.contrast ?? 1;
  for (let i = 0; i < s.length; i += 3) {
    const l = 0.299 * s[i] + 0.587 * s[i + 1] + 0.114 * s[i + 2], l2 = mean + (l - mean) * con;
    for (let c = 0; c < 3; c++) s[i + c] = Math.max(0, Math.min(255, (l2 + (s[i + c] - l) * sat) * k));
  }
  await sharp(s, { raw: { width: SIZE, height: SIZE, channels: 3 } }).png({ palette: true, colors: T.colors ?? (SIZE > 64 ? 32 : 24), dither: 0 }).toFile(path.join(OUT, name + '.png'));
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
