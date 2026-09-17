import * as THREE from 'three';
import { CLASSES, SKILLS, ITEMS, MOBS, SHOP, GRADES, xpToNext, MAX_LEVEL } from './data.js';
import { buildWorld, heightAt, zoneAt, obstacles, TOWNS, TELEPORTS, CRYPT, DUNGEON, ZONES, MAP } from './world.js';
import { buildMob, buildHero, buildNpc } from './models.js';

const $ = (id) => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const irand = (a, b) => Math.floor(rand(a, b + 1));

// ================= Рендер =================
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
const SKY = new THREE.Color(0x9cc4e8), CRYPT_SKY = new THREE.Color(0x07060a);
scene.background = SKY.clone();
scene.fog = new THREE.Fog(SKY.clone(), 150, 620);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.3, 2000);
const hemi = new THREE.HemisphereLight(0xdfefff, 0x4a4030, 1.3);
const sun = new THREE.DirectionalLight(0xfff0d8, 2.2);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 300 });
scene.add(hemi, sun, sun.target);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

const { ground, npcs: npcDefs, spawns } = buildWorld(scene);

// ================= Сохранение =================
const SAVE_KEY = 'l2w-save1';
const loadSave = () => { try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { return null; } };
let P = null; // персонаж
function newChar(name, clsId) {
  const cls = CLASSES[clsId];
  const t = TOWNS[0];
  return {
    name, cls: clsId, lvl: 1, xp: 0, coins: 150, hp: cls.base.hp, mp: cls.base.mp,
    inv: [{ id: 'potion_hp', n: 5 }, { id: 'scroll_escape', n: 1 }],
    equip: { weapon: clsId === 'mage' ? 'staff_novice' : 'sword_novice', armor: 'armor_cloth' },
    x: t.x + 5, z: t.z + 30, home: t.id, kills: 0,
  };
}
function save() { if (!P) return; P.x = hero.position.x; P.z = hero.position.z; try { localStorage.setItem(SAVE_KEY, JSON.stringify(P)); } catch { /* */ } }
setInterval(save, 10000);
addEventListener('beforeunload', save);

// ================= Характеристики =================
const buffs = []; // { stat, mul, until }
function stats() {
  const c = CLASSES[P.cls], L = P.lvl - 1, w = ITEMS[P.equip.weapon] || {}, a = ITEMS[P.equip.armor] || {};
  const s = {
    maxHp: Math.round(c.base.hp + c.grow.hp * L), maxMp: Math.round(c.base.mp + c.grow.mp * L),
    patk: c.base.patk + c.grow.patk * L + (w.patk || 0), matk: c.base.matk + c.grow.matk * L + (w.matk || 0),
    pdef: c.base.pdef + c.grow.pdef * L + (a.pdef || 0), mdef: c.base.mdef + c.grow.mdef * L + (a.mdef || 0),
    aspd: c.base.aspd, speed: c.base.speed, crit: c.base.crit, range: c.range,
  };
  const now = performance.now();
  for (const b of buffs) if (b.until > now) s[b.stat] *= b.mul;
  return s;
}
const invCount = (id) => P.inv.find((i) => i.id === id)?.n || 0;
function addItem(id, n = 1) {
  const it = ITEMS[id];
  const e = it.stack && P.inv.find((i) => i.id === id);
  if (e) e.n += n; else for (let k = 0; k < (it.stack ? 1 : n); k++) P.inv.push({ id, n: it.stack ? n : 1 });
}
function takeItem(id, n = 1) {
  const idx = P.inv.findIndex((i) => i.id === id); if (idx < 0) return false;
  const e = P.inv[idx]; if (e.n < n) return false;
  e.n -= n; if (e.n <= 0) P.inv.splice(idx, 1);
  return true;
}

// ================= Персонаж =================
let hero = null;
const heroSt = { moving: false, attackT: 0, casting: false };
function spawnHero() {
  if (hero) scene.remove(hero);
  hero = buildHero(CLASSES[P.cls]);
  hero.position.set(P.x, heightAt(P.x, P.z), P.z);
  scene.add(hero);
  refreshGear();
}
function refreshGear() {
  const w = ITEMS[P.equip.weapon], a = ITEMS[P.equip.armor];
  hero.userData.setWeapon(w.color, P.equip.weapon.startsWith('staff'));
  hero.userData.setBody(a.grade === 'none' ? CLASSES[P.cls].color : a.color);
}

// ================= Мобы =================
const mobs = [];
const MOB_LABEL_MAX = 20;
for (const sp of spawns) {
  const def = MOBS[sp.mob];
  const m = { def, id: sp.mob, home: new THREE.Vector3(sp.x, 0, sp.z), hp: def.hp, state: 'idle', target: null, atkCd: 0, wanderT: rand(1, 6), dest: null, dead: false, respawnAt: 0, st: { moving: false, attackT: 0 }, label: null };
  m.obj = buildMob(def);
  m.obj.position.set(sp.x, heightAt(sp.x, sp.z), sp.z);
  m.obj.rotation.y = rand(0, 6.28);
  m.obj.traverse((o) => { o.userData.mob = m; });
  m.radius = (def.size || 1) * 0.9;
  scene.add(m.obj);
  mobs.push(m);
}
function mobDmg(m) { return m.def.patk; }

// ================= NPC =================
const npcs = npcDefs.map((d) => {
  const obj = buildNpc(d.color);
  obj.position.set(d.x, heightAt(d.x, d.z), d.z);
  obj.traverse((o) => { o.userData.npc = d; });
  scene.add(obj);
  obstacles.push({ x: d.x, z: d.z, r: 0.9 });
  return { ...d, obj };
});
// портал выхода из катакомб и вход у склепа
const cryptDoor = new THREE.Vector3(CRYPT.x, heightAt(CRYPT.x, CRYPT.z), CRYPT.z + 8.5);
const dungeonExit = new THREE.Vector3(DUNGEON.x0 + DUNGEON.cell / 2 - 4, 0, DUNGEON.z0 + DUNGEON.cell / 2 - 4);
{
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.25, 8, 32), new THREE.MeshBasicMaterial({ color: 0x9a70ff }));
  ring.position.copy(dungeonExit).setY(2.4); scene.add(ring);
  const ring2 = ring.clone(); ring2.position.copy(cryptDoor).setY(cryptDoor.y + 3); ring2.material = new THREE.MeshBasicMaterial({ color: 0x6040a0 }); scene.add(ring2);
}

