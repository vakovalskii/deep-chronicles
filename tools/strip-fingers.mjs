// Выброс пальцевых дорожек из библиотеки анимаций.
// node tools/strip-fingers.mjs public/assets/anims/AnimationLibrary_Godot_Standard.gltf
//
// Зачем: в скелете Quaternius 53 кости, из них 30 — пальцы (DEF-f_*, DEF-thumb.*, DEF-palm.*).
// Камера в игре смотрит сверху, пальцы не видны никогда, а дорожки для них занимают больше
// половины всех данных анимации и столько же работы на каждом кадре.
//
// Сами кости НЕ трогаем: они остаются в скелете, просто не анимируются и висят в позе покоя.
// Так меш не нужно перепривязывать, а значит нечему и сломаться.
import fs from 'node:fs';

const FINGER = /^DEF-(f_(index|middle|ring|pinky)|thumb|palm)/i;

export function stripFingers(gltf) {
  const nodes = gltf.nodes || [];
  const isFinger = (i) => FINGER.test(nodes[i]?.name || '');
  let dropped = 0, kept = 0;

  for (const anim of gltf.animations || []) {
    const keep = [];
    const used = new Map(); // старый индекс сэмплера → новый
    for (const ch of anim.channels) {
      if (ch.target?.node !== undefined && isFinger(ch.target.node)) { dropped++; continue; }
      if (!used.has(ch.sampler)) used.set(ch.sampler, used.size);
      keep.push({ ...ch, sampler: used.get(ch.sampler) });
      kept++;
    }
    // сэмплеры переиндексируем, чтобы не тащить осиротевшие
    const samplers = [...used.keys()].map((old) => anim.samplers[old]);
    anim.channels = keep;
    anim.samplers = samplers;
  }
  return { dropped, kept };
}

// Сборщик мусора для .bin: какие accessor'ы ещё нужны — пересобирать буфер тут не будем,
// это делает gltf-transform prune. Здесь только режем дорожки, файл .bin остаётся прежним.
if (process.argv[1].endsWith('strip-fingers.mjs')) {
  const file = process.argv[2];
  if (!file) throw new Error('укажи .gltf');
  const gltf = JSON.parse(fs.readFileSync(file, 'utf8'));
  const before = (gltf.animations || []).reduce((a, x) => a + x.channels.length, 0);
  const { dropped, kept } = stripFingers(gltf);
  const out = file.replace(/\.gltf$/, '.nofingers.gltf');
  fs.writeFileSync(out, JSON.stringify(gltf));
  const pct = before ? Math.round((dropped / before) * 100) : 0;
  console.log(`дорожек было ${before}, выброшено ${dropped} (${pct}%), осталось ${kept}`);
  console.log(`клипов: ${(gltf.animations || []).length}\n${out}`);
  console.log('дальше: gltf-transform prune — он уберёт из .bin осиротевшие данные');
}
