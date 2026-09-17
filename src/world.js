// Процедурный мир: рельеф, два города, зоны охоты, катакомбы. Без текстур — цвет вершин и простые формы.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// ---------- шум ----------
function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < 5; i++) { s += a * vnoise(x * f, y * f); a *= 0.5; f *= 2; } return s; };
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export const MAP = 1600; // сторона карты, м
export const DUNGEON = { x0: 2200, z0: -200, cell: 18, n: 11 }; // катакомбы — отдельная площадка за краем карты

export const TOWNS = [
  { id: 'harbor', name: 'Светлая Гавань', x: -430, z: 400, r: 95, color: 0xd8cfb8 },
  { id: 'ford', name: 'Каменный Брод', x: 430, z: -400, r: 95, color: 0xb8a890 },
];

// зоны: круги с уровнем и мобами; первая подходящая по расстоянию
export const ZONES = [
  { id: 'meadow', name: 'Солнечные луга', x: -300, z: 250, r: 320, lv: '1–9', mobs: [['rabbit', 14], ['wolf', 12], ['goblin', 10], ['boar', 8]], ground: [0.36, 0.55, 0.24] },
  { id: 'forest', name: 'Сумрачный лес', x: 20, z: 10, r: 300, lv: '10–17', mobs: [['treant', 10], ['orc', 10], ['spider', 9]], ground: [0.16, 0.3, 0.14] },
  { id: 'waste', name: 'Выжженная пустошь', x: 360, z: -120, r: 330, lv: '18–25', mobs: [['scorpion', 12], ['golem', 9]], ground: [0.66, 0.55, 0.36] },
];
export const CRYPT = { x: 150, z: 250 }; // вход в катакомбы в лесу

export function zoneAt(x, z) {
  if (x > DUNGEON.x0 - 100) return { id: 'crypt', name: 'Катакомбы', lv: '18–28' };
  for (const t of TOWNS) if (Math.hypot(x - t.x, z - t.z) < t.r + 20) return { id: t.id, name: t.name, town: true, lv: 'мирная зона' };
  let best = null, bd = Infinity;
  for (const zn of ZONES) { const d = Math.hypot(x - zn.x, z - zn.z) / zn.r; if (d < bd) { bd = d; best = zn; } }
  return best;
}

export function heightAt(x, z) {
  if (x > DUNGEON.x0 - 100) return 0;
  let h = fbm(x * 0.006, z * 0.006) * 34 - 12;
  h += Math.pow(fbm(x * 0.02 + 5, z * 0.02), 2) * 6;
  // края карты — горы
  const edge = Math.max(Math.abs(x), Math.abs(z)) / (MAP / 2);
  h += smooth(0.82, 1.0, edge) * 90;
  // пустошь ровнее
  const w = ZONES[2]; h = THREE.MathUtils.lerp(h, h * 0.35 + 2, smooth(w.r, w.r * 0.5, Math.hypot(x - w.x, z - w.z)));
  // города — ровные площадки
  for (const t of TOWNS) { const d = Math.hypot(x - t.x, z - t.z); h = THREE.MathUtils.lerp(4, h, smooth(t.r, t.r + 60, d)); }
  // площадка у склепа
  h = THREE.MathUtils.lerp(heightAtBase(CRYPT.x, CRYPT.z), h, smooth(14, 30, Math.hypot(x - CRYPT.x, z - CRYPT.z)));
  return h;
}
function heightAtBase(x, z) { return fbm(x * 0.006, z * 0.006) * 34 - 12; }

// препятствия: круги {x,z,r}
export const obstacles = [];
const addObs = (x, z, r) => obstacles.push({ x, z, r });

const mat = (color, o = {}) => new THREE.MeshLambertMaterial({ color, ...o });
const MATS = {};
const M = (c) => (MATS[c] ||= mat(c));

// кладём геометрию в «ведро» по цвету → потом сливаем: весь статичный мир — десяток вызовов отрисовки
function bucketAdder() {
  const buckets = new Map();
  const add = (geo, color, x, y, z, ry = 0, sx = 1, sy = 1, sz = 1) => {
    const g = geo.clone(); g.scale(sx, sy, sz); if (ry) g.rotateY(ry); g.translate(x, y, z);
    const k = color; if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(g.index ? g.toNonIndexed() : g);
  };
  const build = (parent) => { for (const [c, list] of buckets) { const m = new THREE.Mesh(mergeGeometries(list), M(c)); m.castShadow = m.receiveShadow = true; parent.add(m); } };
  return { add, build };
}
const BOX = new THREE.BoxGeometry(1, 1, 1);
const CONE4 = new THREE.ConeGeometry(0.75, 1, 4).rotateY(Math.PI / 4);
const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
const CONE = new THREE.ConeGeometry(0.5, 1, 7);
const ICO = new THREE.IcosahedronGeometry(1, 0);

