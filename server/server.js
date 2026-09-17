// WS-сервер «Хроник Глубин»: аккаунты и сохранения, присутствие игроков (позиции 10 Гц), онлайн, чат с каналами.
// Запуск: node server/server.js (PORT — 8790, DB — файл SQLite). Прод: systemd realms-ws, nginx /ws.
import { WebSocketServer } from 'ws';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './accounts.js';
import { zoneAt } from '../src/world.js';
import { PVP, karmaForPk, karmaWashCost } from '../src/pvp.js';

const acc = openDb(process.env.DB || path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'realms.db'));

const PORT = Number(process.env.PORT) || 8790;
const VIEW = 220;  // м — кого видно
const NEAR = 60;   // м — канал «Рядом»
const CHAT = { all: { cd: 3000 }, trade: { cd: 10000 }, near: { cd: 800 } };
const wss = new WebSocketServer({ port: PORT, maxPayload: 8000 });
const players = new Map();
let seq = 0;

const num = (v, lim = 1e5) => (Number.isFinite(+v) ? Math.max(-lim, Math.min(lim, +v)) : 0);
const cleanText = (s) => String(s || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 160);
const send = (p, m) => { if (p.ws.readyState === 1) p.ws.send(typeof m === 'string' ? m : JSON.stringify(m)); };
const d2 = (a, b) => Math.hypot(a.st.x - b.st.x, a.st.z - b.st.z);
// внешний вид: только цвета, флаги и числа — клиент сам строит модель
const kind = (v) => (typeof v === 'string' && /^[a-z]{1,16}$/.test(v) ? v : null);
function cleanLook(l) {
  if (!l || typeof l !== 'object') return null;
  const c = (v) => (v == null ? null : num(v, 0xffffff) | 0);
  const g = l.gear || {};
  return {
    cls: l.cls === 'mage' ? 'mage' : 'warrior', lvl: num(l.lvl, 99) | 0,
    w: c(l.w), staff: !!l.staff, ench: num(l.ench, 20) | 0, body: c(l.body), robe: !!l.robe, mat: kind(l.mat),
    gear: { head: c(g.head), legs: c(g.legs), gloves: c(g.gloves), feet: c(g.feet), shield: c(g.shield), helmKind: kind(g.helmKind), shieldKind: kind(g.shieldKind), legKind: kind(g.legKind) },
  };
}
const online = () => [...players.values()].filter((p) => p.key).length;
const broadcast = (m) => { const s = JSON.stringify(m); for (const p of players.values()) if (p.key) send(p, s); };

// попытки входа: не больше 12 в минуту с адреса
const tries = new Map();
const tooMany = (ip) => {
  const now = Date.now(), t = tries.get(ip) || { n: 0, at: now };
  if (now - t.at > 60_000) { t.n = 0; t.at = now; }
  tries.set(ip, t);
  return ++t.n > 12;
};
setInterval(() => { const now = Date.now(); for (const [ip, t] of tries) if (now - t.at > 60_000) tries.delete(ip); }, 60_000);

