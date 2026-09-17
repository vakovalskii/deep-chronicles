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
// Стандартные имена (Rigify / Quaternius): если они есть — берём их, это надёжнее любой эвристики.
// ВАЖНО: three.js при загрузке glTF вычищает из имён узлов точки и прочую пунктуацию
// (PropertyBinding.sanitizeNodeName), поэтому «DEF-spine.001» в браузере зовётся «DEF-spine001».
// Разделитель в шаблонах поэтому необязательный: иначе распознавание работает в node и молчит в игре.
const S = '[-._ ]?';
const re = (s) => new RegExp('^(' + s.replace(/~/g, S) + ')$', 'i');
const BY_NAME = {
  hips: re('DEF~hips|mixamorig:?Hips'), spine: re('DEF~spine~001|mixamorig:?Spine'),
  chest: re('DEF~spine~003|mixamorig:?Spine2'), neck: re('DEF~neck|mixamorig:?Neck'), head: re('DEF~head|mixamorig:?Head'),
  shoulderL: re('DEF~upper~arm~L|mixamorig:?LeftArm'), elbowL: re('DEF~forearm~L|mixamorig:?LeftForeArm'), handL: re('DEF~hand~L|mixamorig:?LeftHand'),
  shoulderR: re('DEF~upper~arm~R|mixamorig:?RightArm'), elbowR: re('DEF~forearm~R|mixamorig:?RightForeArm'), handR: re('DEF~hand~R|mixamorig:?RightHand'),
  hipL: re('DEF~thigh~L|mixamorig:?LeftUpLeg'), kneeL: re('DEF~shin~L|mixamorig:?LeftLeg'), footL: re('DEF~foot~L|mixamorig:?LeftFoot'),
  hipR: re('DEF~thigh~R|mixamorig:?RightUpLeg'), kneeR: re('DEF~shin~R|mixamorig:?RightLeg'), footR: re('DEF~foot~R|mixamorig:?RightFoot'),
};

function rigByName(bones) {
  const rig = {};
  for (const [role, re] of Object.entries(BY_NAME)) {
    const b = bones.find((x) => re.test(x.name));
    if (b) rig[role] = b;
  }
  return Object.keys(rig).length >= 12 ? rig : null; // нашлось мало — скелет чужой, пойдём по строению
}

