// Native art pass. Shared silhouettes and colliders remain compatible with the
// authoritative world; facade details and clothing are presentation only.
import * as T from 'three';
const material = (color, name = '', metalness = 0) => {
  const m = new T.MeshStandardMaterial({ color, roughness: 0.8 - metalness * 0.5, metalness }); m.name = name; return m;
};
const mesh = (parent, geo, mat, pos, scale = [1, 1, 1], rotation = [0, 0, 0]) => {
  const n = new T.Mesh(geo, mat); n.position.set(...pos); n.scale.set(...scale); n.rotation.set(...rotation); parent.add(n); return n;
};
const box = new T.BoxGeometry(1, 1, 1);
const orb = new T.SphereGeometry(0.5, 10, 7);
const cone = new T.ConeGeometry(0.5, 1, 8);
const cyl = new T.CylinderGeometry(0.5, 0.5, 1, 10);

export function enhanceHumanoid(g, kind = 'warrior') {
  if (!g.userData.hands) return g;
  const [upper, left, right] = g.children;
  const [torso, , head, , armL, armR] = upper.children;
  const skin = material(0xd2aa85), dark = material(0x28202b), hair = material(kind === 'npc' ? 0xc4b49a : 0x49392e);
  const steel = material(0x87999d, 'steel', 0.45), leather = material(0x654431, 'leather');
  const gold = material(0xb99b53, 'trim', 0.45);
  // Recognisable face rather than a featureless sphere.
  mesh(head, orb, skin, [-0.45, 0, 0], [0.18, 0.25, 0.18]);
  mesh(head, orb, skin, [0.45, 0, 0], [0.18, 0.25, 0.18]);
  mesh(head, box, dark, [-0.18, 0.08, 0.44], [0.11, 0.07, 0.035]);
  mesh(head, box, dark, [0.18, 0.08, 0.44], [0.11, 0.07, 0.035]);
  mesh(head, orb, skin, [0, -0.03, 0.48], [0.14, 0.19, 0.2]);
  mesh(head, orb, hair, [0, 0.21, -0.08], [1.04, 0.76, 0.94]);
  mesh(head, orb, hair, [-0.34, 0.02, -0.1], [0.33, 0.85, 0.85]);
  mesh(head, orb, hair, [0.34, 0.02, -0.1], [0.33, 0.85, 0.85]);
  if (kind !== 'mage' && kind !== 'npc') {
    torso.geometry = orb; torso.scale.set(1.03, 1.12, 0.66); torso.userData.sx = 1.03;
    mesh(upper, box, leather, [0, 0.87, 0.02], [0.79, 0.12, 0.47]);
    mesh(upper, box, gold, [0, 0.87, 0.27], [0.14, 0.16, 0.045]);
    mesh(upper, box, leather, [-0.37, 0.75, 0], [0.2, 0.3, 0.26], [0, 0, -0.1]);
    for (const side of [-1, 1]) {
      mesh(upper, box, torso.material, [side * 0.23, 0.76, 0.15], [0.31, 0.32, 0.32], [0.12, 0, side * -0.12]);
      mesh(upper, box, gold, [side * 0.23, 0.59, 0.18], [0.32, 0.055, 0.34]);
    }
    mesh(upper, cyl, steel, [0, 1.74, 0], [0.35, 0.14, 0.34]);
    for (const arm of [armL, armR]) {
      arm.children[0].geometry = cyl;
      mesh(arm, orb, steel, [0, -0.08, 0], [0.46, 0.32, 0.5]);
      mesh(arm, cyl, leather, [0, -0.51, 0], [0.26, 0.18, 0.25]);
    }
    for (const leg of [left, right]) {
      leg.children[0].geometry = cyl; leg.children[1].geometry = orb; leg.children[1].scale.set(0.35, 0.25, 0.52);
      mesh(leg, orb, steel, [0, -0.36, 0.13], [0.26, 0.27, 0.18]);
      mesh(leg, cyl, leather, [0, -0.62, 0], [0.32, 0.29, 0.31]);
    }
  } else {
    mesh(upper, box, leather, [0, 1.16, 0.17], [0.7, 0.095, 0.4]);
    mesh(upper, orb, gold, [0, 1.16, 0.4], [0.13, 0.13, 0.08]);
    mesh(upper, cone, gold, [0, 1.55, 0.23], [0.28, 0.35, 0.07], [0, 0, Math.PI]);
  }
  // A tapered blade with a readable hilt.
  if (kind === 'warrior') {
    const w = g.userData.hands.weapon; w.clear();
    mesh(w, cyl, leather, [0, 0, 0.14], [0.09, 0.3, 0.09], [Math.PI / 2, 0, 0]);
    mesh(w, box, gold, [0, 0, 0.31], [0.36, 0.09, 0.08]);
    mesh(w, box, steel, [0, 0, 0.83], [0.12, 0.045, 1]);
    mesh(w, cone, steel, [0, 0, 1.45], [0.12, 0.28, 0.05], [Math.PI / 2, 0, 0]);
    mesh(w, orb, gold, [0, 0, -0.05], [0.14, 0.11, 0.12]);
  }
  return g;
}

