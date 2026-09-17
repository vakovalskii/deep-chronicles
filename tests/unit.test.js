// Юнит-тесты данных и генерации мира: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CLASSES, SKILLS, ITEMS, MOBS, SHOP, xpToNext, MAX_LEVEL } from '../src/data.js';
import { buildWorld, heightAt, zoneAt, obstacles, TOWNS, TELEPORTS, ZONES, DUNGEON, dungeonCells, dungeonWalls, CRYPT } from '../src/world.js';

const world = buildWorld(new THREE.Scene());
const blocked = (x, z, r = 0.6) => obstacles.find((o) => Math.hypot(x - o.x, z - o.z) < o.r + r);

test('опыт растёт с уровнем', () => {
  for (let l = 1; l < MAX_LEVEL; l++) assert.ok(xpToNext(l + 1) > xpToNext(l), `уровень ${l}`);
});

test('ссылки в данных валидны', () => {
  for (const [id, c] of Object.entries(CLASSES)) for (const s of c.skills) assert.ok(SKILLS[s], `${id}: нет умения ${s}`);
  for (const [id, m] of Object.entries(MOBS)) {
    for (const d of Object.keys(m.drops || {})) assert.ok(ITEMS[d], `${id}: нет предмета ${d}`);
    assert.ok(m.hp > 0 && m.xp > 0 && m.coins[0] <= m.coins[1], `${id}: характеристики`);
  }
  for (const id of SHOP) { assert.ok(ITEMS[id], `магазин: ${id}`); assert.ok(ITEMS[id].price > 0, `магазин: цена ${id}`); }
  for (const z of ZONES) for (const [m] of z.mobs) assert.ok(MOBS[m], `${z.id}: нет моба ${m}`);
});

test('у каждого класса есть умение первого уровня', () => {
  for (const [id, c] of Object.entries(CLASSES)) assert.ok(c.skills.some((s) => SKILLS[s].lvl === 1), id);
});

test('города — мирные зоны и ровные', () => {
  for (const t of TOWNS) {
    assert.ok(zoneAt(t.x, t.z).town, t.id);
    assert.ok(Math.abs(heightAt(t.x + 30, t.z) - heightAt(t.x - 30, t.z)) < 0.5, `${t.id} ровный`);
  }
});

test('телепорты и NPC не в стенах', () => {
  for (const t of TELEPORTS) assert.ok(!blocked(t.x, t.z), `телепорт ${t.id} в препятствии`);
  for (const n of world.npcs) assert.ok(!obstacles.some((o) => Math.hypot(n.x - o.x, n.z - o.z) < o.r * 0.9), `NPC ${n.id} в препятствии`);
});

test('точки возрождения и выход из катакомб свободны', () => {
  for (const t of TOWNS) assert.ok(!blocked(t.x, t.z - 12), `возрождение ${t.id}`);
  assert.ok(!blocked(CRYPT.x, CRYPT.z + 13.5), 'выход из катакомб');
});

test('спавны: мобы существуют, не в городах, не под водой, не в стенах', () => {
  assert.ok(world.spawns.length > 100, `мало спавнов: ${world.spawns.length}`);
  for (const s of world.spawns) {
    assert.ok(MOBS[s.mob], s.mob);
    assert.ok(!zoneAt(s.x, s.z).town, `${s.mob} в городе`);
    if (s.x < DUNGEON.x0) assert.ok(heightAt(s.x, s.z) > -6, `${s.mob} под водой`);
  }
  const stuck = world.spawns.filter((s) => blocked(s.x, s.z, 0.2));
  assert.ok(stuck.length <= world.spawns.length * 0.1, `в препятствиях ${stuck.length}`);
  assert.equal(world.spawns.filter((s) => MOBS[s.mob].boss).length, 1, 'ровно один босс');
});

test('в каждой зоне есть мобы', () => {
  for (const z of ZONES) assert.ok(world.spawns.some((s) => zoneAt(s.x, s.z).id === z.id), z.id);
});

test('катакомбы: все клетки достижимы, босс в дальнем углу', () => {
  const n = DUNGEON.n, seen = new Set(['0,0']), q = [[0, 0]];
  const open = (i, j, di, dj) => {
    if (di === 1) return !dungeonWalls.has(`${i},${j},e`);
    if (di === -1) return !dungeonWalls.has(`${i - 1},${j},e`);
    if (dj === 1) return !dungeonWalls.has(`${i},${j},s`);
    return !dungeonWalls.has(`${i},${j - 1},s`);
  };
  while (q.length) {
    const [i, j] = q.shift();
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di, b = j + dj;
      if (a < 0 || b < 0 || a >= n || b >= n || seen.has(`${a},${b}`) || !open(i, j, di, dj)) continue;
      seen.add(`${a},${b}`); q.push([a, b]);
    }
  }
  assert.equal(seen.size, n * n);
  assert.equal(dungeonCells.length, n * n);
  const boss = world.spawns.find((s) => MOBS[s.mob].boss);
  assert.ok(boss.x > DUNGEON.x0 + DUNGEON.cell * (n - 1), 'босс в дальнем углу');
});

