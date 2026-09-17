// Шмот отдельными предметами: каждая вещь рисуется НА ТОМ ЖЕ теле и в той же позе, что tools/gen-body.mjs,
// иначе она не сядет на модель. Одежда потом привязывается к тому же скелету, что и тело.
// node tools/gen-gear.mjs                 — всё, чего ещё нет
// node tools/gen-gear.mjs robe_mystic     — только это
// node tools/gen-gear.mjs --set mystic    — комплект целиком
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { ITEMS } from '../src/data.js';
import { POSE, BASE } from './gen-body.mjs';

const env = fs.existsSync('.env') ? Object.fromEntries(fs.readFileSync('.env', 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => l.split(/=(.*)/s).slice(0, 2))) : {};
const KEY = process.env.OPENROUTER_API_KEY || env.OPENROUTER_API_KEY;
const MODEL = process.env.IMG_MODEL || 'google/gemini-3.1-flash-image';
const OUT = 'tools/models-src';

// Тело-носитель: одно и то же описание во всех промптах одежды — чтобы вещи были одного размера и посадки.
const WEARER = 'worn by a young adult woman with slim athletic build, average proportions, silver-white hair. ';
// Что должно быть видно: только сам предмет, остальное тело — как есть, без других вещей.
const ONLY = (what) => `Show ONLY this one item on the body: ${what}. The rest of the body stays in plain white basic undergarments, no other clothing, no other equipment, no weapon, no shield. `;

// Оружие и щиты — предметы сами по себе, они не надеваются, а висят в руке: рисуем отдельно от тела.
const PROP = 'Single isolated 3D game asset render, anime style (cel-shaded, clean lineart, vivid colors), whole object fully visible and centered, '
  + 'plain flat pure white background, no ground plane, no cast shadow, no text, no frame, no other objects, no character, soft even studio lighting. ';

const MATERIAL = {
  cloth: 'simple rough linen cloth, muted colors',
  leather: 'brown studded leather, worn edges',
  chain: 'steel chainmail with iron plates',
  bone: 'bleached bone plates bound with dark leather, grim',
  apprentice: 'teal blue mage fabric with light silver trim',
  mystic: 'deep purple mage fabric with ornate golden trim and faint glowing runes',
};
const kindOf = (id) => Object.keys(MATERIAL).find((k) => id.includes(k)) || 'cloth';

// описание вещи по слоту: что именно надето и что при этом видно
const WEAR = {
  head: (m) => ONLY(`a head piece — ${/apprentice|mystic/.test(m) ? 'a tall pointed wizard hat' : 'a helmet'} made of ${MATERIAL[m]}`),
  armor: (m) => ONLY(`a torso garment — ${/apprentice|mystic/.test(m) ? 'a long flowing mage robe reaching the ankles' : 'a chest armor piece over the torso'} made of ${MATERIAL[m]}`),
  legs: (m) => ONLY(`leg armor — greaves covering thighs and shins, made of ${MATERIAL[m]}`),
  gloves: (m) => ONLY(`hand wear — a pair of gloves on both hands, made of ${MATERIAL[m]}`),
  feet: (m) => ONLY(`footwear — a pair of boots on both feet, made of ${MATERIAL[m]}`),
};

// украшения мелкие: их на теле не разглядеть, поэтому рисуем как предмет
const PROP_ART = {
  weapon: (it, id) => (it.twoHand
    ? `A magic wizard staff: tall wooden shaft, ${it.grade === 'c' ? 'a large glowing blue crystal held by silver claws' : it.grade === 'd' ? 'a green gem' : 'a plain knotted top'}, standing vertical.`
    : `A ${it.grade === 'b' ? 'legendary fiery red-orange dragon' : it.grade === 'c' ? 'translucent icy blue crystal' : it.grade === 'd' ? 'polished steel long' : 'simple short iron'} sword, blade pointing up.`),
  shield: (it, id) => `A ${id.includes('iron') ? 'steel kite shield with a blue heraldic lion emblem' : 'round wooden shield with an iron rim and boss'}, front view.`,
  ear: () => 'A single small ornate earring with a gem.',
  neck: () => 'An ornate necklace with a central gem.',
  ring: () => 'A single ornate ring with a gem.',
};

export function gearPrompts() {
  const out = {};
  for (const [id, it] of Object.entries(ITEMS)) {
    if (it.use || it.rare || !it.slot) continue; // зелья, свитки и хлам не носятся
    if (PROP_ART[it.slot]) out[id] = { kind: 'prop', prompt: PROP + PROP_ART[it.slot](it, id) };
    else if (WEAR[it.slot]) out[id] = { kind: 'worn', prompt: BASE + POSE + WEAR[it.slot](kindOf(id)) + WEARER };
  }
  return out;
}

async function generate(id, prompt) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', 'X-Title': 'Realms' },
    body: JSON.stringify({ model: MODEL, modalities: ['image', 'text'], image_config: { aspect_ratio: '1:1' }, messages: [{ role: 'user', content: prompt }] }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(j).slice(0, 160)}`);
  const url = j.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url) throw new Error('нет изображения');
  await sharp(Buffer.from(url.split(',')[1], 'base64')).resize(1024, 1024, { fit: 'contain', background: '#fff' }).png().toFile(path.join(OUT, id + '.png'));
  return j.usage?.cost || 0;
}

if (process.argv[1].endsWith('gen-gear.mjs')) {
  if (!KEY) throw new Error('нет OPENROUTER_API_KEY в .env');
  fs.mkdirSync(OUT, { recursive: true });
  const all = gearPrompts();
  const args = process.argv.slice(2);
  const si = args.indexOf('--set');
  const ids = args.filter((a) => !a.startsWith('--') && a !== args[si + 1]);
  let todo = si >= 0 ? Object.keys(all).filter((id) => id.includes(args[si + 1])) : (ids.length ? ids : Object.keys(all));
  if (!ids.length) todo = todo.filter((id) => !fs.existsSync(path.join(OUT, id + '.png')));
  let total = 0;
  for (let i = 0; i < todo.length; i += 5) {
    await Promise.all(todo.slice(i, i + 5).map(async (id) => {
      for (let k = 0; k < 2; k++) {
        try { total += await generate(id, all[id].prompt); console.log(`✓ ${id} (${all[id].kind})`); return; }
        catch (e) { if (k) console.log(`✗ ${id}: ${e.message}`); }
      }
    }));
  }
  console.log(`готово ${todo.length}, $${total.toFixed(2)}`);
}
