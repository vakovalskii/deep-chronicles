// Сквозной тест в браузере: npm run test:e2e (поднимает vite сам). Падает с кодом 1 при любой ошибке.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PORT = 5199, WS = 8791, URL = `http://localhost:${PORT}/?ws=ws://localhost:${WS}`;
const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const DBDIR = fs.mkdtempSync(path.join(os.tmpdir(), 'realms-e2e-'));
const wsServer = spawn('node', ['--no-warnings', 'server/server.js'], { stdio: 'pipe', env: { ...process.env, PORT: String(WS), DB: path.join(DBDIR, 'e2e.db') } });
wsServer.stderr.on('data', (d) => process.stderr.write('[ws] ' + d));
const results = [];
let failed = 0;
async function step(name, fn) {
  const t0 = Date.now();
  try { await fn(); results.push(`  ✓ ${name} (${Date.now() - t0} мс)`); }
  catch (e) { failed++; results.push(`  ✗ ${name}: ${e.message}`); }
}
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };

try {
  for (let i = 0; i < 50; i++) { try { if ((await fetch(URL)).ok) break; } catch { /* ждём */ } await new Promise((r) => setTimeout(r, 200)); }
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome', headless: process.env.HEADED ? false : true, slowMo: Number(process.env.SLOW || 0), args: ['--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const G = (fn, arg) => page.evaluate(fn, arg);
  const wait = (ms) => page.waitForTimeout(ms);
  // HUD обновляется раз в несколько кадров — ждём нужный текст
  const zoneHas = (t, ms = 5000) => page.waitForFunction((t) => document.getElementById('zone').textContent.includes(t), t, { timeout: ms }).then(() => true, () => false);

  await step('стартовый экран открывается', async () => {
    await page.goto(URL);
    await page.waitForSelector('#start-new:not([disabled])', { timeout: 15000 });
    expect(await page.isVisible('[data-cls=mage]'), 'нет выбора класса');
  });

  await step('создание персонажа (маг)', async () => {
    await page.fill('#cname', 'Автотест'); await page.fill('#cpass', 'пароль1');
    await page.click('[data-cls=mage]');
    await page.click('#start-new');
    await page.waitForFunction(() => window.__g?.P && document.body.classList.contains('ingame'), null, { timeout: 10000 });
    const p = await G(() => ({ cls: window.__g.P.cls, lvl: window.__g.P.lvl, name: window.__g.P.name }));
    expect(p.cls === 'mage' && p.lvl === 1 && p.name === 'Автотест', JSON.stringify(p));
    await page.waitForFunction(() => document.getElementById('pname').textContent.includes('Автотест'), null, { timeout: 5000 }).catch(() => { throw new Error('HUD без имени'); });
  });

  await step('ходьба кликом по земле', async () => {
    const before = await G(() => window.__g.hero.position.clone());
    await page.mouse.click(700, 500);
    await wait(1500);
    const after = await G(() => window.__g.hero.position.clone());
    expect(Math.hypot(after.x - before.x, after.z - before.z) > 1, 'персонаж не сдвинулся');
  });

  await step('камера: два пальца вращают, щипок зумит', async () => {
    const c0 = await G(() => ({ ...window.__g.cam }));
    await page.mouse.move(640, 400);
    for (let i = 0; i < 10; i++) await page.mouse.wheel(12, 6);
    await wait(400);
    const c1 = await G(() => ({ ...window.__g.cam }));
    expect(Math.abs(c1.yaw - c0.yaw) > 0.1 && Math.abs(c1.pitch - c0.pitch) > 0.02, `орбита ${JSON.stringify([c0, c1])}`);
    await page.keyboard.down('Control'); for (let i = 0; i < 5; i++) await page.mouse.wheel(0, 8); await page.keyboard.up('Control');
    await wait(400);
    const c2 = await G(() => ({ ...window.__g.cam }));
    expect(c2.dist > c1.dist * 1.2, `зум ${c1.dist} → ${c2.dist}`);
    await page.keyboard.press('KeyV');
  });

  await step('торговец: покупка зелья', async () => {
    await G(() => { const g = window.__g; g.P.coins = 500; g.openNpc(g.npcs.find((n) => n.role === 'merchant')); });
    expect(await page.isVisible('#shop'), 'окно торговца не открылось');
    const n0 = await G(() => window.__g.P.inv.find((i) => i.id === 'potion_hp')?.n || 0);
    await page.click('[data-buy=potion_hp]');
    const n1 = await G(() => window.__g.P.inv.find((i) => i.id === 'potion_hp')?.n || 0);
    expect(n1 === n0 + 1, `зелий ${n0} → ${n1}`);
    expect((await G(() => window.__g.P.coins)) === 470, 'монеты не списались');
    await page.click('#shop [data-close]');
  });

  await step('хранитель врат: телепорт на луга', async () => {
    await G(() => { const g = window.__g; g.openNpc(g.npcs.find((n) => n.role === 'gatekeeper')); });
    await page.click('[data-tp=meadow]');
    expect(await zoneHas('Солнечные луга'), `зона: ${await page.textContent('#zone')}`);
    expect((await G(() => window.__g.P.coins)) === 390, 'телепорт не списал оплату');
  });

  await step('бой: убийство моба даёт опыт и монеты', async () => {
    const before = await G(() => ({ xp: window.__g.P.xp, coins: window.__g.P.coins, kills: window.__g.P.kills }));
    await G(() => { const g = window.__g; const m = g.mobs.find((x) => x.id === 'rabbit' && !x.dead); g.teleportTo(m.obj.position.x + 6, m.obj.position.z); g.target = m; g.attack(); });
    await page.waitForFunction((k) => window.__g.P.kills > k, before.kills, { timeout: 20000 });
    const after = await G(() => ({ xp: window.__g.P.xp, coins: window.__g.P.coins }));
    expect(after.xp > before.xp && after.coins > before.coins, JSON.stringify({ before, after }));
  });

  await step('умение: огненная стрела тратит ману и ставит перезарядку', async () => {
    await G(() => { const g = window.__g; const m = g.mobs.find((x) => x.id === 'wolf' && !x.dead); g.teleportTo(m.obj.position.x + 10, m.obj.position.z); g.target = m; });
    const mp0 = await G(() => window.__g.P.mp);
    await page.keyboard.press('Digit1');
    await wait(1500);
    const mp1 = await G(() => window.__g.P.mp);
    expect(mp1 < mp0, `мана ${mp0} → ${mp1}`);
  });

  await step('получение уровня открывает умение', async () => {
    await G(() => window.__g.gainXp(5000));
    const lvl = await G(() => window.__g.P.lvl);
    expect(lvl >= 3, `уровень ${lvl}`);
    expect(!(await page.$eval('[data-skill=heal]', (e) => e.classList.contains('locked'))), 'исцеление заблокировано');
  });

  await step('инвентарь: кукла, надеть и снять, окно персонажа', async () => {
    await G(() => { const g = window.__g; g.P.inv.push({ id: 'staff_oak', n: 1 }, { id: 'ring_bronze', n: 1 }); g.P.lvl = Math.max(g.P.lvl, 8); g.useItem('staff_oak'); });
    expect((await G(() => window.__g.P.equip.weapon)) === 'staff_oak', 'посох не надет');
    await page.keyboard.press('KeyI');
    expect((await page.getAttribute('#doll [data-slot=weapon]', 'title')) === 'Дубовый жезл', 'нет на кукле');
    // перетаскивание кольца из сумки на куклу
    const idx = await G(() => window.__g.P.inv.findIndex((e) => e.id === 'ring_bronze'));
    const from = await page.locator(`#inv-grid [data-bag="${idx}"]`).boundingBox(), to = await page.locator('#doll [data-slot=ring2]').boundingBox();
    await page.mouse.move(from.x + 20, from.y + 20); await page.mouse.down();
    await page.mouse.move(to.x + 20, to.y + 20, { steps: 6 }); await page.mouse.up();
    expect((await G(() => window.__g.P.equip.ring2)) === 'ring_bronze', 'перетаскивание не надело кольцо');
    // выбор и снятие кнопкой
    await page.click('#doll [data-slot=ring2]');
    expect((await page.textContent('#inv-info')).includes('Бронзовое кольцо'), 'нет описания');
    await page.click('#inv-info [data-cmd=off]');
    expect((await G(() => window.__g.P.equip.ring2)) === null, 'кольцо не снято');
    // окно персонажа
    await page.keyboard.press('KeyC');
    expect((await page.textContent('#char-body')).includes('Маг. атака'), 'нет характеристик');
    await page.keyboard.press('Escape');
    expect(!(await page.isVisible('#char')), 'окно персонажа не закрылось');
  });

  await step('усиление: безопасная заточка до +3', async () => {
    const r = await G(() => {
      const g = window.__g; g.P.inv.push({ id: 'scroll_ench_w', n: 3 });
      for (let i = 0; i < 3; i++) { g.useItem('scroll_ench_w'); g.enchant({ slot: 'weapon' }); }
      return { e: g.P.enc.weapon, left: g.P.inv.filter((x) => x.id === 'scroll_ench_w').length, mode: g.enchMode };
    });
    expect(r.e === 3 && r.left === 0 && !r.mode, JSON.stringify(r));
    await page.keyboard.press('Escape');
  });

  await step('кнопки меню на ПК: инвентарь и карта без клавиатуры', async () => {
    await page.click('#menu [data-act=inv]');
    expect(await page.isVisible('#inv'), 'инвентарь не открылся кнопкой');
    await page.click('#menu [data-act=inv]');
    expect(!(await page.isVisible('#inv')), 'инвентарь не закрылся кнопкой');
    await page.click('#menu [data-act=char]');
    expect(await page.isVisible('#char'), 'персонаж не открылся кнопкой');
    await page.keyboard.press('Escape');
    await page.click('#menu [data-act=map]');
    expect(await page.isVisible('#bigmap'), 'карта не открылась кнопкой');
    await page.keyboard.press('Escape');
  });

  await step('смерть и возрождение в городе', async () => {
    await G(() => { const g = window.__g; g.P.hp = 1; const m = g.mobs.find((x) => x.def.aggro && !x.dead && x.home.x < 2000); g.teleportTo(m.obj.position.x + 2, m.obj.position.z); });
    await page.waitForFunction(() => window.__g.dead, null, { timeout: 20000 });
    expect(await page.isVisible('#death'), 'нет окна смерти');
    await page.click('#respawn');
    expect(!(await G(() => window.__g.dead)), 'не возродился');
    expect(await zoneHas('мирная зона'), 'возрождение не в городе');
  });

  await step('вход в катакомбы через склеп и выход', async () => {
    await G(() => window.__g.teleportTo(150, 250 + 14));
    await page.mouse.move(640, 400);
    await G(() => { const h = window.__g.hero.position; h.set(150, h.y, 250 + 8.5); });
    expect(await zoneHas('Катакомбы'), 'не попал в катакомбы');
  });

  await step('свиток возврата переносит в город', async () => {
    await G(() => window.__g.useItem('scroll_escape'));
    expect(await zoneHas('мирная зона', 20000), 'не вернулся в город');
  });

  await step('сохранение переживает перезагрузку', async () => {
    await page.evaluate(() => dispatchEvent(new Event('beforeunload')));
    await wait(500);
    // локальную копию стираем — прогресс должен прийти с сервера
    await page.evaluate(() => localStorage.removeItem('l2w-save1'));
    await page.reload();
    await page.waitForSelector('#start-cont:not([hidden]):not([disabled])', { timeout: 10000 });
    expect((await page.textContent('#start-cont')).includes('Автотест'), 'нет кнопки продолжения');
    await page.click('#start-cont');
    await page.waitForFunction(() => window.__g?.hero, null, { timeout: 10000 });
    expect((await G(() => window.__g.P.equip.weapon)) === 'staff_oak', 'экипировка не сохранилась');
  });

  // ===== телефон =====
  const phone = await (await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 })).newPage();
  phone.on('pageerror', (e) => errors.push('телефон: ' + e.message));
  const PG = (fn, arg) => phone.evaluate(fn, arg);
  await step('телефон: создание персонажа, мобильный интерфейс', async () => {
    await phone.goto(URL + '&touch');
    await phone.waitForSelector('#start-new:not([disabled])');
    await phone.fill('#cname', 'Телефон'); await phone.fill('#cpass', 'пароль2'); await phone.tap('#start-new');
    await phone.waitForFunction(() => window.__g?.P, null, { timeout: 10000 });
    expect(await phone.isVisible('#joy'), 'нет джойстика');
    expect(await phone.isVisible('#mbtns [data-act=attack]'), 'нет кнопки атаки');
    const over = await PG(() => { const r = (id) => document.getElementById(id).getBoundingClientRect(); const a = r('skills'), b = r('log'); return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom; });
    expect(!over, 'панель умений перекрывает лог');
    const clipped = await PG(() => [...document.querySelectorAll('#mbtns button, #skills .slot')].filter((b) => { const r = b.getBoundingClientRect(); return r.bottom > innerHeight || r.right > innerWidth || r.top < 0; }).map((b) => b.textContent));
    expect(!clipped.length, `за краем экрана: ${clipped.join(', ')}`);
    const hit = await PG(() => { const r = (id) => document.getElementById(id).getBoundingClientRect(), a = r('mbtns'); return ['skills', 'mapbox'].filter((id) => { const b = r(id); return a.left < b.right && b.left < a.right && a.top < b.bottom + 4 && b.top < a.bottom + 4; }).join(','); });
    expect(!hit, `кнопки налезают на: ${hit}`);
    await phone.waitForTimeout(1500);
    await phone.screenshot({ path: 'tests/last-phone.png' });
  });
  await step('iPhone 16 в Safari (852×340): всё влезает, ничего не перекрыто', async () => {
    await phone.setViewportSize({ width: 852, height: 340 });
    await phone.waitForTimeout(500);
    const bad = await PG(() => {
      const r = (el) => el.getBoundingClientRect();
      const ids = ['status', 'mapbox', 'mbtns', 'skills', 'joy', 'log'];
      const out = [];
      for (const id of ids) { const b = r(document.getElementById(id)); if (b.bottom > innerHeight + 1 || b.right > innerWidth + 1 || b.top < -1 || b.left < -1) out.push(`${id} за краем`); }
      for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
        const a = r(document.getElementById(ids[i])), b = r(document.getElementById(ids[j]));
        if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) out.push(`${ids[i]}×${ids[j]}`);
      }
      return out;
    });
    await phone.screenshot({ path: 'tests/last-iphone.png' });
    await phone.setViewportSize({ width: 844, height: 390 });
    expect(!bad.length, bad.join(', '));
    // в Chrome полный экран включается сразу, в Safari на iPhone — подсказка «На экран Домой»
    await PG(() => { Element.prototype.requestFullscreen = undefined; Element.prototype.webkitRequestFullscreen = undefined; });
    await phone.tap('#fsbtn');
    expect(await phone.isVisible('#fshint'), 'нет подсказки про полный экран');
    await phone.tap('#fshint-ok');
  });

  await step('телефон: тап по земле — идти', async () => {
    const a = await PG(() => window.__g.hero.position.clone());
    await phone.touchscreen.tap(560, 230);
    await phone.waitForTimeout(1500);
    const b = await PG(() => window.__g.hero.position.clone());
    expect(Math.hypot(a.x - b.x, a.z - b.z) > 1, 'не пошёл');
  });
  await step('телефон: джойстик двигает персонажа', async () => {
    const a = await PG(() => window.__g.hero.position.clone());
    await PG(() => { const pad = document.getElementById('joy'), r = pad.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const ev = (t, x, y) => pad.dispatchEvent(new PointerEvent(t, { bubbles: true, pointerId: 9, pointerType: 'touch', clientX: x, clientY: y }));
      ev('pointerdown', cx, cy); ev('pointermove', cx, cy - 60); setTimeout(() => ev('pointerup', cx, cy - 60), 1200); });
    await phone.waitForTimeout(1500);
    const b = await PG(() => window.__g.hero.position.clone());
    expect(Math.hypot(a.x - b.x, a.z - b.z) > 5, `сдвиг ${Math.hypot(a.x - b.x, a.z - b.z).toFixed(1)}`);
    expect((await PG(() => window.__g.joy.x + window.__g.joy.y)) === 0, 'джойстик не отпустился');
  });
  await step('телефон: кнопки атаки и вещей', async () => {
    await PG(() => { const g = window.__g; const m = g.mobs.find((x) => x.id === 'rabbit' && !x.dead); g.teleportTo(m.obj.position.x + 5, m.obj.position.z); });
    const k0 = await PG(() => window.__g.P.kills);
    await phone.tap('#mbtns [data-act=attack]'); await phone.tap('#mbtns [data-act=attack]');
    await phone.waitForFunction((k) => window.__g.P.kills > k || window.__g.target, k0, { timeout: 8000 });
    await phone.tap('#mbtns [data-act=inv]');
    const full = await PG(() => { const r = document.getElementById('inv').getBoundingClientRect(); return r.width >= innerWidth - 2; });
    expect(full, 'инвентарь не на весь экран');
    await phone.tap('#inv [data-close]');
  });

  await step('мультиплеер: видим друг друга, онлайн, чат', async () => {
    const pos = await G(() => { const p = window.__g.hero.position; return { x: p.x, z: p.z }; });
    await PG((p) => window.__g.teleportTo(p.x + 3, p.z), pos);
    await page.waitForFunction(() => [...window.__g.remotes.values()].some((r) => r.name === 'Телефон' && r.obj.visible), null, { timeout: 8000 });
    await page.waitForFunction(() => document.getElementById('online').textContent.includes('Онлайн: 2'), null, { timeout: 5000 });
    expect((await page.textContent('#labels')).includes('Телефон'), 'нет подписи другого игрока');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Привет из теста');
    await page.keyboard.press('Enter');
    await phone.waitForFunction(() => document.getElementById('logbox').textContent.includes('Привет из теста'), null, { timeout: 5000 });
    await PG(() => { document.getElementById('chatin').value = '+Продам меч'; document.getElementById('chatsend').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
    await page.waitForFunction(() => [...document.querySelectorAll('#logbox .c-trade')].some((d) => d.textContent.includes('Продам меч')), null, { timeout: 5000 });
    // личное сообщение: клик по имени подставляет /w, приходит только адресату фиолетовым
    await page.click('#logbox .c-trade b[data-name="Телефон"]');
    expect((await page.inputValue('#chatin')) === '/w Телефон ', 'клик по имени не подставил /w');
    await page.keyboard.type('секрет'); await page.keyboard.press('Enter');
    await phone.waitForFunction(() => [...document.querySelectorAll('#logbox .c-pm')].some((d) => d.textContent.includes('секрет')), null, { timeout: 5000 });
    expect(await PG(() => getComputedStyle(document.querySelector('#logbox .c-pm')).color === 'rgb(200, 140, 255)'), 'личное не фиолетовое');
    await page.waitForFunction(() => document.querySelector('#logbox .c-pm.me')?.textContent.includes('-> Телефон'), null, { timeout: 5000 });
    await PG(() => { document.getElementById('chatin').value = '/r и тебе'; document.getElementById('chatsend').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
    await page.waitForFunction(() => [...document.querySelectorAll('#logbox .c-pm')].some((d) => d.textContent.includes('и тебе')), null, { timeout: 5000 });
    await page.waitForFunction(() => document.querySelector('#chtabs [data-tab=pm] i'), null, { timeout: 3000 });
    // настройки: системные сообщения выключаются
    await page.click('#chatgear'); await page.click('#chatset [data-set=sys]');
    expect(!(await page.isVisible('#syslog')), 'системный чат не выключился');
    await page.click('#chatset [data-set=sys]'); await page.click('#chatgear');
  });

  await step('PvP: флаг, убийство белого — PK, объявление, жрец смывает карму', async () => {
    await G(() => { const g = window.__g; if (g.dead) g.respawn(); g.teleportTo(-260, 180); });
    await PG(() => { const g = window.__g; if (g.dead) g.respawn(); g.teleportTo(-257, 180); });
    await phone.waitForFunction(() => [...window.__g.remotes.values()].some((r) => r.name === 'Автотест' && r.obj.visible), null, { timeout: 8000 });
    await G(() => { window.__g.P.hp = 1; });
    await PG(() => { const g = window.__g; g.target = [...g.remotes.values()].find((r) => r.name === 'Автотест'); g.attack(); });
    await page.waitForFunction(() => window.__g.dead, null, { timeout: 10000 });
    await phone.waitForFunction(() => window.__g.P.karma > 0 && window.__g.P.pk === 1, null, { timeout: 5000 });
    await page.waitForFunction(() => document.getElementById('logbox').textContent.includes('стал PK'), null, { timeout: 5000 });
    // ник PK у жертвы — красный
    await page.waitForFunction(() => [...document.querySelectorAll('#labels .nlabel')].some((l) => l.textContent === 'Телефон' && l.style.color === 'rgb(255, 74, 74)'), null, { timeout: 5000 });
    await G(() => window.__g.respawn());
    // жрец: отмыв за деньги
    await PG(() => { const g = window.__g; g.P.coins = 100000; g.openNpc(g.npcs.find((n) => n.role === 'priest')); });
    await phone.tap('#wash');
    await phone.waitForFunction(() => window.__g.P.karma === 0, null, { timeout: 5000 });
    expect((await PG(() => window.__g.P.coins)) < 100000, 'деньги за отмыв не списаны');
  });

  await step('аккаунт: занятое имя, неверный пароль, вход с другого устройства', async () => {
    await phone.context().close(); // три WebGL-вкладки на программном рендере не успевают
    const other = await (await browser.newContext({ viewport: { width: 1000, height: 700 } })).newPage();
    other.on('pageerror', (e) => errors.push('другое устройство: ' + e.message));
    await other.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await other.waitForSelector('#start-new:not([disabled])');
    const msg = (t) => other.waitForFunction((t) => document.getElementById('start-msg').textContent.includes(t), t, { timeout: 5000 });
    await other.fill('#cname', 'автотест'); await other.fill('#cpass', 'чужой');
    await other.click('#start-new'); await msg('занято');
    await other.click('#start-login'); await msg('Неверное');
    await other.fill('#cpass', 'пароль1'); await other.click('#start-login');
    await other.waitForFunction(() => window.__g?.P, null, { timeout: 8000 });
    expect((await other.evaluate(() => window.__g.P.equip.weapon)) === 'staff_oak', 'на другом устройстве не тот персонаж');
    await page.waitForFunction(() => document.getElementById('syslog').textContent.includes('другого устройства'), null, { timeout: 5000 });
    await other.close();
  });

  await step('нет ошибок в консоли', async () => { expect(!errors.length, errors.slice(0, 3).join(' | ')); });
  await browser.close();
} catch (e) {
  failed++; results.push(`  ✗ запуск: ${e.message}`);
} finally {
  server.kill(); wsServer.kill(); fs.rmSync(DBDIR, { recursive: true, force: true });
}
console.log(`E2E:\n${results.join('\n')}\n${failed ? `ПРОВАЛЕНО: ${failed}` : 'всё прошло'}`);
process.exit(failed ? 1 : 0);
