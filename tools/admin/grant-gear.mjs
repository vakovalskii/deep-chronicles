// Offline maintenance only: stop the game service first so its live state cannot
// overwrite the transaction. Dry-run by default; backups stay beside the DB.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { ITEMS, SLOTS } from '../../src/data.js';
import { calcStats, MAX_ENCH } from '../../src/stats.js';

export function topGearProfile(original, level = 25) {
  if (!['warrior', 'mage'].includes(original.cls) || original.v !== 3) throw Error('Unsupported character profile');
  const p = structuredClone(original); p.lvl = level; p.xp = 0;
  const mage = p.cls === 'mage';
  const gear = { ear1: 'ear_lich', ear2: 'ear_lich', neck: 'neck_lich', ring1: 'ring_lich', ring2: 'ring_lich',
    weapon: mage ? 'staff_abyss' : 'sword_dragon', head: mage ? 'hat_abyss' : 'helm_bone',
    armor: mage ? 'robe_abyss' : 'armor_bone', gloves: mage ? 'gloves_abyss' : 'gloves_bone',
    feet: mage ? 'boots_abyss' : 'boots_bone', legs: mage ? null : 'legs_bone', shield: mage ? null : 'shield_bone' };
  p.inv ||= []; p.enc ||= {}; p.equip ||= {};
  for (const {id, type} of SLOTS) {
    const next = gear[id], old = p.equip[id];
    if (next && (ITEMS[next].slot !== type || (ITEMS[next].lvl || 1) > level)) throw Error(`Cannot equip ${next}`);
    if (old && old !== next) p.inv.push({ id: old, n: 1, ...(p.enc[id] ? { e: p.enc[id] } : {}) });
    p.equip[id] = next; p.enc[id] = next ? MAX_ENCH : 0;
  }
  const stats = calcStats(p); p.hp = stats.maxHp; p.mp = stats.maxMp; p.dead = false;
  return p;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), value = key => args.find(a => a.startsWith(key + '='))?.slice(key.length+1);
  const file = value('--db'), names = value('--names')?.split(',').map(n => n.trim().toLowerCase()), level = Number(value('--level') || 25);
  if (!file || !names?.length || level !== 25 || names.some(n => !/^[\p{L}\p{N}_-]{3,16}$/u.test(n))) throw Error('Use --db=... --names=name1,name2 --level=25 [--apply --offline]');
  const apply = args.includes('--apply');
  if (apply && !args.includes('--offline')) throw Error('Stop the service and acknowledge --offline before applying');
  const db = new DatabaseSync(file, { readOnly: !apply });
  const rows = names.map(name => {
    const row = db.prepare('SELECT key,name,save FROM accounts WHERE key=?').get(name);
    if (!row?.save) throw Error(`Character missing: ${name}`);
    return { ...row, next: topGearProfile(JSON.parse(row.save), level) };
  });
  if (apply) {
    const backup = path.join(path.dirname(file), 'admin-backups', Date.now() + '-top-gear.db');
    fs.mkdirSync(path.dirname(backup), { recursive: true, mode: 0o700 });
    db.exec(`VACUUM INTO '${backup.replaceAll("'", "''")}'`); fs.chmodSync(backup, 0o600);
    db.exec('BEGIN IMMEDIATE');
    try {
      const update = db.prepare('UPDATE accounts SET save=?,saved=? WHERE key=? AND save=?');
      for (const row of rows) if (update.run(JSON.stringify(row.next), Date.now(), row.key, row.save).changes !== 1) throw Error('Concurrent profile change');
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
  }
  for (const row of rows) console.log(JSON.stringify({ name: row.name, applied: apply, level: row.next.lvl, cls: row.next.cls, equipment: row.next.equip, enchant: MAX_ENCH, previousItemsPreserved: true }));
  db.close();
}
