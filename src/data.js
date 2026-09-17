// Данные мира: классы, предметы, мобы, умения, зоны. Всё своё — механика в духе старых MMORPG.

export const MAX_LEVEL = 40;
// опыт до следующего уровня
export const xpToNext = (lv) => Math.round(60 * Math.pow(lv, 2.25));

export const CLASSES = {
  warrior: {
    name: 'Воин', color: 0xb04030,
    base: { hp: 120, mp: 30, patk: 9, matk: 3, pdef: 40, mdef: 30, aspd: 1.0, speed: 26, crit: 0.08 },
    grow: { hp: 22, mp: 4, patk: 2.2, matk: 0.4, pdef: 2.0, mdef: 1.2 },
    skills: ['power_strike', 'battle_cry', 'whirlwind'],
    range: 3.2,
  },
  mage: {
    name: 'Маг', color: 0x3050c0,
    base: { hp: 80, mp: 90, patk: 4, matk: 12, pdef: 30, mdef: 45, aspd: 0.8, speed: 24, crit: 0.05 },
    grow: { hp: 13, mp: 14, patk: 0.6, matk: 2.6, pdef: 1.2, mdef: 2.0 },
    skills: ['fire_bolt', 'heal', 'ice_nova'],
    range: 22,
  },
};

// умения: kind — dmg (физ/маг), heal, buff, aoe
export const SKILLS = {
  power_strike: { name: 'Мощный удар', key: '1', mp: 8, cd: 5, kind: 'dmg', school: 'p', mul: 2.4, range: 3.5, color: 0xffa040, lvl: 1 },
  battle_cry: { name: 'Боевой клич', key: '2', mp: 15, cd: 40, kind: 'buff', stat: 'patk', mul: 1.3, dur: 20, color: 0xff4040, lvl: 5 },
  whirlwind: { name: 'Вихрь', key: '3', mp: 22, cd: 10, kind: 'aoe', school: 'p', mul: 1.6, radius: 7, color: 0xffd060, lvl: 12 },
  fire_bolt: { name: 'Огненная стрела', key: '1', mp: 10, cd: 2.2, kind: 'dmg', school: 'm', mul: 2.2, range: 24, color: 0xff5010, cast: 0.8, lvl: 1 },
  heal: { name: 'Исцеление', key: '2', mp: 18, cd: 6, kind: 'heal', amount: 0.35, color: 0x60ff90, cast: 1.0, lvl: 3 },
  ice_nova: { name: 'Ледяная волна', key: '3', mp: 30, cd: 12, kind: 'aoe', school: 'm', mul: 1.8, radius: 9, color: 0x80d0ff, cast: 0.6, lvl: 10 },
};

// грейды снаряжения
export const GRADES = { none: 'без грейда', d: 'D', c: 'C', b: 'B' };

export const ITEMS = {
  // оружие
  sword_novice: { name: 'Меч новичка', slot: 'weapon', grade: 'none', patk: 6, price: 0, color: 0xa0a0a0 },
  staff_novice: { name: 'Посох новичка', slot: 'weapon', grade: 'none', patk: 3, matk: 6, price: 0, color: 0x8a6030 },
  sword_long: { name: 'Длинный меч', slot: 'weapon', grade: 'd', patk: 18, price: 900, lvl: 8, color: 0xc0c8d0 },
  staff_oak: { name: 'Дубовый жезл', slot: 'weapon', grade: 'd', patk: 7, matk: 17, price: 900, lvl: 8, color: 0x6a4020 },
  sword_crystal: { name: 'Кристальный клинок', slot: 'weapon', grade: 'c', patk: 38, price: 6500, lvl: 18, color: 0x80e0ff },
  staff_crystal: { name: 'Кристальный посох', slot: 'weapon', grade: 'c', patk: 14, matk: 36, price: 6500, lvl: 18, color: 0x90a0ff },
  sword_dragon: { name: 'Клинок дракона', slot: 'weapon', grade: 'b', patk: 70, price: 0, lvl: 25, color: 0xff6030, rare: true },
  // броня
  armor_cloth: { name: 'Холщовая рубаха', slot: 'armor', grade: 'none', pdef: 6, mdef: 4, price: 0, color: 0x9a8a6a },
  armor_leather: { name: 'Кожаный доспех', slot: 'armor', grade: 'd', pdef: 20, mdef: 10, price: 800, lvl: 8, color: 0x7a4a2a },
  armor_chain: { name: 'Кольчуга', slot: 'armor', grade: 'c', pdef: 42, mdef: 20, price: 5500, lvl: 18, color: 0x8090a0 },
  robe_mystic: { name: 'Мистическая мантия', slot: 'armor', grade: 'c', pdef: 26, mdef: 44, price: 5500, lvl: 18, color: 0x5040a0 },
  armor_bone: { name: 'Костяной доспех', slot: 'armor', grade: 'b', pdef: 70, mdef: 40, price: 0, lvl: 25, color: 0xe0dcc0, rare: true },
  // расходники
  potion_hp: { name: 'Зелье здоровья', use: 'hp', amount: 120, price: 30, stack: true, color: 0xff3040 },
  potion_mp: { name: 'Зелье маны', use: 'mp', amount: 80, price: 45, stack: true, color: 0x3060ff },
  scroll_escape: { name: 'Свиток возврата', use: 'escape', price: 120, stack: true, color: 0xe0d080 },
  // трофеи на продажу
  bone: { name: 'Кость', price: 8, stack: true, loot: true, color: 0xeeeedd },
  pelt: { name: 'Шкура', price: 14, stack: true, loot: true, color: 0x8a6a4a },
  crystal: { name: 'Кристалл', price: 60, stack: true, loot: true, color: 0x90e0ff },
  ectoplasm: { name: 'Эктоплазма', price: 90, stack: true, loot: true, color: 0x90ffb0 },
};