function buildTerrain(scene) {
  const seg = 220, geo = new THREE.PlaneGeometry(MAP + 400, MAP + 400, seg, seg).rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = heightAt(x, z);
    pos.setY(i, h);
    const zn = zoneAt(x, z);
    const base = zn.town ? [0.5, 0.48, 0.4] : zn.ground;
    const n = fbm(x * 0.05, z * 0.05);
    c.setRGB(base[0] * (0.8 + n * 0.4), base[1] * (0.8 + n * 0.4), base[2] * (0.8 + n * 0.4));
    // склоны и горы — камень, вершины — снег
    if (h > 40) c.lerp(new THREE.Color(0.45, 0.43, 0.42), smooth(40, 60, h));
    if (h > 75) c.lerp(new THREE.Color(0.92, 0.93, 0.96), smooth(75, 90, h));
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  m.receiveShadow = true; m.name = 'ground';
  scene.add(m);
  // вода в низинах
  const water = new THREE.Mesh(new THREE.PlaneGeometry(MAP + 400, MAP + 400).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x2a5a8a, transparent: true, opacity: 0.75 }));
  water.position.y = -6.5; scene.add(water);
  return m;
}

function buildTown(t, B, npcs) {
  const y = heightAt(t.x, t.z);
  // стена кольцом из сегментов, 4 ворот
  const segs = 36;
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    if (i % 9 === 0 || i % 9 === 8) continue; // проёмы ворот (стороны света)
    const x = t.x + Math.cos(a) * t.r, z = t.z + Math.sin(a) * t.r;
    B.add(BOX, 0x9a9088, x, y + 4, z, -a, 2.2, 8, (2 * Math.PI * t.r) / segs + 0.6);
    if (i % 3 === 0) { B.add(CYL, 0x8a8078, x, y + 6, z, 0, 5, 12, 5); B.add(CONE, 0x6a3a2a, x, y + 14, z, 0, 6.5, 5, 6.5); addObs(x, z, 3); }
    else addObs(x, z, 2.4);
  }
  // площадь и фонтан
  B.add(CYL, 0xcfc6b0, t.x, y + 0.1, t.z, 0, 40, 0.3, 40);
  B.add(CYL, 0x8a9aa8, t.x, y + 1, t.z, 0, 8, 2, 8); B.add(CYL, 0x4a8ac8, t.x, y + 1.6, t.z, 0, 7, 0.4, 7);
  B.add(CYL, 0xd8d0c0, t.x, y + 3, t.z, 0, 1.2, 5, 1.2);
  addObs(t.x, t.z, 4.5);
  // дома по кругу
  const r = (k) => hash(t.x + k, t.z - k);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + 0.2, d = 45 + r(i) * 30;
    if (Math.abs(Math.sin(a * 2)) < 0.25) continue; // улицы к воротам
    const x = t.x + Math.cos(a) * d, z = t.z + Math.sin(a) * d, w = 8 + r(i + 3) * 6, h = 6 + r(i + 5) * 6;
    B.add(BOX, t.color, x, y + h / 2, z, -a, w, h, w * 0.8);
    B.add(CONE4, i % 2 ? 0x8a3a2a : 0x3a4a6a, x, y + h + w * 0.35, z, -a, w * 0.95, w * 0.7, w * 0.85);
    addObs(x, z, w * 0.62);
  }
  // храм — точка возрождения
  B.add(BOX, 0xeeeae0, t.x, y + 7, t.z - 26, 0, 16, 14, 12);
  B.add(CONE4, 0xc8a040, t.x, y + 19, t.z - 26, 0, 16, 10, 12);
  addObs(t.x, t.z - 26, 9);
  // NPC
  npcs.push({ id: t.id + ':gk', town: t.id, role: 'gatekeeper', name: 'Хранитель врат', x: t.x + 12, z: t.z + 10, color: 0x9040d0 });
  npcs.push({ id: t.id + ':shop', town: t.id, role: 'merchant', name: 'Торговец', x: t.x - 12, z: t.z + 10, color: 0xd09030 });
  // врата телепорта — светящееся кольцо
  B.add(CYL, 0x6a5aa0, t.x + 18, y + 0.3, t.z + 16, 0, 6, 0.6, 6);
}

