// Базовое тело персонажа: с него начинается конвейер (тело → авториг → на него надевается шмот).
// node tools/gen-body.mjs [id]   → tools/models-src/<id>.png
// Одежда потом генерится на этом же теле и в этой же позе, иначе она не сядет.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const env = fs.existsSync('.env') ? Object.fromEntries(fs.readFileSync('.env', 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => l.split(/=(.*)/s).slice(0, 2))) : {};
const KEY = process.env.OPENROUTER_API_KEY || env.OPENROUTER_API_KEY;
const MODEL = process.env.IMG_MODEL || 'google/gemini-3.1-flash-image';
const OUT = 'tools/models-src';

// Поза одна на всё: строгая A-поза, руки от тела, ноги врозь — иначе авториг не разделит конечности,
// а одежда, нарисованная в другой позе, не ляжет на тело.
export const POSE = 'Full body, front view, standing straight in a strict A-pose: arms straight down and clearly away from the torso at 35 degrees, '
  + 'palms facing the thighs, legs apart shoulder width, feet flat, symmetric, calm neutral face, looking straight at the camera. ';
export const BASE = 'Single isolated 3D game character render, anime style (cel-shaded, clean lineart, expressive eyes, JRPG character art, original design), '
  + 'whole character fully visible and centered with margin, plain flat pure white background, no ground plane, no cast shadow, '
  + 'no text, no logo, no frame, no other objects, no props, soft even studio lighting. ';

// Тело — основа, на которую надевается всё остальное. Бельё простое и облегающее,
// чтобы под одеждой не выпирало и чтобы модель годилась для любого класса.
export const BODIES = {
  body_female: POSE + 'Young adult woman, slim athletic build, average proportions, shoulder-length silver-white hair, violet eyes, fair skin, '
    + 'wearing plain simple fitted white sleeveless top and plain white shorts (basic undergarments, fully covered, modest, no logos, no decoration), barefoot.',
  body_male: POSE + 'Young adult man, lean athletic build, average proportions, short brown hair, fair skin, '
    + 'wearing plain simple fitted white sleeveless top and plain white shorts (basic undergarments, fully covered, modest, no logos, no decoration), barefoot.',
};

async function generate(id, prompt) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', 'X-Title': 'Realms' },
    body: JSON.stringify({ model: MODEL, modalities: ['image', 'text'], image_config: { aspect_ratio: '1:1' }, messages: [{ role: 'user', content: BASE + prompt }] }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(j).slice(0, 200)}`);
  const url = j.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url) throw new Error('нет изображения');
  fs.mkdirSync(OUT, { recursive: true });
  await sharp(Buffer.from(url.split(',')[1], 'base64')).resize(1024, 1024, { fit: 'contain', background: '#fff' }).png().toFile(path.join(OUT, id + '.png'));
  return j.usage?.cost || 0;
}

if (process.argv[1].endsWith('gen-body.mjs')) {
  const ids = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const todo = ids.length ? ids : Object.keys(BODIES);
  let total = 0;
  for (const id of todo) { total += await generate(id, BODIES[id]); console.log(`✓ ${id}`); }
  console.log(`итого $${total.toFixed(3)}`);
}