// ================= Эффекты =================
const fx = [];
function ringFx(pos, radius, color) {
  const m = new THREE.Mesh(new THREE.RingGeometry(radius * 0.8, radius, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide }));
  m.position.copy(pos).add(new THREE.Vector3(0, 0.3, 0)); scene.add(m);
  fx.push({ m, life: 0.5, max: 0.5, grow: true });
}
function flashFx(pos, color, size = 1) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.6 * size, 10, 8), new THREE.MeshBasicMaterial({ color, transparent: true }));
  m.position.copy(pos).add(new THREE.Vector3(0, 1.4, 0)); scene.add(m);
  fx.push({ m, life: 0.35, max: 0.35, grow: true });
}
const bolts = [];
function boltFx(from, target, color, onHit) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshBasicMaterial({ color }));
  m.position.copy(from).add(new THREE.Vector3(0, 1.6, 0)); scene.add(m);
  bolts.push({ m, target, onHit });
}
function floatText(pos, text, color = '#fff', big = false) {
  const el = document.createElement('div');
  el.className = 'ftext' + (big ? ' big' : ''); el.textContent = text; el.style.color = color;
  $('labels').append(el);
  fx.push({ el, pos: pos.clone().add(new THREE.Vector3(rand(-0.5, 0.5), 2.6, 0)), life: 1.1, max: 1.1 });
}
function updateFx(dt) {
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i]; f.life -= dt; const k = 1 - f.life / f.max;
    if (f.m) { f.m.material.opacity = 1 - k; if (f.grow) f.m.scale.setScalar(1 + k * 1.5); }
    if (f.el) { f.pos.y += dt * 1.6; const p = toScreen(f.pos); f.el.style.transform = `translate(${p.x}px,${p.y}px) translate(-50%,-50%)`; f.el.style.opacity = String(1 - k * k); f.el.style.display = p.vis ? '' : 'none'; }
    if (f.life <= 0) { if (f.m) { scene.remove(f.m); f.m.geometry.dispose(); } f.el?.remove(); fx.splice(i, 1); }
  }
  for (let i = bolts.length - 1; i >= 0; i--) {
    const b = bolts[i], tp = b.target.obj.position.clone().add(new THREE.Vector3(0, 1.2, 0));
    const d = tp.clone().sub(b.m.position), L = d.length();
    if (L < 0.8 || b.target.dead) { scene.remove(b.m); bolts.splice(i, 1); if (!b.target.dead) b.onHit(); continue; }
    b.m.position.addScaledVector(d.normalize(), Math.min(L, dt * 45));
  }
}

// ================= Лог и сообщения =================
function log(text, cls = '') {
  const el = document.createElement('div'); el.className = cls; el.textContent = text;
  const box = $('log'); box.append(el); while (box.children.length > 60) box.firstChild.remove();
  box.scrollTop = box.scrollHeight;
}
let bannerT = 0;
function banner(text) { $('banner').textContent = text; $('banner').style.opacity = '1'; bannerT = 2.5; }

// ================= Бой =================
let target = null;       // моб или NPC
let attacking = false;   // автоатака цели
let dest = null;         // точка движения
let atkTimer = 0;
const cds = {};          // кулдауны умений
let cast = null;         // { skill, t, target }
let dead = false;

function calcDmg(atk, def, mul = 1, crit = 0) {
  let d = atk * mul * (70 / (70 + def)) * rand(0.9, 1.1) * 3;
  const isCrit = Math.random() < crit; if (isCrit) d *= 2;
  return { d: Math.max(1, Math.round(d)), crit: isCrit };
}
function levelColor(lv) {
  const diff = lv - P.lvl;
  return diff >= 5 ? '#ff4040' : diff >= 3 ? '#ff9a40' : diff >= -2 ? '#ffffff' : diff >= -5 ? '#80c0ff' : '#80ff80';
}
function hitMob(m, dmg, crit, color) {
  if (m.dead) return;
  m.hp -= dmg;
  floatText(m.obj.position, crit ? `${dmg}!` : String(dmg), color || (crit ? '#ffd040' : '#ffffff'), crit);
  if (m.state !== 'chase') { m.state = 'chase'; m.target = 'hero'; }
  if (m.hp <= 0) killMob(m);
}
function killMob(m) {
  m.dead = true; m.hp = 0; m.state = 'dead';
  m.respawnAt = performance.now() + (m.def.respawn || 25) * 1000;
  m.obj.rotation.z = Math.PI / 2; m.obj.position.y += 0.3;
  // опыт — меньше за слабых
  const diff = m.def.lvl - P.lvl;
  const xp = Math.round(m.def.xp * (diff < -5 ? Math.max(0.1, 1 + (diff + 5) * 0.15) : 1));
  gainXp(xp);
  const coins = irand(...m.def.coins); P.coins += coins;
  log(`${m.def.name} повержен. Опыт +${xp}, монеты +${coins}`, 'good');
  for (const [id, ch] of Object.entries(m.def.drops || {})) if (Math.random() < ch) { addItem(id); log(`Получено: ${ITEMS[id].name}`, ITEMS[id].rare ? 'rare' : 'loot'); if (ITEMS[id].rare) banner(`Редкая добыча: ${ITEMS[id].name}!`); }
  P.kills++;
  if (m.def.boss) banner(`${m.def.name} повержен!`);
  if (target === m) { attacking = false; }
  setTimeout(() => { if (m.dead) m.obj.visible = false; if (target === m) target = null; }, 2500);
  renderInv();
}
function gainXp(xp) {
  if (P.lvl >= MAX_LEVEL) return;
  P.xp += xp;
  while (P.lvl < MAX_LEVEL && P.xp >= xpToNext(P.lvl)) {
    P.xp -= xpToNext(P.lvl); P.lvl++;
    const s = stats(); P.hp = s.maxHp; P.mp = s.maxMp;
    banner(`Новый уровень: ${P.lvl}`); log(`Уровень повышен до ${P.lvl}!`, 'rare');
    ringFx(hero.position, 4, 0xffe070); flashFx(hero.position, 0xffe070, 2.5);
    for (const id of CLASSES[P.cls].skills) if (SKILLS[id].lvl === P.lvl) log(`Изучено умение: ${SKILLS[id].name}`, 'good');
    renderSkills();
  }
  save();
}
function heroHit(m) {
  if (dead) return;
  const s = stats();
  const { d } = calcDmg(mobDmg(m), s.pdef, 1, 0.05);
  P.hp -= d;
  floatText(hero.position, String(d), '#ff6060');
  if (P.hp <= 0) die(m);
}
function die(m) {
  dead = true; P.hp = 0; attacking = false; cast = null; dest = null;
  const loss = Math.round(xpToNext(P.lvl) * 0.04); P.xp = Math.max(0, P.xp - loss);
  log(`Вас убил ${m.def.name}. Потеряно опыта: ${loss}`, 'bad');
  hero.rotation.z = Math.PI / 2;
  for (const mm of mobs) if (mm.target === 'hero') { mm.state = 'return'; mm.target = null; }
  $('death').hidden = false;
}
function respawn() {
  const t = TOWNS.find((x) => x.id === P.home) || TOWNS[0];
  dead = false; hero.rotation.z = 0;
  const s = stats(); P.hp = Math.round(s.maxHp * 0.7); P.mp = Math.round(s.maxMp * 0.7);
  teleportTo(t.x, t.z - 12);
  $('death').hidden = true;
}

