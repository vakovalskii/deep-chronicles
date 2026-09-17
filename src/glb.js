// Загрузка сгенерированных моделей (GLB) и нарезка цельного меша на части для анимации.
// TRELLIS отдаёт один меш без костей, поэтому режем его по треугольникам на голову, корпус,
// руки и ноги и вешаем их на те же пивоты, что у процедурного героя (src/models.js).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const MODELS_URL = 'assets/models/';
// какая модель за каким классом (по имени из CLASSES); нет записи — рисуем процедурную модель, как раньше
export const MODEL_OF = { 'Маг': 'mage_mystic_anime' };

// Пивоты процедурного героя: бёдра 0.8, плечи 1.6, шея 1.85 при росте 2.4.
export const RIG = { height: 2.4, hip: 0.8, shoulder: 1.6, neck: 1.85, armX: 0.55 };

const loader = new GLTFLoader();
// правки из студии (tools/studio.mjs): рост модели и привязка оружия/щита
let rigPromise = null;
export function rigOverrides(base = 'assets/') {
  rigPromise ||= fetch(base + 'rig.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  return rigPromise;
}
const cache = new Map(); // id → Promise<Group>, чтобы одна модель грузилась один раз на всех

export function loadModel(id, base = MODELS_URL) {
  if (!cache.has(id)) {
    cache.set(id, loader.loadAsync(`${base}${id}.glb`).then((g) => {
      g.scene.traverse((o) => { if (o.isMesh) o.material.side = THREE.DoubleSide; });
      return g.scene;
    }));
  }
  return cache.get(id);
}

// Треугольник относим к части по его центру: так шов идёт по рёбрам и дыр не остаётся.
function partOf(cx, cy, cz, rig, hasSkirt) {
  if (cy > rig.neck) return 'head';
  if (Math.abs(cx) > rig.armX && cy > rig.hip) return cx < 0 ? 'armL' : 'armR';
  if (cy < rig.hip && !hasSkirt) return cx < 0 ? 'legL' : 'legR';
  return 'torso';
}

// Меш → { part: BufferGeometry }. Геометрию каждой части сдвигаем так, чтобы ноль был в пивоте.
export function sliceGeometry(geo, rig = RIG, hasSkirt = false) {
  const src = geo.index ? geo.toNonIndexed() : geo;
  const pos = src.attributes.position, uv = src.attributes.uv, nor = src.attributes.normal;
  const buckets = {};
  for (let i = 0; i < pos.count; i += 3) {
    const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
    const cy = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
    const cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
    const key = partOf(cx, cy, cz, rig, hasSkirt);
    const b = (buckets[key] ||= { p: [], u: [], n: [] });
    for (let k = 0; k < 3; k++) {
      b.p.push(pos.getX(i + k), pos.getY(i + k), pos.getZ(i + k));
      if (uv) b.u.push(uv.getX(i + k), uv.getY(i + k));
      if (nor) b.n.push(nor.getX(i + k), nor.getY(i + k), nor.getZ(i + k));
    }
  }
  const out = {};
  for (const [key, b] of Object.entries(buckets)) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3));
    if (b.u.length) g.setAttribute('uv', new THREE.Float32BufferAttribute(b.u, 2));
    if (b.n.length) g.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3));
    else g.computeVertexNormals();
    out[key] = g;
  }
  return out;
}

// Пивот части: точка, вокруг которой она крутится (плечо, бедро, шея).
export function pivotOf(key, rig = RIG) {
  switch (key) {
    case 'head': return [0, rig.neck, 0];
    case 'armL': return [-rig.armX, rig.shoulder, 0];
    case 'armR': return [rig.armX, rig.shoulder, 0];
    case 'legL': return [-rig.hip * 0.25, rig.hip, 0];
    case 'legR': return [rig.hip * 0.25, rig.hip, 0];
    default: return [0, 0, 0];
  }
}

