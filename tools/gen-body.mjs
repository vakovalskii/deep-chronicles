// Базовое тело персонажа: с него начинается конвейер (тело → авториг → на него надевается шмот).
// node tools/gen-body.mjs [id]   → tools/models-src/<id>.png
// Одежда потом генерится на этом же теле и в этой же позе, иначе она не сядет.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { drawImage, KEY } from './ai.mjs';

const OUT = 'tools/models-src';

// Поза одна на всё — строгая T-поза: ровно в ней стоит канонический скелет из библиотеки анимаций
// (Quaternius, CC0), и только при совпадении поз Blender может посчитать веса.
// Одежда генерится в этой же позе, иначе она не сядет на тело.
export const POSE = 'Full body, front view, standing in a strict T-pose: both arms stretched out horizontally to the sides at exactly shoulder height, '
  + 'straight elbows, palms facing down, fingers together, legs straight and parallel shoulder width apart, feet flat and pointing forward, '
  + 'symmetric, calm neutral face, looking straight at the camera. ';
export const BASE = 'Single isolated 3D game character render, anime style (cel-shaded, clean lineart, expressive eyes, JRPG character art, original design), '
  + 'whole character fully visible and centered with margin, plain flat pure white background, no ground plane, no cast shadow, '
  + 'no text, no logo, no frame, no other objects, no props, soft even studio lighting. ';

// Тело — основа, на которую надевается всё остальное. Одежда простая и облегающая
// (спортивная майка и шорты): под доспехом не выпирает, годится для любого класса.
// Формулировки про бельё модель отклоняет фильтром безопасности — поэтому именно спортивная форма.
export const BODIES = {
  body_female: POSE + 'Young adult woman, slim athletic build, average proportions, shoulder-length silver-white hair, violet eyes, fair skin, '
    + 'wearing a plain white fitted sleeveless athletic top and plain white athletic shorts, fully covered, no logos, no decoration, barefoot.',
  body_male: POSE + 'Young adult man, lean athletic build, average proportions, short brown hair, fair skin, '
    + 'wearing a plain white fitted sleeveless athletic top and plain white athletic shorts, fully covered, no logos, no decoration, barefoot.',
};

async function generate(id, prompt) {
  const { png, cost } = await drawImage(prompt);
  fs.mkdirSync(OUT, { recursive: true });
  await sharp(png).resize(1024, 1024, { fit: 'contain', background: '#fff' }).png().toFile(path.join(OUT, id + '.png'));
  return cost;
}

if (process.argv[1].endsWith('gen-body.mjs')) {
  const ids = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const todo = ids.length ? ids : Object.keys(BODIES);
  let total = 0;
  for (const id of todo) { total += await generate(id, BASE + BODIES[id]); console.log(`✓ ${id}`); }
  console.log(`итого $${total.toFixed(3)}`);
}