function useSkill(id) {
  if (dead || cast) return;
  const sk = SKILLS[id];
  if (!CLASSES[P.cls].skills.includes(id)) return;
  if (P.lvl < sk.lvl) return log(`${sk.name}: нужен уровень ${sk.lvl}`, 'bad');
  if ((cds[id] || 0) > performance.now()) return;
  if (P.mp < sk.mp) return log('Недостаточно маны', 'bad');
  const s = stats();
  if (sk.kind === 'dmg') {
    if (!target || target.dead || !target.def) return log('Нет цели', 'bad');
    const dist = flatDist(hero.position, target.obj.position);
    if (dist > sk.range + target.radius) { dest = null; attacking = true; pendingSkill = id; return; }
  }
  if (inTown() && sk.kind !== 'heal' && sk.kind !== 'buff') return log('В городе сражаться нельзя', 'bad');
  P.mp -= sk.mp; cds[id] = performance.now() + sk.cd * 1000;
  if (sk.cast) { cast = { id, t: sk.cast, target }; heroSt.casting = true; dest = null; return; }
  applySkill(id, target, s);
}
let pendingSkill = null;
function applySkill(id, tgt, s) {
  const sk = SKILLS[id];
  const face = tgt?.obj?.position; if (face) faceTo(face);
  if (sk.kind === 'dmg') {
    if (!tgt || tgt.dead) return;
    const atk = sk.school === 'm' ? s.matk : s.patk;
    const r = calcDmg(atk, tgt.def.pdef * (sk.school === 'm' ? 0.8 : 1), sk.mul, s.crit + 0.05);
    if (sk.school === 'm') boltFx(hero.position, tgt, sk.color, () => { hitMob(tgt, r.d, r.crit, '#ffb060'); flashFx(tgt.obj.position, sk.color); });
    else { heroSt.attackT = 1; hitMob(tgt, r.d, r.crit, '#ffb060'); flashFx(tgt.obj.position, sk.color); }
    attacking = true;
  } else if (sk.kind === 'heal') {
    const amt = Math.round(s.maxHp * sk.amount); P.hp = Math.min(s.maxHp, P.hp + amt);
    floatText(hero.position, `+${amt}`, '#60ff90'); ringFx(hero.position, 2.5, sk.color);
  } else if (sk.kind === 'buff') {
    buffs.push({ stat: sk.stat, mul: sk.mul, until: performance.now() + sk.dur * 1000, name: sk.name });
    ringFx(hero.position, 3, sk.color); log(`${sk.name}: сила атаки +${Math.round((sk.mul - 1) * 100)}% на ${sk.dur} с`, 'good');
  } else if (sk.kind === 'aoe') {
    ringFx(hero.position, sk.radius, sk.color); heroSt.attackT = 1;
    const atk = sk.school === 'm' ? s.matk : s.patk;
    let n = 0;
    for (const m of mobs) if (!m.dead && flatDist(m.obj.position, hero.position) < sk.radius + m.radius) { const r = calcDmg(atk, m.def.pdef, sk.mul, s.crit); hitMob(m, r.d, r.crit, '#ffe080'); n++; }
    if (!n) log(`${sk.name}: никого рядом`);
  }
}
function faceTo(p) { hero.rotation.y = Math.atan2(p.x - hero.position.x, p.z - hero.position.z); }
const flatDist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const inTown = () => !!zoneAt(hero.position.x, hero.position.z).town;

function useItem(id) {
  const it = ITEMS[id]; if (!it) return;
  if (it.slot) {
    if (it.lvl && P.lvl < it.lvl) return log(`${it.name}: нужен уровень ${it.lvl}`, 'bad');
    const cls = P.cls, isStaff = id.startsWith('staff'), isRobe = id.startsWith('robe');
    if (it.slot === 'weapon' && cls === 'warrior' && isStaff) return log('Воин не владеет посохом', 'bad');
    if (it.slot === 'armor' && cls === 'warrior' && isRobe) return log('Воин не носит мантии', 'bad');
    const old = P.equip[it.slot];
    if (!takeItem(id)) return;
    P.equip[it.slot] = id; if (old) addItem(old);
    refreshGear(); log(`Экипировано: ${it.name}`, 'good');
  } else if (it.use && !dead) {
    const s = stats();
    if (it.use === 'hp') { if (!takeItem(id)) return; P.hp = Math.min(s.maxHp, P.hp + it.amount); floatText(hero.position, `+${it.amount}`, '#60ff90'); }
    if (it.use === 'mp') { if (!takeItem(id)) return; P.mp = Math.min(s.maxMp, P.mp + it.amount); floatText(hero.position, `+${it.amount}`, '#6090ff'); }
    if (it.use === 'escape') { if (!takeItem(id)) return; log('Свиток возврата: перенос через 3 с…'); cast = { id: 'escape', t: 3 }; heroSt.casting = true; }
  }
  renderInv();
}

