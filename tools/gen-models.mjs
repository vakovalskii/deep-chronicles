// Концепты 3D-моделей для TRELLIS.2 (картинка → GLB на GPU-сервере).
// node tools/gen-models.mjs [id ...] → tools/models-src/<id>.png (1024², белый фон). Нужен OPENROUTER_API_KEY в .env.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const env = fs.existsSync('.env') ? Object.fromEntries(fs.readFileSync('.env', 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => l.split(/=(.*)/s).slice(0, 2))) : {};
const KEY = process.env.OPENROUTER_API_KEY || env.OPENROUTER_API_KEY;
const MODEL = process.env.IMG_MODEL || 'google/gemini-3.1-flash-image';
const OUT = 'tools/models-src';

const BASE = 'Single isolated 3D game asset render, stylized fantasy MMORPG art style (hand-painted textures, early-2000s Korean MMO vibe, original design), '
  + 'whole object fully visible and centered with margin, plain flat pure white background, no ground plane, no cast shadow, no text, no logo, no frame, no other objects, soft even studio lighting. ';
const VIEW = 'Three-quarter view from slightly above. ';
// гуманоиды: A-поза — модель потом режется на части для анимации
const POSE = 'Full body, front view, standing straight in a relaxed A-pose: arms held down and clearly away from the torso at 30 degrees, legs apart, empty hands, symmetric, neutral face. ';
const CREATURE = 'Full body side three-quarter view, standing on all legs, neutral pose, symmetric. ';

