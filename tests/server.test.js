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