function teleportTo(x, z) {
  hero.position.set(x, heightAt(x, z), z);
  moveEntity(hero.position, tmp.set(0, 0, 0), 0, 0.6); // вытолкнуть из препятствий
  dest = null; attacking = false; target = null;
  for (const m of mobs) if (m.target === 'hero') { m.state = 'return'; m.target = null; }
  const inCrypt = x > DUNGEON.x0 - 100;
  scene.background.copy(inCrypt ? CRYPT_SKY : SKY); scene.fog.color.copy(scene.background);
  scene.fog.near = inCrypt ? 20 : 150; scene.fog.far = inCrypt ? 110 : 620;
  hemi.intensity = inCrypt ? 0.35 : 1.3; sun.intensity = inCrypt ? 0.15 : 2.2;
  flashFx(hero.position, 0xa080ff, 3);
  save();
}

// ================= Ввод =================
const keys = {};
const cam = { yaw: Math.PI, pitch: 0.55, dist: 18 };
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let rmb = false, lastX = 0, lastY = 0;
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (!P) return;
  if (e.button === 2) { rmb = true; lastX = e.clientX; lastY = e.clientY; return; }
  if (e.button !== 0 || dead) return;
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const pickables = [...mobs.filter((m) => !m.dead && m.obj.visible && flatDist(m.obj.position, hero.position) < 120).map((m) => m.obj), ...npcs.map((n) => n.obj)];
  const hit = ray.intersectObjects(pickables, true)[0];
  if (hit) {
    const m = hit.object.userData.mob, n = hit.object.userData.npc;
    if (m) { if (target === m) { attacking = true; dest = null; } else { target = m; attacking = false; } }
    if (n) { target = npcs.find((x) => x.id === n.id); attacking = false; dest = null; talkTo = target; }
    return;
  }
  const g = ray.intersectObject(ground)[0];
  let p = g?.point;
  // катакомбы: пол — плоскость y=0
  if (hero.position.x > DUNGEON.x0 - 100) { const t = -ray.ray.origin.y / ray.ray.direction.y; if (t > 0) p = ray.ray.at(t, new THREE.Vector3()); }
  if (p) { dest = p.clone(); attacking = false; talkTo = null; pendingSkill = null; clickMark(p); }
});
addEventListener('pointerup', (e) => { if (e.button === 2) rmb = false; });
addEventListener('pointermove', (e) => {
  if (!rmb) return;
  cam.yaw -= (e.clientX - lastX) * 0.006; cam.pitch = THREE.MathUtils.clamp(cam.pitch + (e.clientY - lastY) * 0.005, 0.08, 1.35);
  lastX = e.clientX; lastY = e.clientY;
});
renderer.domElement.addEventListener('wheel', (e) => { e.preventDefault(); cam.dist = THREE.MathUtils.clamp(cam.dist * Math.exp(e.deltaY * 0.001), 5, 60); }, { passive: false });
addEventListener('keydown', (e) => {
  if (!P || e.target.tagName === 'INPUT') return;
  keys[e.code] = true;
  const map = { Digit1: 0, Digit2: 1, Digit3: 2 };
  if (e.code in map) useSkill(CLASSES[P.cls].skills[map[e.code]]);
  if (e.code === 'Digit4') useItem('potion_hp');
  if (e.code === 'Digit5') useItem('potion_mp');
  if (e.code === 'KeyI') toggle('inv');
  if (e.code === 'KeyM') toggle('bigmap');
  if (e.code === 'Tab') { e.preventDefault(); nextTarget(); }
  if (e.code === 'KeyF' && target?.def) { attacking = true; dest = null; }
  if (e.code === 'Escape') { for (const id of ['inv', 'shop', 'tp', 'bigmap']) $(id).hidden = true; target = null; attacking = false; }
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
function nextTarget() {
  const list = mobs.filter((m) => !m.dead && flatDist(m.obj.position, hero.position) < 40).sort((a, b) => flatDist(a.obj.position, hero.position) - flatDist(b.obj.position, hero.position));
  if (!list.length) return;
  const i = list.indexOf(target); target = list[(i + 1) % list.length]; attacking = false;
}
let talkTo = null;
const marker = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.8, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x80ffb0, transparent: true }));
scene.add(marker); marker.visible = false;
function clickMark(p) { marker.position.copy(p).add(new THREE.Vector3(0, 0.2, 0)); marker.visible = true; marker.material.opacity = 1; }
const selRing = new THREE.Mesh(new THREE.RingGeometry(1, 1.2, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff5050, transparent: true, opacity: 0.8 }));
scene.add(selRing);

