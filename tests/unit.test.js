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
