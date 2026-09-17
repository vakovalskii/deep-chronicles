// Скиннутые модели: распознавание скелета и анимация по костям.
// UniRig называет кости bone_0…bone_N и ориентирует их произвольно, поэтому:
//   кости ищем по строению скелета, а не по именам;
//   вращаем вокруг МИРОВЫХ осей (вбок/вверх/вперёд), пересчитанных в систему родителя, —
//   иначе «поворот вокруг X» у каждой кости означает своё, и тело выворачивает.
import * as THREE from 'three';

const v = new THREE.Vector3();
const world = (b) => b.getWorldPosition(new THREE.Vector3());

const kids = (b) => b.children.filter((c) => c.isBone);
const up = (b) => (b?.parent?.isBone ? b.parent : null);

// Скелет UniRig читается по строению, а не по именам:
//   таз (корень) → позвоночник вверх до груди (там 3 ветки: шея и две ключицы)
//   рука: ключица → плечо → локоть → кисть (у кисти ветвятся пальцы)
//   нога: бедро → колено → голеностоп → носок
export function detectRig(skeleton, root) {
  root.updateMatrixWorld(true);
  const bones = skeleton.bones;
  if (bones.length < 8) return null;
  const P = new Map(bones.map((b) => [b, world(b)]));
  const hips = bones.find((b) => !up(b)) || bones[0];

  // от таза вниз уходят ноги, вверх — позвоночник
  const fromHips = kids(hips);
  const legs = fromHips.filter((b) => P.get(b).y < P.get(hips).y).sort((a, b) => P.get(b).x - P.get(a).x);
  const spine1 = fromHips.find((b) => P.get(b).y >= P.get(hips).y);

  // вверх по позвоночнику до развилки (грудь): оттуда шея и руки
  let chest = spine1, spine = spine1;
  for (let i = 0; i < 8 && chest && kids(chest).length === 1; i++) { spine = chest; chest = kids(chest)[0]; }
  if (!chest) return null;
  const branches = kids(chest);
  const neck = branches.find((b) => Math.abs(P.get(b).x - P.get(hips).x) < 0.06) || branches[0];
  const arms = branches.filter((b) => b !== neck).sort((a, b) => P.get(b).x - P.get(a).x);

  // ключица → плечо → локоть → кисть; кисть узнаём по ветвлению пальцев
  const arm = (clav) => {
    if (!clav) return {};
    const chain = [clav];
    let b = clav;
    for (let i = 0; i < 6 && kids(b).length && kids(b).length < 2; i++) { b = kids(b)[0]; chain.push(b); }
    const hand = chain[chain.length - 1];
    return { shoulder: chain[1] || clav, elbow: chain[2] || chain[1] || clav, hand };
  };
  const leg = (thigh) => {
    if (!thigh) return {};
    const chain = [thigh];
    let b = thigh;
    for (let i = 0; i < 4 && kids(b).length; i++) { b = kids(b)[0]; chain.push(b); }
    return { hip: thigh, knee: chain[1], foot: chain[2] || chain[1] };
  };

  const R = arm(arms[0]), L = arm(arms[1]);
  const legR = leg(legs[0]), legL = leg(legs[1]);
  let head = neck;
  while (kids(head).length === 1) head = kids(head)[0]; // до макушки

  const ys = [...P.values()].map((p) => p.y);
  const rig = {
    hips, spine: spine || hips, chest, neck, head,
    shoulderR: R.shoulder, elbowR: R.elbow, handR: R.hand,
    shoulderL: L.shoulder, elbowL: L.elbow, handL: L.hand,
    hipR: legR.hip, kneeR: legR.knee, footR: legR.foot,
    hipL: legL.hip, kneeL: legL.knee, footL: legL.foot,
    height: Math.max(...ys) - Math.min(...ys) || 1,
  };
  if (!rig.shoulderR || !rig.shoulderL || !rig.hipR || !rig.hipL) return null;
  return rig;
}