wss.on('connection', (ws, req) => {
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const p = { id: ++seq, ws, name: null, key: null, look: null, st: null, known: new Set(), lastChat: {}, stN: 0, stT: 0, saveT: 0 };
  players.set(p.id, p);
  send(p, { t: 'hi', online: online() });
  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.t === 'auth' || m.t === 'login' || m.t === 'register') {
      if (p.key) return;
      if (m.t !== 'auth' && tooMany(ip)) return send(p, { t: 'autherr', reason: 'Слишком много попыток, подождите минуту' });
      const r = m.t === 'auth' ? acc.byToken(m.token) : m.t === 'login' ? acc.login(m.name, m.pass) : acc.register(m.name, m.pass, m.save);
      if (r.err) return send(p, { t: 'autherr', reason: r.err, kind: m.t });
      // тот же аккаунт с другого устройства — старое соединение закрываем
      for (const q of players.values()) if (q !== p && q.key === r.key) { send(q, { t: 'kicked' }); q.key = null; q.ws.close(); }
      p.key = r.key; p.name = r.name; p.look = null;
      p.karma = Math.max(0, r.save?.karma | 0); p.pk = r.save?.pk | 0; p.pvp = r.save?.pvp | 0; p.flagUntil = 0; p.hitBy = new Map(); p.lvl = r.save?.lvl | 0;
      send(p, { t: 'authok', id: p.id, name: r.name, token: r.token, save: r.save, online: online() });
      sendMe(p);
      broadcast({ t: 'online', n: online() });
      return;
    }
    if (!p.key) return;
    if (m.t === 'save') {
      const now = Date.now();
      if (now - p.saveT < 2000) return; // не чаще раза в 2 с
      p.saveT = now;
      if (m.p && typeof m.p === 'object') p.lvl = m.p.lvl | 0;
      // PvP-счётчики и карму ведёт сервер
      if (!acc.store(p.key, { ...m.p, karma: p.karma, pk: p.pk, pvp: p.pvp })) send(p, { t: 'saveerr' });
      return;
    }
    if (m.t === 'logout') { if (m.token) acc.logout(m.token); return; }
    if (m.t === 'st') {
      const now = Date.now();
      if (now - p.stT > 1000) { p.stT = now; p.stN = 0; }
      if (++p.stN > 25) return; // не чаще 25 в секунду
      p.st = { x: num(m.x), y: num(m.y, 1e4), z: num(m.z), r: num(m.r, 10), a: num(m.a, 255) | 0, hp: num(m.hp, 100) | 0 };
    }
    if (m.t === 'look') {
      p.look = cleanLook(m.look);
      const s = JSON.stringify({ t: 'look', id: p.id, name: p.name, look: p.look });
      for (const q of players.values()) if (q.known.has(p.id)) send(q, s);
    }
    if (m.t === 'pvp') return onPvp(p, m);
    if (m.t === 'hurt') { const q = players.get(m.by | 0); if (q?.key) send(q, { t: 'hurtres', id: p.id, dmg: num(m.dmg, 1e6) | 0, crit: !!m.crit }); return; }
    if (m.t === 'pdied') return onDied(p, m);
    if (m.t === 'mobkill') {
      if (p.karma > 0 && Date.now() - (p.mkT || 0) > 300) { p.mkT = Date.now(); p.karma = Math.max(0, p.karma - Math.max(1, Math.ceil(num(m.xp, 5000) / PVP.karmaPerXp))); sendMe(p); }
      return;
    }
    if (m.t === 'wash') {
      if (p.karma <= 0) return;
      const cost = karmaWashCost(p.karma);
      if ((num(m.coins, 1e9) | 0) < cost) return send(p, { t: 'washerr', cost });
      p.karma = 0; sendMe(p); send(p, { t: 'washok', cost });
      return;
    }
    if (m.t === 'pkloot') {
      const k = players.get(m.to | 0);
      if (!k?.key || typeof m.item?.id !== 'string') return;
      const item = { id: m.item.id.slice(0, 32), n: Math.max(1, num(m.item.n, 9999) | 0), e: num(m.item.e, 20) | 0 };
      send(k, { t: 'pkloot', from: p.name, item });
      broadcast({ t: 'announce', text: `С PK ${p.name} упала вещь — её подобрал ${k.name}` });
      return;
    }
    if (m.t === 'pm') {
      const text = cleanText(m.text);
      if (!text || Date.now() - (p.lastPm || 0) < 400) return;
      p.lastPm = Date.now();
      const key = String(m.to || '').trim().toLowerCase();
      let q = null;
      for (const x of players.values()) if (x.key === key) q = x;
      if (!q) return send(p, { t: 'pmerr', to: String(m.to || '').slice(0, 16), reason: 'не в сети' });
      const msg = JSON.stringify({ t: 'pm', from: p.name, to: q.name, text });
      send(q, msg);
      if (q !== p) send(p, msg);
      return;
    }
    if (m.t === 'chat') {
      const ch = CHAT[m.ch] ? m.ch : 'all';
      const text = cleanText(m.text);
      if (!text) return;
      const wait = (p.lastChat[ch] || 0) + CHAT[ch].cd - Date.now();
      if (wait > 0) return send(p, { t: 'chatwait', ch, wait });
      p.lastChat[ch] = Date.now();
      const s = JSON.stringify({ t: 'chat', ch, from: p.name, id: p.id, text });
      for (const q of players.values()) {
        if (!q.key) continue;
        if (ch === 'near' && q !== p && (!q.st || !p.st || d2(p, q) > NEAR)) continue;
        send(q, s);
      }
    }
  });
  ws.on('close', () => {
    players.delete(p.id);
    if (p.name) { broadcast({ t: 'leave', id: p.id }); broadcast({ t: 'online', n: online() }); }
    p.key = null;
  });
});

