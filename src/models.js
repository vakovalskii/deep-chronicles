// Процедурные модели: персонаж, мобы, NPC. У каждой модели userData.anim(t, state) — простая анимация.
import * as THREE from 'three';

const lam = (color, o = {}) => new THREE.MeshLambertMaterial({ color, ...o });
const part = (geo, m, x = 0, y = 0, z = 0) => { const p = new THREE.Mesh(geo, m); p.position.set(x, y, z); p.castShadow = true; return p; };
const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sph: new THREE.SphereGeometry(0.5, 12, 8),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 10),
  cone: new THREE.ConeGeometry(0.5, 1, 8),
  caps: new THREE.CapsuleGeometry(0.35, 0.8, 4, 8),
};
const skin = lam(0xe0b090);

// гуманоид: тело, голова, руки (правая — с оружием), ноги
function humanoid(color, { robe = false, scale = 1, weaponColor = 0xa0a0a0, staff = false, skull = false } = {}) {
  const g = new THREE.Group();
  const body = lam(color);
  const torso = part(robe ? G.cone : G.box, body, 0, robe ? 1.05 : 1.25, 0);
  if (robe) torso.scale.set(1.1, 1.5, 1.1); else torso.scale.set(0.8, 0.9, 0.45);
  const head = part(G.sph, skull ? lam(0xeeeadc) : skin, 0, 2.0, 0); head.scale.setScalar(0.55);
  const legL = new THREE.Group(), legR = new THREE.Group();
  legL.position.set(-0.2, 0.8, 0); legR.position.set(0.2, 0.8, 0);
  if (!robe) {
    const lm = lam(0x3a3028);
    const l1 = part(G.box, lm, 0, -0.4, 0); l1.scale.set(0.28, 0.8, 0.3); legL.add(l1);
    const l2 = part(G.box, lm, 0, -0.4, 0); l2.scale.set(0.28, 0.8, 0.3); legR.add(l2);
  }
  const armL = new THREE.Group(), armR = new THREE.Group();
  armL.position.set(-0.55, 1.6, 0); armR.position.set(0.55, 1.6, 0);
  const a1 = part(G.box, body, 0, -0.35, 0); a1.scale.set(0.22, 0.75, 0.22); armL.add(a1);
  const a2 = part(G.box, body, 0, -0.35, 0); a2.scale.set(0.22, 0.75, 0.22); armR.add(a2);
  // оружие
  const weapon = new THREE.Group(); weapon.position.set(0, -0.72, 0.1); armR.add(weapon);
  const setWeapon = (wc, isStaff) => {
    weapon.clear();
    if (wc === null) return;
    const wm = lam(wc, { emissive: wc, emissiveIntensity: 0.15 });
    if (isStaff) { const s = part(G.cyl, lam(0x5a3a1a), 0, 0, 0.5); s.scale.set(0.08, 2.2, 0.08); s.rotation.x = Math.PI / 2; weapon.add(s); const orb = part(G.sph, wm, 0, 0, 1.6); orb.scale.setScalar(0.3); weapon.add(orb); }
    else { const b = part(G.box, wm, 0, 0, 0.75); b.scale.set(0.08, 0.05, 1.4); weapon.add(b); const h = part(G.box, lam(0x4a3a2a), 0, 0, 0); h.scale.set(0.35, 0.08, 0.08); weapon.add(h); }
  };
  setWeapon(weaponColor, staff);
  g.add(torso, head, legL, legR, armL, armR);
  g.scale.setScalar(scale);
  g.userData.setWeapon = setWeapon;
  g.userData.setBody = (c) => { body.color.setHex(c); };
  g.userData.anim = (t, st) => {
    const walk = st.moving ? Math.sin(t * 9) : 0;
    legL.rotation.x = walk * 0.6; legR.rotation.x = -walk * 0.6;
    armL.rotation.x = -walk * 0.5;
    if (st.attackT > 0) armR.rotation.x = -2.2 * Math.sin(Math.min(1, st.attackT) * Math.PI);
    else if (st.casting) armR.rotation.x = -1.4 + Math.sin(t * 10) * 0.1;
    else armR.rotation.x = walk * 0.5;
    torso.position.y = (robe ? 1.05 : 1.25) + Math.abs(walk) * 0.05;
  };
  return g;
}