// ================= Движение =================
function moveEntity(pos, dir, dist, radius) {
  pos.x += dir.x * dist; pos.z += dir.z * dist;
  for (const o of obstacles) {
    const dx = pos.x - o.x, dz = pos.z - o.z, d = Math.hypot(dx, dz), min = o.r + radius;
    if (d < min && d > 1e-4) { pos.x = o.x + dx / d * min; pos.z = o.z + dz / d * min; }
  }
  const lim = MAP / 2 - 20;
  if (pos.x < DUNGEON.x0 - 100) { pos.x = THREE.MathUtils.clamp(pos.x, -lim, lim); pos.z = THREE.MathUtils.clamp(pos.z, -lim, lim); }
  pos.y = heightAt(pos.x, pos.z);
}
const tmp = new THREE.Vector3();
function updateHero(dt) {
  const s = stats();
  heroSt.moving = false;
  heroSt.attackT = Math.max(0, heroSt.attackT - dt * 3);
  if (dead) return;
  // регенерация (в городе быстрее)
  const reg = inTown() ? 4 : 1;
  P.hp = Math.min(s.maxHp, P.hp + s.maxHp * 0.006 * reg * dt);
  P.mp = Math.min(s.maxMp, P.mp + s.maxMp * 0.012 * reg * dt);
  // каст
  if (cast) {
    cast.t -= dt;
    if (cast.t <= 0) {
      const c = cast; cast = null; heroSt.casting = false;
      if (c.id === 'escape') { const t = TOWNS.find((x) => x.id === P.home) || TOWNS[0]; teleportTo(t.x, t.z - 12); }
      else applySkill(c.id, c.target, s);
    }
    return;
  }
  // WASD — прямое управление относительно камеры
  const kx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0), kz = (keys.KeyS ? 1 : 0) - (keys.KeyW ? 1 : 0);
  if (kx || kz) {
    dest = null; attacking = false; talkTo = null;
    const f = new THREE.Vector3(Math.sin(cam.yaw + Math.PI), 0, Math.cos(cam.yaw + Math.PI)), r = new THREE.Vector3(-f.z, 0, f.x);
    const dir = f.multiplyScalar(-kz).add(r.multiplyScalar(kx)).normalize();
    moveEntity(hero.position, dir, s.speed * dt, 0.6); hero.rotation.y = Math.atan2(dir.x, dir.z); heroSt.moving = true;
  }
  // разговор с NPC
  if (talkTo) {
    const d = flatDist(hero.position, talkTo.obj.position);
    if (d > 3.5) { stepTo(talkTo.obj.position, s.speed, dt); }
    else { faceTo(talkTo.obj.position); openNpc(talkTo); talkTo = null; }
  }
  // атака цели
  if (attacking && target?.def) {
    if (target.dead) { attacking = false; }
    else {
      const d = flatDist(hero.position, target.obj.position);
      const skillRange = pendingSkill ? SKILLS[pendingSkill].range : s.range;
      if (d > skillRange + target.radius) stepTo(target.obj.position, s.speed, dt);
      else {
        faceTo(target.obj.position);
        if (pendingSkill) { const id = pendingSkill; pendingSkill = null; useSkill(id); }
        else if (inTown()) { attacking = false; log('В городе сражаться нельзя', 'bad'); }
        else {
          atkTimer -= dt;
          if (atkTimer <= 0) {
            atkTimer = 1 / s.aspd;
            if (P.cls === 'mage') { const r = calcDmg(s.matk * 0.6, target.def.pdef, 1, s.crit); const tg = target; boltFx(hero.position, tg, 0x80a0ff, () => hitMob(tg, r.d, r.crit)); heroSt.attackT = 1; }
            else { const r = calcDmg(s.patk, target.def.pdef, 1, s.crit); heroSt.attackT = 1; hitMob(target, r.d, r.crit); }
          }
        }
      }
    }
  } else if (dest) {
    if (flatDist(hero.position, dest) < 0.6) dest = null;
    else stepTo(dest, s.speed, dt);
  }
  // входы в катакомбы
  if (flatDist(hero.position, cryptDoor) < 2.2) { teleportTo(dungeonExit.x + 6, dungeonExit.z + 6); log('Вы спустились в катакомбы. Здесь нежить нападает первой.', 'bad'); }
  if (hero.position.x > DUNGEON.x0 - 100 && flatDist(hero.position, dungeonExit) < 2) { teleportTo(cryptDoor.x, cryptDoor.z + 5); log('Вы выбрались на поверхность.'); }
}
function stepTo(p, speed, dt) {
  const dir = tmp.set(p.x - hero.position.x, 0, p.z - hero.position.z);
  const L = dir.length(); if (L < 0.01) return;
  dir.divideScalar(L);
  moveEntity(hero.position, dir, Math.min(L, speed * dt), 0.6);
  hero.rotation.y = Math.atan2(dir.x, dir.z); heroSt.moving = true;
}

function updateMobs(dt, t) {
  const now = performance.now();
  for (const m of mobs) {
    const pos = m.obj.position;
    const near = flatDist(pos, hero.position) < 160;
    if (m.dead) {
      if (now > m.respawnAt) { m.dead = false; m.hp = m.def.hp; m.state = 'idle'; pos.set(m.home.x, heightAt(m.home.x, m.home.z), m.home.z); m.obj.rotation.z = 0; m.obj.visible = true; }
      continue;
    }
    m.obj.visible = near || m.def.boss;
    if (!near) continue; // далёких не симулируем
    m.st.moving = false; m.st.attackT = Math.max(0, m.st.attackT - dt * 3);
    const dHero = flatDist(pos, hero.position);
    const speed = 12 * (m.def.boss ? 0.8 : 1);
    if (m.state === 'idle' || m.state === 'wander') {
      if (m.def.aggro && !dead && dHero < 14 && !inTown()) { m.state = 'chase'; m.target = 'hero'; }
      m.wanderT -= dt;
      if (m.wanderT <= 0) { m.wanderT = rand(4, 10); m.dest = m.home.clone().add(new THREE.Vector3(rand(-12, 12), 0, rand(-12, 12))); m.state = 'wander'; }
      if (m.state === 'wander' && m.dest) {
        const dir = tmp.set(m.dest.x - pos.x, 0, m.dest.z - pos.z); const L = dir.length();
        if (L < 0.5) { m.state = 'idle'; m.dest = null; } else { dir.divideScalar(L); moveEntity(pos, dir, Math.min(L, speed * 0.35 * dt), m.radius); m.obj.rotation.y = Math.atan2(dir.x, dir.z); m.st.moving = true; }
      }
    } else if (m.state === 'chase') {
      if (dead || flatDist(pos, m.home) > 60 || inTown()) { m.state = 'return'; m.target = null; }
      else {
        const reach = 2 + m.radius;
        if (dHero > reach) { const dir = tmp.set(hero.position.x - pos.x, 0, hero.position.z - pos.z).normalize(); moveEntity(pos, dir, speed * dt, m.radius); m.obj.rotation.y = Math.atan2(dir.x, dir.z); m.st.moving = true; }
        else {
          m.obj.rotation.y = Math.atan2(hero.position.x - pos.x, hero.position.z - pos.z);
          m.atkCd -= dt;
          if (m.atkCd <= 0) { m.atkCd = m.def.boss ? 1.4 : 1.8; m.st.attackT = 1; heroHit(m); }
        }
        // бой сам по себе делает героя «в бою»: если цели нет — берём атакующего
        if (!target && !dead) target = m;
      }
    } else if (m.state === 'return') {
      const dir = tmp.set(m.home.x - pos.x, 0, m.home.z - pos.z); const L = dir.length();
      m.hp = Math.min(m.def.hp, m.hp + m.def.hp * 0.3 * dt);
      if (L < 1) m.state = 'idle'; else { dir.divideScalar(L); moveEntity(pos, dir, speed * 1.4 * dt, m.radius); m.obj.rotation.y = Math.atan2(dir.x, dir.z); m.st.moving = true; }
    }
    m.obj.userData.anim(t, m.st);
  }
}