export function enhanceMob(g, id, def) {
  const hide = material(def.color, 'fur'), horn = material(0xe5d8b4), dark = material(0x20202a), red = material(0xbe5540);
  if (def.shape === 'beast') {
    // First four children are animated legs; body/head follow them.
    const body = g.children[4], head = g.children[5];
    if (body?.isMesh) { body.geometry = orb; body.scale.set(0.95, 0.95, 1.65); body.material = hide; }
    if (head?.isMesh) {
      head.geometry = orb; head.scale.set(0.64, 0.7, 0.85); head.material = hide;
      for (const side of [-1, 1]) {
        mesh(head, cone, hide, [side * 0.3, 0.5, -0.18], [0.28, id === 'wolf' ? 0.48 : 0.25, 0.25]);
        mesh(head, orb, dark, [side * 0.28, 0.1, 0.38], [0.12, 0.12, 0.08]);
        if (id === 'boar') mesh(head, cone, horn, [side * 0.4, -0.2, 0.6], [0.1, 0.44, 0.1], [0.2, 0, side * -0.4]);
      }
      mesh(head, orb, hide, [0, -0.16, 0.53], [0.54, 0.45, 0.6]);
      mesh(head, orb, dark, [0, -0.12, 0.82], [0.25, 0.18, 0.12]);
    }
    mesh(g, cone, hide, [0, 0.7, -1.05], [0.26, 1.0, 0.27], [-1.2, 0, 0]);
  } else if (def.shape === 'critter') {
    for (const side of [-1, 1]) {
      mesh(g, orb, hide, [side * 0.22, 0.14, 0.12], [0.25, 0.18, 0.4]);
      mesh(g, orb, dark, [side * 0.13, 0.62, 0.49], [0.065, 0.07, 0.05]);
    }
    mesh(g, orb, material(0xeee4d4), [0, 0.36, -0.4], [0.27, 0.27, 0.27]);
    mesh(g, orb, red, [0, 0.55, 0.55], [0.075, 0.06, 0.05]);
  } else if (def.shape === 'spider') {
    for (let i = 0; i < 8; i++) {
      const leg = g.children[i + 2]; const side = i < 4 ? -1 : 1;
      if (!leg) continue;
      mesh(leg, orb, hide, [side, -0.2, 0], [0.15, 0.15, 0.15]);
      mesh(leg, cyl, hide, [side * 1.18, -0.44, 0], [0.08, 0.65, 0.08], [0, 0, side * 0.55]);
    }
    for (const side of [-1, 1]) mesh(g, orb, red, [side * 0.13, 0.62, 0.69], [0.1, 0.1, 0.08]);
    if (id === 'scorpion') {
      for (let i = 0; i < 5; i++) mesh(g, orb, hide, [0, 0.72 + i * 0.24, -0.8 - Math.sin(i * 0.6) * 0.45], [0.28 - i * 0.026, 0.35, 0.3]);
      mesh(g, cone, dark, [0, 1.83, -0.78], [0.17, 0.45, 0.17], [0.8, 0, 0]);
    }
  } else if (def.shape === 'tree') {
    for (const side of [-1, 1]) {
      mesh(g, orb, hide, [side * 0.7, 3.4, 0], [1.7, 1.5, 1.6]);
      mesh(g, cone, material(0x684731, 'bark'), [side * 0.6, 0.25, 0.1], [0.7, 0.7, 0.8], [0, 0, side * -0.5]);
    }
  } else if (g.userData.hands) {
    enhanceHumanoid(g, def.boss ? 'mage' : 'warrior');
    if (id === 'skeleton') {
      const upper = g.children[0];
      for (let i = 0; i < 4; i++) mesh(upper, box, horn, [0, 1.04 + i * 0.14, 0.24], [0.66 - i * 0.05, 0.055, 0.08]);
    }
    if (def.boss) {
      const crown = g.children[0].children[2];
      for (let i = 0; i < 7; i++) {
        const a = i / 7 * Math.PI * 2;
        mesh(crown, cone, material(0xb8a060, 'trim', 0.4), [Math.sin(a) * 0.48, 0.62, Math.cos(a) * 0.48], [0.13, 0.65, 0.13]);
      }
    }
  }
  return g;
}