function buildNature(B) {
  // деревья: густо в лесу, реже на лугах; камни в пустоши
  let placed = 0;
  for (let i = 0; i < 9000 && placed < 2600; i++) {
    const x = (hash(i, 1) - 0.5) * MAP * 0.95, z = (hash(i, 2) - 0.5) * MAP * 0.95;
    const zn = zoneAt(x, z); if (zn.town) continue;
    if (TOWNS.some((t) => Math.hypot(x - t.x, z - t.z) < t.r + 30)) continue;
    if (Math.hypot(x - CRYPT.x, z - CRYPT.z) < 30) continue;
    if (TELEPORTS.some((t) => Math.hypot(x - t.x, z - t.z) < 14)) continue; // точки прибытия свободны
    const h = heightAt(x, z); if (h < -5 || h > 55) continue;
    const p = hash(i, 3);
    if (zn.id === 'forest' && p < 0.75) {
      const s = 1 + hash(i, 4) * 1.2;
      B.add(CYL, 0x4a3020, x, h + 3 * s, z, 0, 0.9 * s, 6 * s, 0.9 * s);
      B.add(CONE, p < 0.4 ? 0x1f4a24 : 0x2a5a2a, x, h + 9 * s, z, 0, 7 * s, 11 * s, 7 * s);
      addObs(x, z, 1.2 * s); placed++;
    } else if (zn.id === 'meadow' && p < 0.12) {
      const s = 1 + hash(i, 4);
      B.add(CYL, 0x5a3a22, x, h + 2 * s, z, 0, 0.8 * s, 4 * s, 0.8 * s);
      B.add(ICO, 0x3a7a30, x, h + 5.5 * s, z, 0, 3.2 * s, 2.8 * s, 3.2 * s);
      addObs(x, z, 1 * s); placed++;
    } else if (zn.id === 'waste' && p < 0.1) {
      const s = 1.5 + hash(i, 4) * 3;
      B.add(ICO, 0x8a7050, x, h + s * 0.4, z, p * 30, s, s * 0.7, s * 1.2);
      addObs(x, z, s * 0.9); placed++;
    }
  }
}

function buildCrypt(B) {
  const y = heightAt(CRYPT.x, CRYPT.z);
  B.add(BOX, 0x5a5560, CRYPT.x, y + 5, CRYPT.z, 0, 14, 10, 14);
  B.add(CONE4, 0x3a3540, CRYPT.x, y + 14, CRYPT.z, 0, 15, 8, 15);
  B.add(BOX, 0x0a0a10, CRYPT.x, y + 3, CRYPT.z + 7.05, 0, 4, 6, 0.3); // проём
  addObs(CRYPT.x, CRYPT.z, 7.5);
}

// лабиринт катакомб: генерация проходов (DFS), стены — препятствия
export const dungeonCells = [];
export const dungeonWalls = new Set(); // заполняется при генерации — для тестов проходимости
function buildDungeon(B) {
  const { x0, z0, cell, n } = DUNGEON;
  const vis = Array.from({ length: n }, () => Array(n).fill(false));
  const walls = new Set(); // "x,z,dir" dir: e/s
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { walls.add(`${i},${j},e`); walls.add(`${i},${j},s`); }
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const stack = [[0, 0]]; vis[0][0] = true;
  while (stack.length) {
    const [i, j] = stack[stack.length - 1];
    const nb = [[1, 0, 'e'], [-1, 0, 'w'], [0, 1, 's'], [0, -1, 'n']].filter(([di, dj]) => vis[i + di]?.[j + dj] === false);
    if (!nb.length) { stack.pop(); continue; }
    const [di, dj, d] = nb[Math.floor(rnd() * nb.length)];
    if (d === 'e') walls.delete(`${i},${j},e`); if (d === 'w') walls.delete(`${i - 1},${j},e`);
    if (d === 's') walls.delete(`${i},${j},s`); if (d === 'n') walls.delete(`${i},${j - 1},s`);
    vis[i + di][j + dj] = true; stack.push([i + di, j + dj]);
  }
  // лишние проходы — меньше тупиков
  for (let k = 0; k < n * 2; k++) { const i = Math.floor(rnd() * (n - 1)), j = Math.floor(rnd() * n); walls.delete(`${i},${j},e`); }
  for (const w of walls) dungeonWalls.add(w);
  const size = n * cell;
  B.add(BOX, 0x2a2628, x0 + size / 2, -0.5, z0 + size / 2, 0, size, 1, size);
  const wall = (x, z, sx, sz) => {
    B.add(BOX, 0x4a4450, x, 4, z, 0, sx, 8, sz);
    // препятствия — цепочка кругов вдоль стены
    const len = Math.max(sx, sz), steps = Math.ceil(len / 2.5);
    for (let s = 0; s <= steps; s++) { const t = s / steps - 0.5; addObs(x + (sx > sz ? t * sx : 0), z + (sz > sx ? t * sz : 0), 1.6); }
  };
  wall(x0 + size / 2, z0, size, 1.5); wall(x0 + size / 2, z0 + size, size, 1.5);
  wall(x0, z0 + size / 2, 1.5, size); wall(x0 + size, z0 + size / 2, 1.5, size);
  for (const w of walls) {
    const [i, j, d] = w.split(','); const ci = +i, cj = +j;
    if (d === 'e' && ci < n - 1) wall(x0 + (ci + 1) * cell, z0 + (cj + 0.5) * cell, 1.5, cell + 1.5);
    if (d === 's' && cj < n - 1) wall(x0 + (ci + 0.5) * cell, z0 + (cj + 1) * cell, cell + 1.5, 1.5);
  }
  // колонны и факелы в клетках
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const cx = x0 + (i + 0.5) * cell, cz = z0 + (j + 0.5) * cell;
    dungeonCells.push({ x: cx, z: cz, i, j });
    if ((i + j) % 3 === 0) B.add(CYL, 0xff8a30, cx, 7.5, cz - cell / 2 + 1.2, 0, 0.5, 1, 0.5);
  }
}