// мобы: shape — вид (для процедурной модели)
export const MOBS = {
  rabbit: { name: 'Полевой кролик', lvl: 1, hp: 40, patk: 5, pdef: 20, xp: 18, coins: [2, 6], shape: 'critter', color: 0xd0c0a0, size: 0.8, drops: { pelt: 0.3 } },
  wolf: { name: 'Серый волк', lvl: 3, hp: 85, patk: 10, pdef: 28, xp: 45, coins: [5, 12], shape: 'beast', color: 0x707070, size: 1.1, drops: { pelt: 0.5 } },
  goblin: { name: 'Гоблин-разведчик', lvl: 5, hp: 130, patk: 15, pdef: 34, xp: 80, coins: [10, 22], shape: 'humanoid', color: 0x4a8a3a, size: 0.9, drops: { potion_hp: 0.15, bone: 0.3 } },
  boar: { name: 'Дикий кабан', lvl: 8, hp: 210, patk: 22, pdef: 45, xp: 140, coins: [15, 30], shape: 'beast', color: 0x6a4a30, size: 1.4, drops: { pelt: 0.6 } },
  treant: { name: 'Древень', lvl: 11, hp: 380, patk: 30, pdef: 70, xp: 240, coins: [25, 50], shape: 'tree', color: 0x3a5a2a, size: 1.8, drops: { crystal: 0.1 } },
  orc: { name: 'Орк-воитель', lvl: 14, hp: 520, patk: 42, pdef: 80, xp: 360, coins: [40, 80], shape: 'humanoid', color: 0x3a6a4a, size: 1.4, aggro: true, drops: { potion_hp: 0.2, bone: 0.4 } },
  spider: { name: 'Пещерный паук', lvl: 16, hp: 600, patk: 50, pdef: 85, xp: 430, coins: [45, 90], shape: 'spider', color: 0x3a2a3a, size: 1.3, aggro: true, drops: { crystal: 0.15 } },
  scorpion: { name: 'Песчаный скорпион', lvl: 19, hp: 820, patk: 60, pdef: 110, xp: 600, coins: [60, 120], shape: 'spider', color: 0xb08040, size: 1.5, drops: { crystal: 0.2 } },
  golem: { name: 'Каменный голем', lvl: 23, hp: 1400, patk: 78, pdef: 160, xp: 950, coins: [90, 170], shape: 'golem', color: 0x8a7a6a, size: 2.2, drops: { crystal: 0.35 } },
  skeleton: { name: 'Скелет-страж', lvl: 18, hp: 700, patk: 56, pdef: 95, xp: 520, coins: [55, 100], shape: 'humanoid', color: 0xe0dcc8, size: 1.1, aggro: true, drops: { bone: 0.8, potion_mp: 0.1 } },
  ghoul: { name: 'Упырь', lvl: 21, hp: 950, patk: 68, pdef: 120, xp: 720, coins: [70, 140], shape: 'humanoid', color: 0x6a8a6a, size: 1.2, aggro: true, drops: { ectoplasm: 0.25 } },
  wraith: { name: 'Призрак', lvl: 24, hp: 1100, patk: 80, pdef: 130, xp: 900, coins: [90, 160], shape: 'ghost', color: 0x90ffd0, size: 1.3, aggro: true, drops: { ectoplasm: 0.5 } },
  lich: { name: 'Король-лич', lvl: 28, hp: 9000, patk: 120, pdef: 200, xp: 9000, coins: [1500, 2500], shape: 'humanoid', color: 0x8040c0, size: 2.6, aggro: true, boss: true, respawn: 300, drops: { sword_dragon: 0.35, armor_bone: 0.35, ectoplasm: 1 } },
};

// торговцы
export const SHOP = ['potion_hp', 'potion_mp', 'scroll_escape', 'sword_long', 'staff_oak', 'armor_leather', 'sword_crystal', 'staff_crystal', 'armor_chain', 'robe_mystic'];