export function detectRig(skeleton, root, manual) {
  root.updateMatrixWorld(true);
  const bones = skeleton.bones;
  if (bones.length < 8) return null;
  const P = new Map(bones.map((b) => [b, world(b)]));
  const named = rigByName(bones);
  if (named) {
    const ys = [...P.values()].map((p) => p.y);
    named.height = Math.max(...ys) - Math.min(...ys) || 1;
    if (manual) {
      const byName = new Map(bones.map((b) => [b.name, b]));
      for (const [role, name] of Object.entries(manual)) if (byName.has(name)) named[role] = byName.get(name);
    }
    return named;
  }
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
  // ручная разметка из студии перекрывает автоматику
  if (manual) {
    const byName = new Map(bones.map((b) => [b.name, b]));
    for (const [role, name] of Object.entries(manual)) if (byName.has(name)) rig[role] = byName.get(name);
  }
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

// Параметры походки. Настраиваются глазами в студии (вкладка «Анимация») и
// сохраняются в public/assets/rig.json — игра берёт их оттуда.
export const GAIT = {
  speed: 8,      // частота шага
  hip: 0.38,     // мах бедром вперёд-назад
  knee: 0.75,    // сгиб колена назад
  ankle: 0.38,   // доворот стопы, чтобы нога вставала на пол
  shoulder: 0.45,// мах руки
  elbow: 0.3,    // постоянный подгиб локтя
  elbowSwing: 0.5, // добавка к локтю в такт шагу
  sway: 0.12,    // доворот таза за шагом
  chest: 0.16,   // противоход груди
  bob: 0.012,    // приседание
  lean: 0.05,    // наклон корпуса вперёд при движении
  idle: 1.7,     // частота дыхания в покое
  attack: 1.5,   // размах удара
};

// Анимация по костям: шаг, замах, покачивание. Та же сигнатура, что у процедурных моделей.
export function skinnedAnim(rig, gait = {}) {
  const g = { ...GAIT, ...gait };
  const bind = bindRig(rig);
  const off = Math.random() * 6.28; // чтобы толпа не шагала синхронно
  return (t, st = {}) => {
    const walk = st.moving ? Math.sin(t * g.speed + off) : 0;
    const idle = st.moving ? 0 : Math.sin(t * g.idle + off);
    const hit = st.hitT || 0;
    const atk = st.attackT > 0 ? Math.sin(st.attackT * Math.PI) : 0;
    const back = (w) => Math.max(0, w); // фаза, когда нога уходит назад

    turn(rig, bind, 'hipR', 'side', walk * g.hip);
    turn(rig, bind, 'hipL', 'side', -walk * g.hip);
    turn(rig, bind, 'kneeR', 'side', back(-walk) * g.knee);
    turn(rig, bind, 'kneeL', 'side', back(walk) * g.knee);
    turn(rig, bind, 'footR', 'side', -walk * g.ankle + back(-walk) * g.ankle * 0.9);
    turn(rig, bind, 'footL', 'side', walk * g.ankle + back(walk) * g.ankle * 0.9);

    turn(rig, bind, 'shoulderR', 'side', atk ? -atk * g.attack : -walk * g.shoulder);
    turn(rig, bind, 'shoulderL', 'side', walk * g.shoulder);
    turn(rig, bind, 'elbowR', 'side', -(g.elbow + back(-walk) * g.elbowSwing + atk * 0.9));
    turn(rig, bind, 'elbowL', 'side', -(g.elbow + back(walk) * g.elbowSwing));

    turn(rig, bind, 'hips', 'upAx', -walk * g.sway);
    turn(rig, bind, 'chest', 'upAx', walk * g.chest);
    turn(rig, bind, 'spine', 'side', (st.moving ? g.lean : 0) - hit * 0.2 + idle * 0.01);
    turn(rig, bind, 'head', 'side', -hit * 0.15 + idle * 0.02);

    const d = bind.get('hips');
    if (d) rig.hips.position.y = d.y0 - Math.abs(walk) * rig.height * g.bob;
  };
}

// Поза клипа в момент t (0…1): ищем соседние кадры и плавно переходим между ними.
// Клипы рисуются руками в студии и лежат в public/assets/clips.json.
const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
export function poseAt(clip, t) {
  const f = clip?.frames;
  if (!f?.length) return null;
  if (f.length === 1) return f[0];
  let i = 0;
  while (i < f.length - 1 && f[i + 1].t <= t) i++;
  const a = f[i], b = f[i + 1] || f[0];
  const span = (b.t - a.t + 1) % 1 || 1;
  const k = Math.min(1, Math.max(0, ((t - a.t + 1) % 1) / span));
  const pose = {};
  for (const key of Object.keys(a.pose || {})) {
    const qA = a.pose[key], qB = b.pose?.[key] || qA;
    qa.fromArray(qA); qb.fromArray(qB); qa.slerp(qb, k);
    pose[key] = qa.toArray();
  }
  const y = a.y !== undefined && b.y !== undefined ? a.y + (b.y - a.y) * k : a.y;
  return { pose, y };
}

// Проигрывание нарисованных клипов: ходьба при движении, удар при замахе, иначе покой.
export function clipAnim(rig, clips) {
  const has = (n) => clips?.[n]?.frames?.length > 1;
  return (t, st = {}) => {
    const name = st.attackT > 0 && has('attack') ? 'attack' : st.moving && has('walk') ? 'walk' : has('idle') ? 'idle' : null;
    if (!name) return;
    const clip = clips[name];
    const dur = clip.dur || 1;
    const time = name === 'attack' ? Math.min(1, st.attackT) : (t % dur) / dur;
    const p = poseAt(clip, time);
    if (!p) return;
    for (const [key, q] of Object.entries(p.pose)) rig[key]?.quaternion.fromArray(q);
    if (p.y !== undefined && rig.hips) rig.hips.position.y = p.y;
  };
}