function beast(color, size) {
  const g = new THREE.Group(), m = lam(color);
  const body = part(G.box, m, 0, 0.7, 0); body.scale.set(0.7, 0.6, 1.4);
  const head = part(G.box, m, 0, 0.95, 0.85); head.scale.set(0.5, 0.45, 0.6);
  const legs = [];
  for (const [x, z] of [[-0.25, 0.5], [0.25, 0.5], [-0.25, -0.5], [0.25, -0.5]]) { const l = new THREE.Group(); l.position.set(x, 0.45, z); const p = part(G.box, m, 0, -0.22, 0); p.scale.set(0.15, 0.45, 0.15); l.add(p); legs.push(l); g.add(l); }
  const eyes = part(G.box, lam(0xff3020, { emissive: 0xff2010, emissiveIntensity: 0.6 }), 0, 1.02, 1.16); eyes.scale.set(0.35, 0.06, 0.02);
  g.add(body, head, eyes);
  g.scale.setScalar(size);
  g.userData.anim = (t, st) => { const w = st.moving ? Math.sin(t * 12) : 0; legs.forEach((l, i) => (l.rotation.x = w * (i % 2 ? 0.6 : -0.6))); head.rotation.x = st.attackT > 0 ? -0.5 * Math.sin(st.attackT * Math.PI) : 0; };
  return g;
}

function critter(color, size) {
  const g = new THREE.Group(), m = lam(color);
  const body = part(G.sph, m, 0, 0.35, 0); body.scale.set(0.6, 0.55, 0.8);
  const head = part(G.sph, m, 0, 0.55, 0.35); head.scale.setScalar(0.38);
  const e1 = part(G.box, m, -0.08, 0.85, 0.3); e1.scale.set(0.07, 0.35, 0.05);
  const e2 = part(G.box, m, 0.08, 0.85, 0.3); e2.scale.set(0.07, 0.35, 0.05);
  g.add(body, head, e1, e2); g.scale.setScalar(size);
  g.userData.anim = (t, st) => { g.children[0].position.y = 0.35 + (st.moving ? Math.abs(Math.sin(t * 14)) * 0.2 : 0); };
  return g;
}

function spider(color, size) {
  const g = new THREE.Group(), m = lam(color);
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
  const trunk = part(G.cyl, lam(0x4a3020), 0, 1.3, 0); trunk.scale.set(0.9, 2.6, 0.9);
  const crown = part(G.cone, lam(color), 0, 3.4, 0); crown.scale.set(2.2, 2.6, 2.2);
  const armL = part(G.box, lam(0x4a3020), -0.9, 1.8, 0); armL.scale.set(1.2, 0.2, 0.2);
  const armR = part(G.box, lam(0x4a3020), 0.9, 1.8, 0); armR.scale.set(1.2, 0.2, 0.2);
  const eyes = part(G.box, lam(0xffe060, { emissive: 0xffd040, emissiveIntensity: 0.8 }), 0, 2.1, 0.46); eyes.scale.set(0.5, 0.08, 0.02);
  g.add(trunk, crown, armL, armR, eyes); g.scale.setScalar(size * 0.8);
  g.userData.anim = (t, st) => { g.rotation.z = st.moving ? Math.sin(t * 5) * 0.06 : 0; armR.rotation.z = st.attackT > 0 ? Math.sin(st.attackT * Math.PI) : 0; };
  return g;
}

function golem(color, size) {
  const g = humanoid(color, { scale: size * 0.8, weaponColor: color });
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
    default: return humanoid(def.color, { scale: s, skull: def.color === 0xe0dcc8 || def.boss, robe: def.boss, staff: def.boss, weaponColor: def.boss ? 0xa050ff : 0x9a9a9a });
  }
}

export function buildHero(cls) {
  return humanoid(cls.color, { robe: cls === undefined ? false : cls.name === 'Маг', staff: cls.name === 'Маг', weaponColor: 0xa0a0a0 });
}

export function buildNpc(color) {
  const g = humanoid(color, { robe: true });
  g.userData.setWeapon(null); // NPC без оружия
  return g;
}