// ================= Экран → подписи =================
const _v = new THREE.Vector3();
function toScreen(p) {
  _v.copy(p).project(camera);
  return { x: (_v.x * 0.5 + 0.5) * innerWidth, y: (-_v.y * 0.5 + 0.5) * innerHeight, vis: _v.z < 1 && Math.abs(_v.x) < 1.1 && Math.abs(_v.y) < 1.1 };
}
const labelPool = [];
function updateLabels() {
  const list = [];
  for (const m of mobs) if (!m.dead && m.obj.visible) { const d = flatDist(m.obj.position, hero.position); if (d < 45) list.push({ d, m }); }
  list.sort((a, b) => a.d - b.d);
  const shown = list.slice(0, MOB_LABEL_MAX).map((x) => ({ pos: x.m.obj.position, h: 2.6 * (x.m.def.size || 1) + 0.6, text: `${x.m.def.name} ${x.m.def.lvl}`, color: levelColor(x.m.def.lvl), sel: x.m === target }));
  for (const n of npcs) if (flatDist(n.obj.position, hero.position) < 45) shown.push({ pos: n.obj.position, h: 2.9, text: n.name, color: '#a0e0ff', sel: n === target });
  shown.push({ pos: hero.position, h: 2.9, text: P.name, color: '#ffffff' });
  for (let i = 0; i < Math.max(shown.length, labelPool.length); i++) {
    let el = labelPool[i];
    if (!el) { el = document.createElement('div'); el.className = 'nlabel'; $('labels').append(el); labelPool.push(el); }
    const s = shown[i];
    if (!s) { el.style.display = 'none'; continue; }
    const p = toScreen(_v.copy(s.pos).setY(s.pos.y + s.h));
    if (!p.vis) { el.style.display = 'none'; continue; }
    el.style.display = '';
    if (el._t !== s.text) { el._t = s.text; el.textContent = s.text; }
    el.style.color = s.color; el.classList.toggle('sel', !!s.sel);
    el.style.transform = `translate(${p.x | 0}px,${p.y | 0}px) translate(-50%,-100%)`;
  }
}

// ================= Интерфейс =================
const bar = (id, v, max, text) => { $(id).firstElementChild.style.width = `${Math.max(0, Math.min(100, (v / max) * 100))}%`; $(id).lastElementChild.textContent = text ?? `${Math.round(v)} / ${Math.round(max)}`; };
function renderHud() {
  const s = stats();
  $('pname').textContent = `${P.name} · ${CLASSES[P.cls].name}`;
  $('plvl').textContent = P.lvl;
  bar('hpbar', P.hp, s.maxHp); bar('mpbar', P.mp, s.maxMp);
  const need = xpToNext(P.lvl); bar('xpbar', P.xp, need, P.lvl >= MAX_LEVEL ? 'максимум' : `${((P.xp / need) * 100).toFixed(1)}%`);
  $('coins').textContent = P.coins.toLocaleString('ru');
  const z = zoneAt(hero.position.x, hero.position.z);
  $('zone').textContent = `${z.name} · ${z.lv}`;
  if (target) {
    $('target').hidden = false;
    if (target.def) { $('tname').textContent = `${target.def.name}`; $('tname').style.color = levelColor(target.def.lvl); $('tlvl').textContent = `ур. ${target.def.lvl}${target.def.aggro ? ' · агрессивный' : ''}`; bar('tbar', target.hp, target.def.hp, `${Math.round((target.hp / target.def.hp) * 100)}%`); $('tbar').hidden = false; }
    else { $('tname').textContent = target.name; $('tname').style.color = '#a0e0ff'; $('tlvl').textContent = 'NPC'; $('tbar').hidden = true; }
  } else $('target').hidden = true;
  $('stats').textContent = `Физ. атака ${Math.round(s.patk)} · Маг. атака ${Math.round(s.matk)} · Физ. защ. ${Math.round(s.pdef)} · Маг. защ. ${Math.round(s.mdef)}`;
  // кулдауны
  const now = performance.now();
  for (const el of document.querySelectorAll('#skills .slot[data-skill]')) {
    const id = el.dataset.skill, left = Math.max(0, (cds[id] || 0) - now) / 1000;
    el.querySelector('.cd').style.height = `${(left / SKILLS[id].cd) * 100}%`;
    el.classList.toggle('locked', P.lvl < SKILLS[id].lvl);
  }
  for (const el of document.querySelectorAll('#skills .slot[data-item]')) el.querySelector('.n').textContent = invCount(el.dataset.item);
  $('castbar').hidden = !cast;
  if (cast) { const total = cast.id === 'escape' ? 3 : SKILLS[cast.id].cast; $('castbar').firstElementChild.style.width = `${(1 - cast.t / total) * 100}%`; $('castbar').lastElementChild.textContent = cast.id === 'escape' ? 'Свиток возврата' : SKILLS[cast.id].name; }
  $('buffs').innerHTML = buffs.filter((b) => b.until > now).map((b) => `<span>${b.name} ${Math.ceil((b.until - now) / 1000)}с</span>`).join('');
}
function renderSkills() {
  const c = CLASSES[P.cls];
  $('skills').innerHTML = c.skills.map((id, i) => `<div class="slot" data-skill="${id}" title="${SKILLS[id].name} · мана ${SKILLS[id].mp} · перезарядка ${SKILLS[id].cd} с · с ${SKILLS[id].lvl} ур."><i style="background:#${SKILLS[id].color.toString(16).padStart(6, '0')}"></i><b>${i + 1}</b><small>${SKILLS[id].name}</small><div class="cd"></div></div>`).join('')
    + ['potion_hp', 'potion_mp'].map((id, i) => `<div class="slot" data-item="${id}" title="${ITEMS[id].name}"><i style="background:#${ITEMS[id].color.toString(16).padStart(6, '0')};border-radius:50%"></i><b>${i + 4}</b><small>${ITEMS[id].name}</small><span class="n"></span></div>`).join('');
}
$('skills').addEventListener('click', (e) => {
  const s = e.target.closest('.slot'); if (!s) return;
  if (s.dataset.skill) useSkill(s.dataset.skill); else useItem(s.dataset.item);
});
const itemDesc = (it) => [it.patk && `физ. атака ${it.patk}`, it.matk && `маг. атака ${it.matk}`, it.pdef && `физ. защ. ${it.pdef}`, it.mdef && `маг. защ. ${it.mdef}`, it.lvl && `с ${it.lvl} ур.`, it.grade && `грейд ${GRADES[it.grade]}`].filter(Boolean).join(' · ');
const sw = (c) => `<i class="sw" style="background:#${c.toString(16).padStart(6, '0')}"></i>`;
function renderInv() {
  if (!P) return;
  $('inv-eq').innerHTML = ['weapon', 'armor'].map((sl) => { const it = ITEMS[P.equip[sl]]; return `<div class="row">${sw(it.color)}<div><b>${it.name}</b><small>${itemDesc(it)}</small></div></div>`; }).join('');
  $('inv-list').innerHTML = P.inv.map((e) => { const it = ITEMS[e.id]; return `<div class="row ${it.rare ? 'rare' : ''}">${sw(it.color)}<div><b>${it.name}${e.n > 1 ? ` ×${e.n}` : ''}</b><small>${itemDesc(it) || (it.loot ? 'трофей — продать торговцу' : '')}</small></div>${it.slot || it.use ? `<button data-use="${e.id}">${it.slot ? 'Надеть' : 'Исп.'}</button>` : ''}</div>`; }).join('') || '<small>пусто</small>';
  $('inv-coins').textContent = `${P.coins.toLocaleString('ru')} монет`;
}
$('inv').addEventListener('click', (e) => { const b = e.target.closest('[data-use]'); if (b) useItem(b.dataset.use); });
function toggle(id) { $(id).hidden = !$(id).hidden; if (id === 'inv') renderInv(); if (id === 'bigmap') drawMap($('bigmap-cv'), 1); }
for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => { b.closest('.win').hidden = true; });
for (const b of document.querySelectorAll('[data-open]')) b.addEventListener('click', () => toggle(b.dataset.open));