test('уровни мобов соответствуют зонам', () => {
  const lv = { meadow: [1, 9], forest: [10, 17], waste: [18, 25] };
  for (const z of ZONES) for (const [m] of z.mobs) { const l = MOBS[m].lvl; assert.ok(l >= lv[z.id][0] - 1 && l <= lv[z.id][1], `${m} ${l} в ${z.id}`); }
});

// ---- экипировка, комплекты, заточка ----
import { SETS, SLOTS } from '../src/data.js';
import { calcStats, equipFromBag, unequipSlot, enchValue, migrate, weightOf } from '../src/stats.js';
const hero = (cls = 'warrior', lvl = 30) => migrate({ cls, lvl, xp: 0, inv: [], equip: { weapon: null, armor: null }, kills: 0 });
const give = (P, id) => { P.inv.push({ id, n: 1 }); return P.inv.length - 1; };

test('комплекты и слоты ссылаются на существующие предметы', () => {
  const types = new Set(SLOTS.map((s) => s.type));
  for (const [id, it] of Object.entries(ITEMS)) {
    if (it.slot) assert.ok(types.has(it.slot), `${id}: неизвестный слот ${it.slot}`);
    if (it.set) assert.ok(SETS[it.set]?.parts.includes(id), `${id}: нет в комплекте ${it.set}`);
    assert.ok(typeof it.w === 'number', `${id}: нет веса`);
  }
  for (const [id, st] of Object.entries(SETS)) {
    for (const p of st.parts) assert.equal(ITEMS[p]?.set, id, `${id}: часть ${p}`);
    assert.equal(new Set(st.parts.map((p) => ITEMS[p].slot)).size, st.parts.length, `${id}: две части в одном слоте`);
  }
});

test('экипировка: надеть, снять, парные слоты', () => {
  const P = hero();
  assert.equal(equipFromBag(P, give(P, 'ring_bronze')), null);
  assert.equal(equipFromBag(P, give(P, 'ring_silver')), null);
  assert.equal(P.equip.ring1, 'ring_bronze'); assert.equal(P.equip.ring2, 'ring_silver');
  assert.ok(equipFromBag(P, give(P, 'ear_bronze'), 'ring1'), 'серьга в кольцо');
  unequipSlot(P, 'ring1');
  assert.equal(P.equip.ring1, null); assert.ok(P.inv.some((e) => e.id === 'ring_bronze'));
});

test('двуручное снимает щит, мантия — поножи; ограничения класса', () => {
  const P = hero('mage');
  equipFromBag(P, give(P, 'shield_wood')); equipFromBag(P, give(P, 'legs_leather'));
  equipFromBag(P, give(P, 'staff_oak'));
  assert.equal(P.equip.shield, null); assert.equal(P.equip.weapon, 'staff_oak');
  equipFromBag(P, give(P, 'robe_mystic'));
  assert.equal(P.equip.legs, null); assert.equal(P.equip.armor, 'robe_mystic');
  const W = hero('warrior');
  assert.ok(equipFromBag(W, give(W, 'robe_mystic')), 'воин в мантии');
  assert.ok(equipFromBag(W, give(W, 'staff_oak')), 'воин с посохом');
  const low = hero('warrior', 5);
  assert.ok(equipFromBag(low, give(low, 'helm_chain')), 'уровень не проверен');
});

test('заточка переносится вместе с вещью и растит характеристику', () => {
  const P = hero();
  P.inv.push({ id: 'sword_long', n: 1, e: 5 });
  const before = calcStats(P).patk;
  equipFromBag(P, P.inv.length - 1);
  assert.equal(P.enc.weapon, 5);
  assert.equal(Math.round(calcStats(P).patk - before), enchValue(ITEMS.sword_long, 'patk', 5));
  assert.ok(enchValue(ITEMS.sword_long, 'patk', 5) > enchValue(ITEMS.sword_long, 'patk', 3));
  unequipSlot(P, 'weapon');
  assert.equal(P.inv.at(-1).e, 5);
});

test('полный комплект даёт бонус, неполный — нет', () => {
  const P = hero();
  const parts = SETS.chain.parts;
  for (const p of parts.slice(0, -1)) equipFromBag(P, give(P, p));
  const part = calcStats(P);
  equipFromBag(P, give(P, parts.at(-1)));
  const full = calcStats(P);
  assert.equal(full.maxHp - part.maxHp, SETS.chain.bonus.hp);
  assert.equal(Math.round(full.pdef - part.pdef), ITEMS[parts.at(-1)].pdef + SETS.chain.bonus.pdef);
});

test('перегруз замедляет', () => {
  const P = hero();
  const s0 = calcStats(P);
  P.inv.push({ id: 'bone', n: 1000 });
  assert.ok(weightOf(P) > s0.cap);
  assert.ok(calcStats(P).speed < s0.speed);
});