export function buildWorld(scene) {
  const B = bucketAdder();
  const npcs = [];
  const ground = buildTerrain(scene);
  for (const t of TOWNS) buildTown(t, B, npcs);
  buildNature(B);
  buildCrypt(B);
  buildDungeon(B);
  B.build(scene);
  // факелы катакомб — тёплый свет
  const { x0, z0, cell, n } = DUNGEON;
  for (let k = 0; k < 6; k++) { const l = new THREE.PointLight(0xff9040, 60, 70, 1.5); l.position.set(x0 + ((k % 3) + 0.5) * (n * cell / 3), 7, z0 + ((k / 3 | 0) + 0.5) * (n * cell / 2)); scene.add(l); }
  // спавны
  const spawns = [];
  for (const zn of ZONES) for (const [mob, count] of zn.mobs) for (let k = 0; k < count; k++) {
    for (let tries = 0; tries < 30; tries++) {
      const a = hash(k * 13 + zn.x, mob.length * 7 + tries) * Math.PI * 2, d = Math.sqrt(hash(k, tries + zn.z)) * zn.r * 0.85;
      const x = zn.x + Math.cos(a) * d, z = zn.z + Math.sin(a) * d;
      if (zoneAt(x, z).id !== zn.id || heightAt(x, z) < -5 || heightAt(x, z) > 45) continue;
      if (TOWNS.some((t) => Math.hypot(x - t.x, z - t.z) < t.r + 40)) continue;
      spawns.push({ mob, x, z }); break;
    }
  }
  const undead = ['skeleton', 'skeleton', 'ghoul', 'wraith'];
  dungeonCells.forEach((c, k) => { if (c.i + c.j > 1 && k % 2 === 0) spawns.push({ mob: undead[k % undead.length], x: c.x + 3, z: c.z - 2 }); });
  const last = dungeonCells[dungeonCells.length - 1];
  spawns.push({ mob: 'lich', x: last.x, z: last.z });
  return { ground, npcs, spawns };
}

// точки телепорта
export const TELEPORTS = [
  { id: 'harbor', name: 'Светлая Гавань', x: TOWNS[0].x + 18, z: TOWNS[0].z + 22, cost: 0 },
  { id: 'ford', name: 'Каменный Брод', x: TOWNS[1].x + 18, z: TOWNS[1].z + 22, cost: 0 },
  { id: 'meadow', name: 'Солнечные луга (1–9)', x: -260, z: 180, cost: 80 },
  { id: 'forest', name: 'Сумрачный лес (10–17)', x: -20, z: 60, cost: 200 },
  { id: 'waste', name: 'Выжженная пустошь (18–25)', x: 300, z: -160, cost: 400 },
  { id: 'crypt', name: 'Катакомбы (18–28)', x: DUNGEON.x0 + DUNGEON.cell / 2, z: DUNGEON.z0 + DUNGEON.cell / 2, cost: 600 },
];