function openNpc(n) {
  if (n.role === 'merchant') { renderShop('buy'); $('shop').hidden = false; }
  if (n.role === 'gatekeeper') {
    P.home = n.town; // точка возрождения — последний посещённый город
    $('tp-list').innerHTML = TELEPORTS.map((t) => `<button data-tp="${t.id}" ${P.coins < t.cost ? 'disabled' : ''}><b>${t.name}</b><span>${t.cost ? `${t.cost} мон.` : 'бесплатно'}</span></button>`).join('');
    $('tp').hidden = false;
  }
}
$('tp').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tp]'); if (!b) return;
  const t = TELEPORTS.find((x) => x.id === b.dataset.tp);
  if (P.coins < t.cost) return;
  P.coins -= t.cost; $('tp').hidden = true;
  teleportTo(t.x, t.z); log(`Телепорт: ${t.name}`);
});
let shopTab = 'buy';
function renderShop(tab = shopTab) {
  shopTab = tab;
  for (const b of document.querySelectorAll('#shop [data-tab]')) b.classList.toggle('on', b.dataset.tab === tab);
  if (tab === 'buy') $('shop-list').innerHTML = SHOP.map((id) => { const it = ITEMS[id]; return `<div class="row">${sw(it.color)}<div><b>${it.name}</b><small>${itemDesc(it)}</small></div><button data-buy="${id}" ${P.coins < it.price ? 'disabled' : ''}>${it.price} мон.</button></div>`; }).join('');
  else $('shop-list').innerHTML = P.inv.filter((e) => ITEMS[e.id].price || ITEMS[e.id].rare).map((e) => { const it = ITEMS[e.id], pr = Math.round((it.price || 4000) * (it.loot ? 1 : 0.4)); return `<div class="row">${sw(it.color)}<div><b>${it.name}${e.n > 1 ? ` ×${e.n}` : ''}</b></div><button data-sell="${e.id}">+${pr}</button>${e.n > 1 ? `<button data-sellall="${e.id}">все</button>` : ''}</div>`; }).join('') || '<small>нечего продать</small>';
  $('shop-coins').textContent = `${P.coins.toLocaleString('ru')} монет`;
}
$('shop').addEventListener('click', (e) => {
  const t = e.target.closest('[data-tab]'); if (t) return renderShop(t.dataset.tab);
  const b = e.target.closest('[data-buy]');
  if (b) { const it = ITEMS[b.dataset.buy]; if (P.coins >= it.price) { P.coins -= it.price; addItem(b.dataset.buy); log(`Куплено: ${it.name}`, 'good'); } }
  const s = e.target.closest('[data-sell],[data-sellall]');
  if (s) {
    const id = s.dataset.sell || s.dataset.sellall, it = ITEMS[id], pr = Math.round((it.price || 4000) * (it.loot ? 1 : 0.4));
    const n = s.dataset.sellall ? invCount(id) : 1;
    if (takeItem(id, n)) { P.coins += pr * n; log(`Продано: ${it.name} ×${n} (+${pr * n})`); }
  }
  renderShop(); renderInv(); save();
});
$('respawn').onclick = respawn;