export function decorateWorld(shapes, towns) {
  const original = [...shapes];
  const add = (shape, color, x, y, z, ry, sx, sy, sz, tex = 'plain') => shapes.push([shape, color, x, y, z, ry, sx, sy, sz, tex]);
  for (const r of original) {
    if (r[0] !== 'box' || r[9] !== 'house') continue;
    const [, , x, y, z, ry, w, h, d] = r;
    const local = (shape, color, px, py, pz, sx, sy, sz, tex = 'plain') => add(shape, color, x + Math.cos(ry) * px + Math.sin(ry) * pz, y + py, z - Math.sin(ry) * px + Math.cos(ry) * pz, ry, sx, sy, sz, tex);
    // Framing, recessed door, window panes and wood shutters.
    for (const side of [-1, 1]) {
      local('box', 0x5c4432, side * (w / 2 - 0.12), 0, d / 2 + 0.04, 0.26, h, 0.2, 'wood');
      local('box', 0x503a2b, 0, h * 0.08, side * (d / 2 + 0.06), w, 0.22, 0.18, 'wood');
      for (const px of [-w * 0.29, w * 0.29]) {
        local('box', 0x3d3530, px, h * 0.18, side * (d / 2 + 0.09), 1.65, 2.05, 0.16, 'wood');
        local('box', 0xb6b888, px, h * 0.18, side * (d / 2 + 0.2), 1.27, 1.67, 0.08);
        local('box', 0x564332, px, h * 0.18, side * (d / 2 + 0.27), 0.12, 1.68, 0.08, 'wood');
        local('box', 0x564332, px, h * 0.18, side * (d / 2 + 0.27), 1.28, 0.12, 0.08, 'wood');
        local('box', 0x87765f, px, h * 0.18 - 1.1, side * (d / 2 + 0.34), 1.9, 0.19, 0.55, 'stone');
      }
    }
    local('box', 0x3b2a20, 0, -h / 2 + 1.7, d / 2 + 0.13, 1.8, 3.4, 0.2, 'wood');
    local('box', 0x9c8c6a, 0, -h / 2 + 3.48, d / 2 + 0.15, 2.15, 0.28, 0.3, 'stone');
    local('box', 0xa39374, 0, -h / 2 + 0.14, d / 2 + 0.6, 2.5, 0.3, 1.25, 'stone');
    local('box', 0x96856a, w * 0.22, h / 2 + w * 0.38, -d * 0.15, 1.1, w * 0.4, 1.15, 'brick');
  }
  for (const town of towns) {
    const { x, z } = town;
    for (const axis of [0, 1]) add('box', 0xffffff, x, 4.035, z, axis * Math.PI / 2, 7, 0.06, 183, 'cobble');
    // Temple doors, columns and insignia.
    add('box', 0x493722, x, 7, z - 19.8, 0, 3, 6, 0.35, 'wood');
    for (const side of [-1, 1]) {
      add('cyl', 0xdbd2b3, x + side * 5, 9, z - 19.4, 0, 1.1, 10, 1.1, 'stone');
      add('box', 0x386882, x + side * 3, 13, z - 19.7, 0, 1.3, 3.2, 0.12);
      add('box', 0xc1ad6e, x + side * 3, 13, z - 19.58, 0, 0.15, 2, 0.1);
    }
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2; const px = x + Math.cos(a) * 27, pz = z + Math.sin(a) * 27;
      add('cyl', 0x4b4240, px, 6.2, pz, 0, 0.18, 4.4, 0.18, 'wood');
      add('box', 0xdda757, px, 8.6, pz, 0, 0.62, 0.8, 0.62);
      add('cone4', 0x444643, px, 9.2, pz, 0, 0.8, 0.45, 0.8, 'roof');
    }
    for (const side of [-1, 1]) {
      add('box', 0x6b5036, x - 12 + side * 2.5, 5.5, z + 12, 0, 1.8, 3, 1.4, 'wood');
      add('cyl', 0x846044, x - 12 + side * 3.5, 4.65, z + 9, 0, 1.2, 1.3, 1.2, 'wood');
    }
  }
}