// Цельный меш → группа из частей на пивотах + anim(t, st), совместимый с процедурным героем.
export function rigModel(scene, { height = RIG.height } = {}) {
  let mesh = null;
  scene.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
  if (!mesh) return null;

  const geo = mesh.geometry.clone();
  geo.applyMatrix4(mesh.matrixWorld);
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const k = height / (bb.max.y - bb.min.y);
  // ставим на пол, центрируем по X/Z и приводим к росту процедурного героя
  geo.applyMatrix4(new THREE.Matrix4().makeTranslation(-(bb.max.x + bb.min.x) / 2, -bb.min.y, -(bb.max.z + bb.min.z) / 2));
  geo.applyMatrix4(new THREE.Matrix4().makeScale(k, k, k));
  geo.computeBoundingBox();

  const rig = { ...RIG, height };
  // ширина на уровне бёдер: у мантии подол широкий — ноги не режем, иначе развалится юбка
  const width = geo.boundingBox.max.x - geo.boundingBox.min.x;
  const hasSkirt = width > height * 0.42;
  rig.armX = width * 0.28;

  const parts = sliceGeometry(geo, rig, hasSkirt);
  const g = new THREE.Group();
  const nodes = {};
  for (const [key, pg] of Object.entries(parts)) {
    const [px, py, pz] = pivotOf(key, rig);
    pg.applyMatrix4(new THREE.Matrix4().makeTranslation(-px, -py, -pz));
    const m = new THREE.Mesh(pg, mesh.material);
    m.castShadow = true;
    const node = new THREE.Group();
    node.position.set(px, py, pz);
    node.add(m);
    g.add(node);
    nodes[key] = node;
  }

  const { head, armL, armR, legL, legR, torso } = nodes;
  g.userData.parts = nodes;
  // кисть — нижняя точка геометрии руки: туда цепляем оружие и щит
  g.userData.handY = {};
  for (const key of ['armL', 'armR']) {
    const node = nodes[key];
    if (!node) continue;
    // геометрия части уже сдвинута в пивот, поэтому берём её собственный bbox
    node.children[0].geometry.computeBoundingBox();
    g.userData.handY[key] = node.children[0].geometry.boundingBox.min.y * 0.9;
  }
  // та же схема, что у процедурного героя: шаг, замах, покачивание
  g.userData.anim = (t, st = {}) => {
    const w = st.moving ? Math.sin(t * 9) : 0;
    if (legL) legL.rotation.x = w * 0.6;
    if (legR) legR.rotation.x = -w * 0.6;
    if (armL) armL.rotation.x = -w * 0.45;
    if (armR) armR.rotation.x = st.attackT > 0 ? -Math.sin(st.attackT * Math.PI) * 1.8 : w * 0.45;
    if (head) head.rotation.z = Math.sin(t * 1.6) * 0.03;
    if (torso) torso.position.y = st.moving ? Math.abs(Math.sin(t * 9)) * 0.05 : Math.sin(t * 1.6) * 0.015;
    if (hasSkirt && legL) legL.rotation.x = legR.rotation.x = 0;
  };
  return g;
}

// Подменяет содержимое уже добавленной в сцену группы моделью, когда та догрузится.
// Пока модель едет (или если её нет) — на экране процедурный герой, игра не ждёт.
export async function applyModel(group, id, { base = MODELS_URL, height = RIG.height } = {}) {
  if (!id) return false;
  // снимок делаем сразу: пока модель грузится, игра успевает навесить на группу своё
  // (табличку с именем, флаг PvP) — это трогать нельзя, прячем только процедурные части
  const own = [...group.children];
  try {
    const [scene, over] = await Promise.all([loadModel(id, base), rigOverrides(base.replace('models/', ''))]);
    const rig = over[id] || {};
    const rigged = rigModel(scene.clone(true), { height: rig.height || height });
    if (!rigged) return false;
    for (const child of own) child.visible = false;
    group.add(rigged);
    // оружие и щит переносим из спрятанных процедурных рук в кисти модели
    const hands = group.userData.hands;
    if (hands) {
      for (const [key, item, o] of [['armR', hands.weapon, rig.weapon], ['armL', hands.shield, rig.shield]]) {
        const node = rigged.userData.parts[key];
        if (!node || !item) continue;
        if (o) { // студия задала привязку явно
          item.position.set(o.x ?? 0, o.y ?? -0.7, o.z ?? 0.1);
          item.rotation.set((o.rx || 0) * Math.PI / 180, (o.ry || 0) * Math.PI / 180, (o.rz || 0) * Math.PI / 180);
          if (o.s) item.scale.multiplyScalar(o.s);
        } else {
          item.position.set(0, rigged.userData.handY[key] ?? -0.6, 0.1);
        }
        item.visible = true;
        node.add(item);
      }
    }
    group.userData.anim = rigged.userData.anim;
    group.userData.model = id;
    return true;
  } catch (e) {
    console.warn('модель не загрузилась:', id, e.message);
    return false;
  }
}
