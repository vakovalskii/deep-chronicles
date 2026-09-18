// Deterministic economy audit. No invented playtime or assumed player market prices.
import fs from 'node:fs';
import path from 'node:path';
import { root } from './runtime.mjs';
import { CLASSES, ITEMS, MOBS, SETS, RECIPES, xpToNext } from '../../src/data.js';
import { sellPrice, xpForKill } from '../../src/sim.js';
import { skillRanks, spForKill } from '../../src/progression.js';
const money = n => Math.round(n).toLocaleString('ru-RU');
let kills=0,coins=150,sales=0,sp=0;
const checkpoints=[];
for(let lvl=1;lvl<40;lvl++) {
  const mob=Object.values(MOBS).filter(m=>!m.boss&&m.lvl<=lvl).sort((a,b)=>b.lvl-a.lvl)[0];
  const count=Math.ceil(xpToNext(lvl)/xpForKill(mob,lvl));
  const expectedSale=Object.entries(mob.drops||{}).reduce((sum,[id,p])=>sum+sellPrice(ITEMS[id])*p,0);
  kills+=count; coins+=count*(mob.coins[0]+mob.coins[1])/2; sales+=count*expectedSale;sp+=count*spForKill(xpForKill(mob,lvl));
  if([3,5,8,12,18,25,32,40].includes(lvl+1)) checkpoints.push({level:lvl+1,kills,coins:Math.round(coins),optionalSales:Math.round(sales),sp,learn:Object.fromEntries(Object.entries(CLASSES).map(([id,c])=>[id,c.skills.flatMap(skillRanks).filter(s=>s.lvl<=lvl+1).reduce((n,s)=>n+s.sp,0)]))});
}
const gears=[];
for(const grade of ['d','c'])for(const cls of ['warrior','mage']) {
  const set=({d:{warrior:'leather',mage:'apprentice'},c:{warrior:'chain',mage:'mystic'}})[grade][cls];
  const weapon=({d:{warrior:'sword_long',mage:'staff_oak'},c:{warrior:'sword_crystal',mage:'staff_crystal'}})[grade][cls];
  const jewelry=grade==='d'?'bronze':'silver';
  const ids=[weapon,...SETS[set].parts,`ear_${jewelry}`,`ear_${jewelry}`,`neck_${jewelry}`,`ring_${jewelry}`,`ring_${jewelry}`,...(cls==='warrior'?[grade==='d'?'shield_wood':'shield_iron']:[])];
  gears.push({grade,cls,weapon:ITEMS[weapon].price,kit:ids.reduce((n,id)=>n+ITEMS[id].price,0)});
}
const report={assumptions:'Без смертей; ближайший по уровню обычный моб не выше игрока; округление убийств вверх для каждого уровня; монеты без расходов; продажа ВСЕГО случайного дропа приведена отдельно, вещи для экипировки/крафта в таком сценарии не остаются.',checkpoints,gears,recipes:RECIPES};
const lines=['# Расчёт экономики', '', 'Воспроизведение: `npm run native:economy`; обновить этот файл: `npm run native:economy -- --write`.', '', report.assumptions, '', 'Это аудит таблиц, а не замер реального времени игры. Он не учитывает скорость поиска целей, бой, отдых, группы, PvP, покупки, заточку и телепорты. Баланс требует игровых сессий.', '', '| Уровень | Убийств суммарно | Монеты | Доп. продажа всего дропа | SP | Стоимость всех доступных рангов: воин / маг |','|---|---:|---:|---:|---:|---:|',...checkpoints.map(r=>`| ${r.level} | ${money(r.kills)} | ${money(r.coins)} | ${money(r.optionalSales)} | ${money(r.sp)} | ${money(r.learn.warrior)} / ${money(r.learn.mage)} |`),'','| Грейд / класс | Оружие | Оружие, броня, щит и 5 украшений |','|---|---:|---:|',...gears.map(r=>`| ${r.grade.toUpperCase()} / ${CLASSES[r.cls].name} | ${money(r.weapon)} | ${money(r.kit)} |`),'','## Решения','','- Монеты создаются наградами мобов и продажей предметов NPC. Выводятся покупками, изготовлением, телепортами, очищением кармы и заточкой. SP тратятся отдельно, покупки навыков не конкурируют с оружием за монеты.','- Начальные бесплатные вещи нельзя продавать. Все рецепты проверяются на отсутствие прибыли от цикла «изготовить → продать NPC». Цена ингредиентов здесь — их выкупная стоимость, рынка игроков пока нет.','- D/C-оружие можно купить или изготовить дешевле за добытые материалы. Полный комплект собирается постепенно; новый грейд не означает автоматическую выдачу всего набора.','- B-оружие: 8 печатей, 120 кристаллов, 60 эктоплазмы, 12 000 монет. Оба класса платят одинаково. Печать гарантирована победителю босса; дополнительные вещи выпадают независимо.','- Комплект B воина и мага имеет одинаковую суммарную гарантированную цену (12 печатей, 160 кристаллов, 78 эктоплазмы, 16 000 монет). У мага мантия заменяет и верх, и поножи. Щит и украшения приобретаются отдельно.','- Ресурсы выбирают между продажей сейчас и изготовлением позже; печати нельзя продать. Крафт у торговца, 100% успех, материалы и плата сохраняются одной серверной операцией.','- После +3 заточка может уничтожить предмет. Она остаётся добровольным расходом; ранги навыков и обычные рецепты не имеют случайной неудачи.','','## Предел текущего контента','','Обычные мобы заканчиваются на 24 уровне, босс — на 28. Таблица честно показывает резкий рост числа убийств после 30 из-за штрафа опыта. Нельзя считать уровни 32–40 сбалансированным эндгеймом: для следующего расширения нужны новые зоны и обычные мобы этих уровней. Сейчас основной законченный цикл снаряжения — D → C → B на уровнях 8 / 18 / 25. Массовая торговля, кланы, рынок ресурсов и инфляция между игроками ещё не реализованы. Не обещать им готовый баланс.',''];
fs.mkdirSync(path.join(root,'.native-run'),{recursive:true});
fs.writeFileSync(path.join(root,'.native-run/economy.json'),JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(path.join(root,'.native-run/economy.md'),lines.join('\n'));
if(process.argv.includes('--write'))fs.writeFileSync(path.join(root,'docs/ECONOMY_BALANCE.md'),lines.join('\n'));
console.log(lines.slice(6,22).join('\n'));