export const MODELS = {
  // город
  house_a: VIEW + 'Medieval two-storey half-timbered town house, white plaster, dark wooden beams, red clay tile roof, small windows with shutters, wooden door.',
  house_b: VIEW + 'Small medieval stone cottage, grey fieldstone walls, blue slate roof, chimney, wooden door, flower box.',
  tower: VIEW + 'Round medieval castle wall tower, grey stone blocks, crenellations under a tall conical dark red roof, arrow slits.',
  temple: VIEW + 'Small fantasy temple of light, white marble walls, columns at the entrance, golden domed roof, stained glass windows.',
  crypt: VIEW + 'Dark gothic stone mausoleum crypt, weathered black stone, iron door, skull ornaments, faint purple glow in the doorway.',
  wall: VIEW + 'Straight medieval castle wall segment, grey stone blocks, crenellated top walkway, moss at the base, wide and low, symmetric.',
  fountain: VIEW + 'Round town square stone fountain, two tiers, clear blue water, carved stone basin.',
  portal: VIEW + 'Flat round magic teleport platform, carved stone disc with glowing violet runes and four small crystal pillars around it.',
  // природа
  oak: VIEW + 'Stylized broadleaf oak tree, thick brown trunk, big round lush green canopy.',
  pine: VIEW + 'Stylized tall dark green pine tree, layered conical branches, brown trunk.',
  bush: VIEW + 'Small round green leafy bush with a few tiny white flowers.',
  rock_a: VIEW + 'Mossy grey boulder, rounded, cracks, patches of green moss.',
  rock_b: VIEW + 'Desert sandstone rock formation, orange layered sandstone, eroded.',
  dead_tree: VIEW + 'Dead leafless twisted tree, grey-brown bark, gnarled branches, wasteland.',
  // мобы
  rabbit: CREATURE + 'Cute fluffy field rabbit, light beige fur, long ears.',
  wolf: CREATURE + 'Grey wild wolf, fierce, thick fur, glowing red eyes.',
  boar: CREATURE + 'Wild boar, dark brown bristly fur, big white tusks.',
  spider: CREATURE + 'Giant cave spider, dark purple-black body, eight long hairy legs, red eyes.',
  scorpion: CREATURE + 'Giant desert scorpion, sandy orange armored carapace, big pincers, raised tail stinger.',
  treant: POSE + 'Walking tree creature treant, bark body, branch arms, leafy green crown on its head, glowing yellow eyes.',
  golem: POSE + 'Massive stone golem, bulky boulder body, huge fists, glowing orange runes.',
  goblin: POSE + 'Small green goblin scout, pointy ears, leather rags, sneaky grin.',
  orc: POSE + 'Muscular green orc warrior, leather and iron armor pieces, tusks, fierce.',
  skeleton: POSE + 'Undead skeleton guard, bleached bones, rusty helmet, tattered cloth.',
  ghoul: POSE + 'Pale green ghoul, hunched, torn clothes, long claws.',
  wraith: 'Full body front view. Floating ghost wraith, translucent cyan-green hooded robe, no legs, glowing eyes, wispy tail.',
  lich: POSE + 'Lich king, skeletal sorcerer in ornate purple and gold robes, tall crown, glowing violet eyes.',
  // NPC
  merchant: POSE + 'Friendly medieval merchant, plump, orange and brown clothes, apron, leather pouch, beard.',
  gatekeeper: POSE + 'Mysterious gatekeeper mage, long violet robe with silver runes, hood down, grey beard.',
  // герой: класс × вид брони
  warrior_cloth: POSE + 'Young human male warrior, simple red linen tunic, brown trousers, leather boots, short brown hair.',
  warrior_leather: POSE + 'Human male warrior in brown leather armor set: leather cap, studded leather jerkin, leather gloves, leather greaves, boots.',
  warrior_chain: POSE + 'Human male warrior in steel chainmail armor set: chain coif helmet, chainmail hauberk, plate gloves, chain leggings, steel boots.',
  warrior_bone: POSE + 'Human male warrior in ivory bone armor set: horned bone helmet, bone plate cuirass, bone gauntlets, bone greaves, dark trims.',
  mage_cloth: POSE + 'Young human female mage, simple blue linen robe with a rope belt, short brown hair.',
  mage_apprentice: POSE + 'Human female mage in a teal apprentice robe with a hood, teal gloves and shoes, light trims.',
  mage_mystic: POSE + 'Human female mage in an ornate deep purple mystic robe with golden trim, tall pointed wizard hat, purple gloves.',
  // оружие и щиты (лежат по диагонали)
  sword_novice: VIEW + 'Simple short iron sword, plain wooden grip, worn blade, pointing up.',
  sword_long: VIEW + 'Steel longsword, polished blade, leather grip, silver cross guard, pointing up.',
  sword_crystal: VIEW + 'Fantasy crystal sword, translucent icy blue blade, silver hilt, pointing up.',
  sword_dragon: VIEW + 'Legendary dragon sword, fiery red-orange blade with dragon scale pattern, gold dragon-head guard, pointing up.',
  staff_novice: VIEW + 'Simple wooden walking staff, knotted wood, vertical.',
  staff_oak: VIEW + 'Druid oak staff, twisted oak wood with a green gem at the top, vertical.',
  staff_crystal: VIEW + 'Mage staff with a large floating blue crystal held by silver claws at the top, dark wood, vertical.',
  shield_wood: VIEW + 'Round wooden shield with iron rim and iron boss, front view.',
  shield_iron: VIEW + 'Iron kite shield with a blue heraldic lion emblem, steel rim, front view.',
};

async function generate(id) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', 'X-Title': 'Realms' },
    body: JSON.stringify({ model: MODEL, modalities: ['image', 'text'], image_config: { aspect_ratio: '1:1' }, messages: [{ role: 'user', content: BASE + MODELS[id] }] }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(j).slice(0, 200)}`);
  const url = j.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url) throw new Error('нет изображения');
  await sharp(Buffer.from(url.split(',')[1], 'base64')).resize(1024, 1024, { fit: 'contain', background: '#fff' }).png().toFile(path.join(OUT, id + '.png'));
  return j.usage?.cost || 0;
}

if (process.argv[1].endsWith('gen-models.mjs')) {
  fs.mkdirSync(OUT, { recursive: true });
  const force = process.argv.includes('--force');
  const ids = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const todo = (ids.length ? ids : Object.keys(MODELS)).filter((id) => force || ids.length || !fs.existsSync(path.join(OUT, id + '.png')));
  let total = 0;
  for (let i = 0; i < todo.length; i += 6) {
    await Promise.all(todo.slice(i, i + 6).map(async (id) => {
      for (let k = 0; k < 2; k++) {
        try { total += await generate(id); console.log(`✓ ${id}`); return; } catch (e) { if (k) console.log(`✗ ${id}: ${e.message}`); }
      }
    }));
  }
  console.log(`итого $${total.toFixed(3)}`);
}
