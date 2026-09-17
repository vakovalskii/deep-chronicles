// Процедурные модели: персонаж, мобы, NPC. У каждой модели userData.anim(t, state) — простая анимация.
import * as THREE from 'three';
import { applyModel, MODEL_OF } from './glb.js';
import { TEX } from './tex.js';

const tx = (k) => (k && TEX[k] ? TEX[k]() : null);
const lam = (color, o = {}, kind) => new THREE.MeshLambertMaterial({ color, map: tx(kind), ...o });
const part = (geo, m, x = 0, y = 0, z = 0) => { const p = new THREE.Mesh(geo, m); p.position.set(x, y, z); p.castShadow = true; return p; };
const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sph: new THREE.SphereGeometry(0.5, 12, 8),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 10),
  cone: new THREE.ConeGeometry(0.5, 1, 8),
  caps: new THREE.CapsuleGeometry(0.35, 0.8, 4, 8),
};
const skin = lam(0xe0b090, {}, 'face');
const GOLD = new THREE.MeshLambertMaterial({ color: 0xe0b040, emissive: 0x402800 });
// конус мантии: радиус 0.55 внизу (y = 0.30), сужается на 0.55 за 1.5 м
const coneR = (y) => 0.55 * (1 - (y - 0.3) / 1.5) + 0.012;
const TRIM_GEO = [[0.3, 0.4], [0.47, 0.5]].map(([a, b]) => new THREE.CylinderGeometry(coneR(b), coneR(a), b - a, 8, 1, true).translate(0, (a + b) / 2, 0));
const setMap = (m, kind) => { const t = tx(kind); if (m.map !== t) { m.map = t; m.needsUpdate = true; } };

