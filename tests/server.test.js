// Тесты сервера: аккаунты, сохранения, вытеснение второй сессии. npm run test:server
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';

const PORT = 8792, DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'realms-')), DB = path.join(DIR, 'test.db');
let srv;
before(async () => {
  srv = spawn('node', ['--no-warnings', 'server/server.js'], { env: { ...process.env, PORT: String(PORT), DB }, stdio: 'pipe' });
  await new Promise((r) => srv.stdout.once('data', r));
});
after(() => { srv.kill(); fs.rmSync(DIR, { recursive: true, force: true }); });

// клиент: ждёт сообщения нужного типа
function client() {
  const ws = new WebSocket(`ws://localhost:${PORT}`), inbox = [], waiters = [];
  ws.on('message', (d) => { const m = JSON.parse(d); const w = waiters.findIndex((x) => x.types.includes(m.t)); if (w >= 0) waiters.splice(w, 1)[0].res(m); else inbox.push(m); });
  const c = {
    ws, send: (m) => ws.send(JSON.stringify(m)),
    wait: (...types) => new Promise((res, rej) => {
      const i = inbox.findIndex((m) => types.includes(m.t)); if (i >= 0) return res(inbox.splice(i, 1)[0]);
      waiters.push({ types, res }); setTimeout(() => rej(new Error('нет ответа ' + types)), 3000);
    }),
    open: () => new Promise((r) => ws.once('open', r)),
    closed: () => new Promise((r) => (ws.readyState === 3 ? r() : ws.once('close', r))),
  };
  return c;
}
const char = (name, cls = 'warrior') => ({ name, cls, lvl: 1, xp: 0, coins: 150, inv: [], equip: { weapon: 'sword_novice' }, x: 0, z: 0 });

test('регистрация, вход по паролю и по токену, сохранение', async () => {
  const a = client(); await a.open();
  a.send({ t: 'register', name: 'Тестер', pass: 'secret1', save: char('Другое', 'mage') });
  const ok = await a.wait('authok', 'autherr');
  assert.equal(ok.t, 'authok'); assert.equal(ok.save.name, 'Тестер'); assert.equal(ok.save.cls, 'mage'); assert.ok(ok.token);
  // сохранение: имя и класс не подменить
  a.send({ t: 'save', p: { ...char('Взлом', 'warrior'), lvl: 7 } });
  await new Promise((r) => setTimeout(r, 200));
  a.ws.close(); await a.closed();

  const b = client(); await b.open();
  b.send({ t: 'login', name: 'тестер', pass: 'secret1' });
  const lg = await b.wait('authok', 'autherr');
  assert.equal(lg.t, 'authok'); assert.equal(lg.save.lvl, 7); assert.equal(lg.save.name, 'Тестер'); assert.equal(lg.save.cls, 'mage');
  b.ws.close(); await b.closed();

  const c = client(); await c.open();
  c.send({ t: 'auth', token: ok.token });
  assert.equal((await c.wait('authok', 'autherr')).name, 'Тестер');
  c.ws.close(); await c.closed();
});

test('занятое имя, неверный пароль, плохой токен, слабые данные', async () => {
  const a = client(); await a.open();
  a.send({ t: 'register', name: 'ТЕСТЕР', pass: 'xxxx', save: char('x') });
  assert.match((await a.wait('autherr')).reason, /занято/);
  a.send({ t: 'login', name: 'Тестер', pass: 'wrong' });
  assert.match((await a.wait('autherr')).reason, /Неверное/);
  a.send({ t: 'auth', token: 'deadbeef' });
  assert.match((await a.wait('autherr')).reason, /Сессия/);
  a.send({ t: 'register', name: 'a b', pass: 'xxxx', save: char('x') });
  assert.match((await a.wait('autherr')).reason, /Имя/);
  a.send({ t: 'register', name: 'Норм', pass: '1', save: char('x') });
  assert.match((await a.wait('autherr')).reason, /Пароль/);
  // без входа чат и сохранение игнорируются
  a.send({ t: 'chat', ch: 'all', text: 'спам' });
  a.ws.close(); await a.closed();
});