// ================= Карта =================
function drawMap(cv, big) {
  const x = cv.getContext('2d'), W = cv.width, H = cv.height;
  const inCrypt = hero.position.x > DUNGEON.x0 - 100;
  x.fillStyle = '#10141a'; x.fillRect(0, 0, W, H);
  if (inCrypt) {
    const size = DUNGEON.cell * DUNGEON.n, k = W / size;
    x.fillStyle = '#2a2628'; x.fillRect(0, 0, W, H);
    for (const m of mobs) if (!m.dead && m.home.x > DUNGEON.x0 - 100) { x.fillStyle = m.def.boss ? '#c060ff' : '#c04040'; x.fillRect((m.obj.position.x - DUNGEON.x0) * k - 2, (m.obj.position.z - DUNGEON.z0) * k - 2, 4, 4); }
    x.fillStyle = '#9a70ff'; x.fillRect((dungeonExit.x - DUNGEON.x0) * k - 3, (dungeonExit.z - DUNGEON.z0) * k - 3, 6, 6);
    x.fillStyle = '#fff'; x.beginPath(); x.arc((hero.position.x - DUNGEON.x0) * k, (hero.position.z - DUNGEON.z0) * k, 4, 0, 7); x.fill();
    return;
  }
  const scale = big ? W / MAP : W / 300; // мини-карта — окрестность 300 м
  const cx = big ? 0 : hero.position.x, cz = big ? 0 : hero.position.z;
  const P2 = (px, pz) => [(px - cx) * scale + W / 2, (pz - cz) * scale + H / 2];
  for (const z of ZONES) { const [a, b] = P2(z.x, z.z); x.fillStyle = `rgba(${z.ground.map((v) => (v * 255) | 0).join(',')},0.7)`; x.beginPath(); x.arc(a, b, z.r * scale, 0, 7); x.fill(); }
  for (const t of TOWNS) { const [a, b] = P2(t.x, t.z); x.fillStyle = '#d8cfb8'; x.beginPath(); x.arc(a, b, t.r * scale, 0, 7); x.fill(); if (big) { x.fillStyle = '#fff'; x.font = '12px sans-serif'; x.textAlign = 'center'; x.fillText(t.name, a, b - t.r * scale - 6); } }
  if (big) for (const z of ZONES) { const [a, b] = P2(z.x, z.z); x.fillStyle = '#fff'; x.font = '12px sans-serif'; x.textAlign = 'center'; x.fillText(`${z.name} (${z.lv})`, a, b); }
  { const [a, b] = P2(CRYPT.x, CRYPT.z); x.fillStyle = '#9a70ff'; x.fillRect(a - 3, b - 3, 6, 6); if (big) { x.fillStyle = '#c0a0ff'; x.fillText('Склеп', a, b - 8); } }
  if (!big) for (const m of mobs) if (!m.dead && m.obj.visible) { const [a, b] = P2(m.obj.position.x, m.obj.position.z); x.fillStyle = m.def.aggro ? '#ff5050' : '#ffc060'; x.fillRect(a - 1.5, b - 1.5, 3, 3); }
  for (const n of npcs) { const [a, b] = P2(n.x, n.z); x.fillStyle = '#80d0ff'; x.fillRect(a - 2, b - 2, 4, 4); }
  const [a, b] = P2(hero.position.x, hero.position.z);
  x.save(); x.translate(a, b); x.rotate(-hero.rotation.y + Math.PI);
  x.fillStyle = '#fff'; x.beginPath(); x.moveTo(0, -6); x.lineTo(4, 5); x.lineTo(-4, 5); x.fill(); x.restore();
}

// ================= Цикл =================
const clock = new THREE.Clock();
let frame = 0;
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  if (!P) { renderer.render(scene, camera); cam.yaw += dt * 0.05; placeCamera(new THREE.Vector3(TOWNS[0].x, 10, TOWNS[0].z), 60); return; }
  frame++;
  updateHero(dt);
  updateMobs(dt, t);
  hero.userData.anim(t, heroSt);
  updateFx(dt);
  marker.material.opacity = Math.max(0, marker.material.opacity - dt * 1.5); marker.visible = marker.material.opacity > 0;
  selRing.visible = !!target && (!target.def || !target.dead);
  if (selRing.visible) { const o = target.obj.position; selRing.position.set(o.x, o.y + 0.15, o.z); selRing.scale.setScalar(target.radius || 1); selRing.material.color.set(target.def ? 0xff5050 : 0x60c0ff); }
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('banner').style.opacity = '0'; }
  placeCamera(hero.position, cam.dist);
  sun.position.copy(hero.position).add(new THREE.Vector3(60, 110, 40)); sun.target.position.copy(hero.position);
  updateLabels();
  if (frame % 6 === 0) { renderHud(); drawMap($('minimap'), 0); }
  if (frame % 30 === 0 && !$('bigmap').hidden) drawMap($('bigmap-cv'), 1);
  renderer.render(scene, camera);
}
function placeCamera(p, dist) {
  const off = new THREE.Vector3(Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch)).multiplyScalar(dist);
  camera.position.copy(p).add(off).add(new THREE.Vector3(0, 2, 0));
  // камера не уходит под землю
  const gh = camera.position.x > DUNGEON.x0 - 100 ? 0.5 : heightAt(camera.position.x, camera.position.z) + 1;
  if (camera.position.y < gh) camera.position.y = gh;
  camera.lookAt(p.x, p.y + 1.8, p.z);
}
loop();

// ================= Старт =================
function start(p) {
  P = p;
  $('start').remove();
  document.body.classList.add('ingame');
  spawnHero();
  teleportTo(P.x, P.z);
  renderSkills(); renderInv();
  log(`Добро пожаловать, ${P.name}! ЛКМ — идти/выбрать цель (второй клик — атака), ПКМ — камера, 1–3 — умения, 4–5 — зелья, Tab — цель, I — инвентарь, M — карта.`);
  log('Поговорите с Хранителем врат, чтобы перенестись в зону охоты, и с Торговцем — за снаряжением.');
}
const saved = loadSave();
if (saved) { $('start-cont').hidden = false; $('start-cont').textContent = `Продолжить: ${saved.name} (${CLASSES[saved.cls].name}, ${saved.lvl} ур.)`; $('start-cont').onclick = () => start(saved); }
let pickCls = 'warrior';
for (const b of document.querySelectorAll('[data-cls]')) b.addEventListener('click', () => { pickCls = b.dataset.cls; for (const x of document.querySelectorAll('[data-cls]')) x.classList.toggle('on', x === b); });
$('start-new').onclick = () => {
  const name = $('cname').value.trim() || 'Странник';
  if (saved && !confirm('Начать заново? Текущий персонаж будет удалён.')) return;
  start(newChar(name.slice(0, 16), pickCls));
};
// хук для автотестов: dev-сервер или ?test
if (import.meta.env.DEV || location.search.includes('test')) window.__g = { get P() { return P; }, mobs, get hero() { return hero; }, teleportTo, gainXp, useSkill, useItem, openNpc, npcs, respawn, get dead() { return dead; }, get target() { return target; }, set target(v) { target = v; }, attack() { attacking = true; } };