// гуманоид: тело, голова, руки (правая — с оружием), ноги; шлем, перчатки, сапоги, щит — по экипировке
function humanoid(color, { robe = false, scale = 1, weaponColor = 0xa0a0a0, staff = false, skull = false, bodyKind = 'cloth' } = {}) {
  const g = new THREE.Group();
  const body = lam(color, {}, robe ? 'robe' : bodyKind);
  const torso = part(G.box, body, 0, 1.25, 0);
  const setTorso = (r) => {
    torso.geometry = r ? G.cone : G.box;
    if (r) torso.scale.set(1.1, 1.5, 1.1); else torso.scale.set(0.8, 0.9, 0.45);
    torso.userData.sx = torso.scale.x; torso.position.y = r ? 1.05 : 1.25;
    torso.userData.y = r ? 1.05 : 1.25;
    legL.visible = legR.visible = !r;
    trim.visible = r;
  };
  // золотая кайма по низу мантии (повторяет конус)
  const trim = new THREE.Group();
  trim.add(part(TRIM_GEO[0], GOLD), part(TRIM_GEO[1], GOLD));
  const head = part(G.sph, skull ? lam(0xeeeadc, {}, 'bone') : skin.clone(), 0, 2.0, 0); head.scale.setScalar(0.55);
  const legL = new THREE.Group(), legR = new THREE.Group();
  legL.position.set(-0.2, 0.8, 0); legR.position.set(0.2, 0.8, 0);
  const legM = lam(0x3a3028, {}, 'cloth'), footM = lam(0x2a221c, {}, 'leather');
  for (const leg of [legL, legR]) {
    const l = part(G.box, legM, 0, -0.4, 0); l.scale.set(0.28, 0.8, 0.3); leg.add(l);
    const f = part(G.box, footM, 0, -0.76, 0.06); f.scale.set(0.3, 0.14, 0.42); leg.add(f);
  }
  const armL = new THREE.Group(), armR = new THREE.Group();
  armL.position.set(-0.55, 1.6, 0); armR.position.set(0.55, 1.6, 0);
  const handM = lam(0xe0b090);
  for (const arm of [armL, armR]) {
    const a = part(G.box, body, 0, -0.33, 0); a.scale.set(0.22, 0.66, 0.22); arm.add(a);
    const h = part(G.box, handM, 0, -0.7, 0); h.scale.set(0.2, 0.16, 0.2); arm.add(h);
  }
  // шлем / капюшон
  const helm = new THREE.Group(); helm.position.y = 2.0; helm.visible = false;
  const helmM = lam(0x808080, {}, 'plate');
  const cap = part(G.sph, helmM, 0, 0.06, 0); cap.scale.set(0.62, 0.5, 0.62);
  const brim = part(G.cyl, helmM, 0, -0.02, 0); brim.scale.set(0.66, 0.06, 0.66);
  const hat = part(G.cone, helmM, 0, 0.45, 0); hat.scale.set(0.6, 0.7, 0.6);
  helm.add(cap, brim, hat);
  // щит
  const shield = part(G.box, lam(0x808080, {}, 'plate'), -0.16, -0.45, 0.05); shield.scale.set(0.08, 0.75, 0.6); shield.visible = false;
  armL.add(shield);
  // оружие
  const weapon = new THREE.Group(); weapon.position.set(0, -0.72, 0.1); armR.add(weapon);
  const setWeapon = (wc, isStaff, ench = 0) => {
    weapon.clear();
    if (wc === null || wc === undefined) return;
    const glow = ench >= 4 ? Math.min(1.6, 0.4 + (ench - 4) * 0.15) : 0.15;
    const wm = lam(wc, { emissive: ench >= 4 ? 0xffffff : wc, emissiveIntensity: ench >= 4 ? glow * 0.35 : 0.15 });
    let blade;
    if (isStaff) { const st = part(G.cyl, lam(0x5a3a1a, {}, 'bark'), 0, 0, 0.5); st.scale.set(0.08, 2.2, 0.08); st.rotation.x = Math.PI / 2; weapon.add(st); blade = part(G.sph, wm, 0, 0, 1.6); blade.scale.setScalar(0.3); }
    else { blade = part(G.box, wm, 0, 0, 0.75); blade.scale.set(0.08, 0.05, 1.4); const h = part(G.box, lam(0x4a3a2a), 0, 0, 0); h.scale.set(0.35, 0.08, 0.08); weapon.add(h); }
    weapon.add(blade);
    // заточка +7 и выше — светящийся ореол
    if (ench >= 7) {
      const aura = new THREE.Mesh(blade.geometry, new THREE.MeshBasicMaterial({ color: ench >= 12 ? 0xff60ff : ench >= 10 ? 0xffa030 : 0x60c0ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
      aura.position.copy(blade.position); aura.scale.copy(blade.scale).multiply(new THREE.Vector3(isStaff ? 1.6 : 3.2, isStaff ? 1.6 : 4, isStaff ? 1.6 : 1.08));
      aura.userData.aura = true; weapon.add(aura);
    }
  };
  setWeapon(weaponColor, staff);
  setTorso(robe);
  const upper = new THREE.Group();
  upper.add(torso, trim, head, helm, armL, armR);
  g.add(upper, legL, legR);
  g.scale.setScalar(scale);
  const off = Math.random() * 6.28;
  g.userData.setWeapon = setWeapon;
  g.userData.setBody = (c, r, kind) => { body.color.setHex(c); if (r !== undefined) setTorso(r); setMap(body, r ? 'robe' : kind || bodyKind); };
  g.userData.setGear = ({ head: hc, legs, gloves, feet, shield: sc, helmKind, shieldKind, legKind }) => {
    setMap(helmM, helmKind === 'apprentice' || helmKind === 'mystic' ? 'cloth' : helmKind === 'leather' ? 'leather' : 'plate');
    setMap(shield.material, shieldKind || 'plate');
    setMap(legM, legKind || 'cloth');
    setMap(handM, gloves != null ? (legKind === 'chain' || legKind === 'plate' ? 'plate' : 'leather') : null);
    helm.visible = hc !== undefined; if (hc !== undefined) helmM.color.setHex(hc);
    const soft = helmKind === 'apprentice' || helmKind === 'mystic';
    cap.visible = true; brim.visible = soft; hat.visible = soft;
    legM.color.setHex(legs ?? 0x3a3028);
    handM.color.setHex(gloves ?? 0xe0b090);
    footM.color.setHex(feet ?? 0x2a221c);
    shield.visible = sc !== undefined; if (sc !== undefined) shield.material.color.setHex(sc);
  };
  g.userData.anim = (t, st) => {
    const walk = st.moving ? Math.sin(t * 9 + off) : 0, idle = st.moving ? 0 : Math.sin(t * 1.8 + off);
    const hit = st.hitT || 0;
    legL.rotation.x = walk * 0.7; legR.rotation.x = -walk * 0.7;
    // дыхание, покачивание, наклон при беге и отдача при попадании
    upper.position.y = Math.abs(walk) * 0.07 + idle * 0.015;
    upper.rotation.x = (st.moving ? 0.1 : 0) - hit * 0.3;
    torso.scale.x = (torso.userData.sx || 1) * (1 + idle * 0.015);
    head.rotation.x = -hit * 0.3 + idle * 0.03;
    armL.rotation.set(-walk * 0.6, 0, -0.1 - idle * 0.03);
    armR.rotation.set(walk * 0.6, 0, 0.1 + idle * 0.03);
    upper.rotation.y = 0;
    if (st.attackT > 0) {
      // замах → удар с поворотом корпуса → возврат
      const k = 1 - Math.min(1, st.attackT);
      const ease = (x) => 1 - (1 - x) * (1 - x);
      if (k < 0.3) { const q = k / 0.3; armR.rotation.x = -2.7 * q; armR.rotation.z = 0.1 + 0.4 * q; upper.rotation.y = 0.45 * q; }
      else { const q = ease((k - 0.3) / 0.7); armR.rotation.x = -2.7 + 3.3 * q; armR.rotation.z = 0.5 - 0.5 * q; upper.rotation.y = 0.45 - 0.9 * q + 0.45 * Math.max(0, q - 0.7) / 0.3; }
      armL.rotation.x = -0.4;
    } else if (st.casting) {
      // обе руки вперёд-вверх, пульсация
      const w = Math.sin(t * 12) * 0.12;
      armR.rotation.set(-1.9 + w, 0, -0.35); armL.rotation.set(-1.9 - w, 0, 0.35);
      upper.rotation.x = -0.12;
    }
    for (const a of weapon.children) if (a.userData.aura) a.material.opacity = 0.25 + Math.sin(t * 4) * 0.1;
  };
  return g;
}

function beast(color, size) {
  const g = new THREE.Group(), m = lam(color, {}, 'fur');
  const body = part(G.box, m, 0, 0.7, 0); body.scale.set(0.7, 0.6, 1.4);
  const head = part(G.box, m, 0, 0.95, 0.85); head.scale.set(0.5, 0.45, 0.6);
  const legs = [];
  for (const [x, z] of [[-0.25, 0.5], [0.25, 0.5], [-0.25, -0.5], [0.25, -0.5]]) { const l = new THREE.Group(); l.position.set(x, 0.45, z); const p = part(G.box, m, 0, -0.22, 0); p.scale.set(0.15, 0.45, 0.15); l.add(p); legs.push(l); g.add(l); }
  const eyes = part(G.box, lam(0xff3020, { emissive: 0xff2010, emissiveIntensity: 0.6 }), 0, 1.02, 1.16); eyes.scale.set(0.35, 0.06, 0.02);
  g.add(body, head, eyes);
  g.scale.setScalar(size);
  const off = Math.random() * 6.28;
  g.userData.anim = (t, st) => {
    const w = st.moving ? Math.sin(t * 12 + off) : 0, a = st.attackT > 0 ? Math.sin(st.attackT * Math.PI) : 0;
    legs.forEach((l, i) => (l.rotation.x = w * (i === 0 || i === 3 ? 0.7 : -0.7)));
    head.rotation.x = -0.5 * a + Math.sin(t * 2 + off) * 0.04;
    body.position.z = a * 0.25; head.position.z = 0.85 + a * 0.35;
    body.position.y = 0.7 + Math.abs(w) * 0.05 + Math.sin(t * 2 + off) * 0.01;
    body.rotation.x = -(st.hitT || 0) * 0.3;
  };
  return g;
}

function critter(color, size) {
  const g = new THREE.Group(), m = lam(color, {}, 'fur');
  const body = part(G.sph, m, 0, 0.35, 0); body.scale.set(0.6, 0.55, 0.8);
  const head = part(G.sph, m, 0, 0.55, 0.35); head.scale.setScalar(0.38);
  const e1 = part(G.box, m, -0.08, 0.85, 0.3); e1.scale.set(0.07, 0.35, 0.05);
  const e2 = part(G.box, m, 0.08, 0.85, 0.3); e2.scale.set(0.07, 0.35, 0.05);
  g.add(body, head, e1, e2); g.scale.setScalar(size);
  g.userData.anim = (t, st) => { g.children[0].position.y = 0.35 + (st.moving ? Math.abs(Math.sin(t * 14)) * 0.2 : 0); };
  return g;
}

function spider(color, size) {
  const g = new THREE.Group(), m = lam(color, {}, 'fur');
  const body = part(G.sph, m, 0, 0.6, -0.3); body.scale.set(1.0, 0.7, 1.2);
  const head = part(G.sph, m, 0, 0.55, 0.45); head.scale.setScalar(0.5);
  g.add(body, head);
  const legs = [];
  for (let i = 0; i < 8; i++) {
    const side = i < 4 ? -1 : 1, k = i % 4;
    const l = new THREE.Group(); l.position.set(side * 0.3, 0.6, 0.3 - k * 0.3);
    const p = part(G.box, m, side * 0.55, -0.2, 0); p.scale.set(1.1, 0.07, 0.07); p.rotation.z = side * -0.5; l.add(p);
    legs.push(l); g.add(l);
  }
  g.scale.setScalar(size);
  g.userData.anim = (t, st) => { const w = st.moving ? Math.sin(t * 16) : 0; legs.forEach((l, i) => (l.rotation.y = w * (i % 2 ? 0.3 : -0.3))); };
  return g;
}

function tree(color, size) {
  const g = new THREE.Group();
  const trunk = part(G.cyl, lam(0x4a3020, {}, 'bark'), 0, 1.3, 0); trunk.scale.set(0.9, 2.6, 0.9);
  const crown = part(G.cone, lam(color, {}, 'leaves'), 0, 3.4, 0); crown.scale.set(2.2, 2.6, 2.2);
  const armL = part(G.box, lam(0x4a3020), -0.9, 1.8, 0); armL.scale.set(1.2, 0.2, 0.2);
  const armR = part(G.box, lam(0x4a3020), 0.9, 1.8, 0); armR.scale.set(1.2, 0.2, 0.2);
  const eyes = part(G.box, lam(0xffe060, { emissive: 0xffd040, emissiveIntensity: 0.8 }), 0, 2.1, 0.46); eyes.scale.set(0.5, 0.08, 0.02);
  g.add(trunk, crown, armL, armR, eyes); g.scale.setScalar(size * 0.8);
  g.userData.anim = (t, st) => { g.rotation.z = st.moving ? Math.sin(t * 5) * 0.06 : 0; armR.rotation.z = st.attackT > 0 ? Math.sin(st.attackT * Math.PI) : 0; };
  return g;
}

function golem(color, size) {
  const g = humanoid(color, { scale: size * 0.8, weaponColor: color, bodyKind: 'stone' });
  g.userData.setWeapon(0x6a5a4a, false);
  return g;
}

function ghost(color, size) {
  const g = new THREE.Group();
  const m = lam(color, { transparent: true, opacity: 0.55, emissive: color, emissiveIntensity: 0.5 });
  const body = part(G.cone, m, 0, 1.2, 0); body.scale.set(1.1, 2.2, 1.1); body.rotation.x = Math.PI;
  const head = part(G.sph, m, 0, 2.3, 0); head.scale.setScalar(0.8);
  const eyes = part(G.box, lam(0x000000), 0, 2.35, 0.36); eyes.scale.set(0.4, 0.08, 0.02);
  g.add(body, head, eyes); g.scale.setScalar(size * 0.8);
  g.userData.anim = (t) => { g.children[0].position.y = 1.2 + Math.sin(t * 2) * 0.2; head.position.y = 2.3 + Math.sin(t * 2) * 0.2; };
  return g;
}

export function buildMob(def) {
  const s = def.size || 1;
  switch (def.shape) {
    case 'critter': return critter(def.color, s);
    case 'beast': return beast(def.color, s);
    case 'spider': return spider(def.color, s);
    case 'tree': return tree(def.color, s);
    case 'golem': return golem(def.color, s);
    case 'ghost': return ghost(def.color, s);
    default: return humanoid(def.color, { scale: s, skull: def.color === 0xe0dcc8 || def.boss, robe: def.boss, staff: def.boss, weaponColor: def.boss ? 0xa050ff : 0x9a9a9a, bodyKind: def.color === 0xe0dcc8 ? 'bone' : 'leather' });
  }
}

export function buildHero(cls) {
  const g = humanoid(cls.color, { robe: cls === undefined ? false : cls.name === 'Маг', staff: cls.name === 'Маг', weaponColor: 0xa0a0a0 });
  // если для класса есть сгенерированная модель — подменим её, когда догрузится (иначе останется процедурная)
  if (MODEL_OF[cls?.name]) applyModel(g, MODEL_OF[cls.name]);
  return g;
}

export function buildNpc(color) {
  const g = humanoid(color, { robe: true });
  g.userData.setWeapon(null); // NPC без оружия
  return g;
}