// ===== PvP: флаг, PK, карма =====
const inTown = (p) => !p.st || !!zoneAt(p.st.x, p.st.z).town;
const flagged = (p) => p.flagUntil > Date.now();
const status = (p) => (p.karma > 0 ? 2 : flagged(p) ? 1 : 0); // 0 — белый, 1 — фиолетовый, 2 — красный
const sendMe = (p) => send(p, { t: 'me', karma: p.karma, pk: p.pk, pvp: p.pvp, flag: Math.max(0, p.flagUntil - Date.now()) });
function onPvp(p, m) {
  const q = players.get(m.to | 0), now = Date.now();
  if (!q?.key || q === p || !p.st || !q.st) return;
  if (now - (p.pvpT || 0) < PVP.minHitMs) return;
  if ((p.st.a & 8) || (q.st.a & 8)) return;
  if (inTown(p) || inTown(q)) return send(p, { t: 'pvperr', reason: 'В городе сражаться нельзя' });
  const range = Math.min(num(m.range, 40), 30);
  if (d2(p, q) > range + 4) return;
  p.pvpT = now;
  // напал на белого — флаг (у PK флаг не нужен, он и так красный)
  if (status(q) === 0 && p.karma <= 0) { const was = flagged(p); p.flagUntil = now + PVP.flagMs; if (!was) sendMe(p); }
  q.hitBy.set(p.id, now);
  const cap = PVP.atkCap(p.lvl);
  send(q, { t: 'phit', from: p.id, name: p.name, atk: Math.min(num(m.atk, 1e6), cap), mul: Math.min(Math.max(num(m.mul, 10), 0.5), 3), school: m.school === 'm' ? 'm' : 'p', crit: !!m.crit });
}
function onDied(p, m) {
  const k = players.get(m.by | 0), now = Date.now();
  if (!k?.key || k === p || !(now - (p.hitBy.get(k.id) || 0) < 10_000)) return;
  p.hitBy.clear();
  const victimWasRed = p.karma > 0, victimFlag = flagged(p);
  if (victimWasRed || victimFlag) {
    k.pvp++;
    if (victimWasRed) broadcast({ t: 'announce', text: `${k.name} победил PK ${p.name}` });
  } else {
    k.pk++; k.karma += karmaForPk(k.pk); k.flagUntil = 0;
    broadcast({ t: 'announce', text: `${k.name} убил ${p.name} и стал PK! Зона: ${zoneAt(k.st?.x || 0, k.st?.z || 0).name}`, pk: k.id });
  }
  sendMe(k);
  // с умершего PK падает вещь — достаётся убийце
  if (victimWasRed) send(p, { t: 'pkdrop', to: k.id, name: k.name });
}
setInterval(() => {
  for (const p of players.values()) {
    if (!p.key) continue;
    if (p.flagUntil && p.flagUntil <= Date.now()) { p.flagUntil = 0; sendMe(p); }
  }
}, 1000);
// объявления: где сейчас PK
setInterval(() => {
  const reds = [...players.values()].filter((p) => p.key && p.karma > 0 && p.st);
  for (const p of reds) broadcast({ t: 'announce', text: `PK ${p.name} (карма ${p.karma}) замечен: ${zoneAt(p.st.x, p.st.z).name}`, pk: p.id });
}, PVP.announceMs);

// снапшоты: каждому — соседи в радиусе видимости
setInterval(() => {
  const list = [...players.values()].filter((p) => p.key && p.st);
  for (const p of list) {
    const o = [];
    for (const q of list) {
      if (q === p || d2(p, q) > VIEW) continue;
      if (!p.known.has(q.id)) { p.known.add(q.id); send(p, { t: 'look', id: q.id, name: q.name, look: q.look }); }
      const s = q.st; o.push([q.id, +s.x.toFixed(2), +s.y.toFixed(2), +s.z.toFixed(2), +s.r.toFixed(2), s.a, s.hp, status(q)]);
    }
    for (const id of p.known) if (!players.has(id)) p.known.delete(id);
    if (o.length || p.hadSnap) send(p, { t: 'snap', ts: Date.now(), o });
    p.hadSnap = o.length > 0;
  }
}, 100);
// пинг, чтобы nginx не рвал простаивающие соединения
setInterval(() => { for (const p of players.values()) if (p.ws.readyState === 1) p.ws.ping(); }, 25000);
console.log(`realms-ws :${PORT}, аккаунтов: ${acc.count()}`);