test('вход с другого устройства вытесняет первое', async () => {
  const a = client(); await a.open();
  a.send({ t: 'login', name: 'Тестер', pass: 'secret1' }); await a.wait('authok');
  const b = client(); await b.open();
  b.send({ t: 'login', name: 'Тестер', pass: 'secret1' }); await b.wait('authok');
  assert.equal((await a.wait('kicked')).t, 'kicked');
  await a.closed();
  b.ws.close(); await b.closed();
});

test('личные сообщения: доставка, эхо отправителю, адресат не в сети', async () => {
  const a = client(); await a.open();
  a.send({ t: 'login', name: 'Тестер', pass: 'secret1' }); await a.wait('authok');
  const b = client(); await b.open();
  b.send({ t: 'register', name: 'Друг', pass: 'secret2', save: char('x') }); await b.wait('authok');
  a.send({ t: 'pm', to: 'друг', text: 'привет' });
  const got = await b.wait('pm'), echo = await a.wait('pm');
  assert.deepEqual([got.from, got.to, got.text], ['Тестер', 'Друг', 'привет']);
  assert.equal(echo.text, 'привет');
  await new Promise((r) => setTimeout(r, 450));
  a.send({ t: 'pm', to: 'Никто', text: 'эй' });
  assert.match((await a.wait('pmerr')).reason, /не в сети/);
  a.ws.close(); b.ws.close(); await a.closed(); await b.closed();
});

test('PvP: флаг за удар по белому, PK за убийство, карма смывается мобами, в городе нельзя', async () => {
  const mk = async (name) => { const c = client(); await c.open(); c.send({ t: 'register', name, pass: 'pvp12345', save: { ...char(name), lvl: 20 } }); await c.wait('authok'); await c.wait('me'); return c; };
  const a = await mk('Убийца'), b = await mk('Жертва');
  const at = (c, x, z) => c.send({ t: 'st', x, y: 0, z, r: 0, a: 0, hp: 100 });
  // в городе (Светлая Гавань -430,400) — отказ
  at(a, -430, 400); at(b, -428, 400); await new Promise((r) => setTimeout(r, 50));
  a.send({ t: 'pvp', to: 0, atk: 50, mul: 1, school: 'p', range: 3 });
  const ids = await new Promise((res) => { const s = (m) => m.t === 'snap' && m.o.length && res(m.o[0][0]); a.ws.on('message', (d) => s(JSON.parse(d))); });
  a.send({ t: 'pvp', to: ids, atk: 50, mul: 1, school: 'p', range: 3 });
  assert.match((await a.wait('pvperr')).reason, /городе/);
  // на лугу — удар доходит, атакующий флагнут, атака срезана потолком
  at(a, -260, 180); at(b, -258, 180); await new Promise((r) => setTimeout(r, 300));
  a.send({ t: 'pvp', to: ids, atk: 999999, mul: 1, school: 'p', range: 3 });
  const hit = await b.wait('phit');
  assert.ok(hit.atk <= 40 + 20 * 12, `атака не срезана: ${hit.atk}`);
  const me1 = await a.wait('me'); assert.ok(me1.flag > 0 && me1.karma === 0);
  // жертва умерла — убийца PK, объявление на сервер
  b.send({ t: 'pdied', by: a.ws.__id ?? hit.from });
  const me2 = await a.wait('me'); assert.equal(me2.pk, 1); assert.ok(me2.karma > 0);
  assert.match((await b.wait('announce')).text, /стал PK/);
  // убийство мобов смывает карму
  a.send({ t: 'mobkill', xp: 400 });
  const me3 = await a.wait('me'); assert.ok(me3.karma < me2.karma);
  // отмыв за деньги
  a.send({ t: 'wash', coins: 1 }); assert.ok((await a.wait('washerr')).cost > 1);
  a.send({ t: 'wash', coins: 1e6 }); await a.wait('washok'); assert.equal((await a.wait('me')).karma, 0);
  a.ws.close(); b.ws.close(); await a.closed(); await b.closed();
});