// Поза покоя и оси вращения в системе родителя: считаются один раз при загрузке.
function bindRig(rig) {
  const bind = new Map();
  const pq = new THREE.Quaternion();
  for (const [key, b] of Object.entries(rig)) {
    if (!b?.isBone) continue;
    (b.parent || b).getWorldQuaternion(pq);
    const inv = pq.clone().invert(); // мировая ось → ось в системе родителя кости
    bind.set(key, {
      rest: b.quaternion.clone(),
      side: new THREE.Vector3(1, 0, 0).applyQuaternion(inv).normalize(),   // ось шага: мах вперёд-назад
      upAx: new THREE.Vector3(0, 1, 0).applyQuaternion(inv).normalize(),   // поворот вбок
      fwd: new THREE.Vector3(0, 0, 1).applyQuaternion(inv).normalize(),    // разведение рук
      y0: b.position.y,
    });
  }
  return bind;
}

const q = new THREE.Quaternion();

// Поворот кости вокруг мировой оси на угол, от позы покоя.
function turn(rig, bind, key, axis, angle) {
  const b = rig[key], d = bind.get(key);
  if (!b || !d || !angle) { if (b && d) b.quaternion.copy(d.rest); return; }
  b.quaternion.copy(d.rest).premultiply(q.setFromAxisAngle(d[axis], angle));
}

// Анимация по костям: шаг, замах, покачивание. Та же сигнатура, что у процедурных моделей.
export function skinnedAnim(rig) {
  const bind = bindRig(rig);
  const off = Math.random() * 6.28; // чтобы толпа не шагала синхронно
  return (t, st = {}) => {
    const walk = st.moving ? Math.sin(t * 8 + off) : 0;
    const idle = st.moving ? 0 : Math.sin(t * 1.7 + off);
    const hit = st.hitT || 0;
    const atk = st.attackT > 0 ? Math.sin(st.attackT * Math.PI) : 0;

    // ноги: мах бедром вперёд-назад, колено сгибается только назад
    turn(rig, bind, 'hipR', 'side', walk * 0.38);
    turn(rig, bind, 'hipL', 'side', -walk * 0.38);
    // колено сгибается только назад: нога, уходящая назад, подбирает пятку
    turn(rig, bind, 'kneeR', 'side', Math.max(0, -walk) * 0.75);
    turn(rig, bind, 'kneeL', 'side', Math.max(0, walk) * 0.75);
    // стопа компенсирует поворот бедра и колена — нога ставится на пол, а не висит носком
    turn(rig, bind, 'footR', 'side', -walk * 0.38 + Math.max(0, -walk) * 0.35);
    turn(rig, bind, 'footL', 'side', walk * 0.38 + Math.max(0, walk) * 0.35);

    // руки: при ходьбе противоход ногам, при ударе правая идёт вперёд
    turn(rig, bind, 'shoulderR', 'side', atk ? -atk * 1.5 : -walk * 0.45);
    turn(rig, bind, 'shoulderL', 'side', walk * 0.45);
    // локти всегда чуть согнуты (прямые руки выглядят как палки) и подрабатывают в такт шагу
    const bendR = 0.3 + Math.max(0, -walk) * 0.5 + atk * 0.9;
    const bendL = 0.3 + Math.max(0, walk) * 0.5;
    turn(rig, bind, 'elbowR', 'side', -bendR);
    turn(rig, bind, 'elbowL', 'side', -bendL);

    turn(rig, bind, 'spine', 'side', (st.moving ? 0.05 : 0) - hit * 0.2 + idle * 0.01);
    turn(rig, bind, 'head', 'side', -hit * 0.15 + idle * 0.02);

    // таз доворачивается за шагом, грудь — в противоход: походка перестаёт быть деревянной
    turn(rig, bind, 'hips', 'upAx', -walk * 0.12);
    turn(rig, bind, 'chest', 'upAx', walk * 0.16);
    const d = bind.get('hips');
    if (d) rig.hips.position.y = d.y0 - Math.abs(walk) * rig.height * 0.012;
  };
}
