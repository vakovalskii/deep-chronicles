// Сквозной тест в браузере: npm run test:e2e (поднимает vite сам). Падает с кодом 1 при любой ошибке.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PORT = 5199, URL = `http://localhost:${PORT}/`;
const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
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
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome', headless: process.env.HEADED ? false : true, args: ['--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
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
    await page.waitForSelector('#start-new', { timeout: 15000 });
    expect(await page.isVisible('[data-cls=mage]'), 'нет выбора класса');
  });

  await step('создание персонажа (маг)', async () => {
    await page.fill('#cname', 'Автотест');
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

  await step('инвентарь: экипировка оружия', async () => {
    await G(() => { const g = window.__g; g.P.inv.push({ id: 'staff_oak', n: 1 }); g.P.lvl = Math.max(g.P.lvl, 8); g.useItem('staff_oak'); });
    expect((await G(() => window.__g.P.equip.weapon)) === 'staff_oak', 'посох не надет');
    await page.keyboard.press('KeyI');
    expect((await page.textContent('#inv-eq')).includes('Дубовый жезл'), 'нет в окне экипировки');
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
    expect(await zoneHas('мирная зона', 8000), 'не вернулся в город');
  });

  await step('сохранение переживает перезагрузку', async () => {
    await page.evaluate(() => dispatchEvent(new Event('beforeunload')));
    await page.reload();
    await page.waitForSelector('#start-cont:not([hidden])', { timeout: 10000 });
    expect((await page.textContent('#start-cont')).includes('Автотест'), 'нет кнопки продолжения');
  });

  await step('нет ошибок в консоли', async () => { expect(!errors.length, errors.slice(0, 3).join(' | ')); });
  await browser.close();
} catch (e) {
  failed++; results.push(`  ✗ запуск: ${e.message}`);
} finally {
  server.kill();
}
console.log(`E2E:\n${results.join('\n')}\n${failed ? `ПРОВАЛЕНО: ${failed}` : 'всё прошло'}`);
process.exit(failed ? 1 : 0);
