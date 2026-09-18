#!/usr/bin/env bash
# Runs remotely after a complete, verified release has been uploaded.
set -euo pipefail
release=${1:?release directory required}
case "$release" in /opt/realms/releases/*) ;; *) exit 2 ;; esac
cd /opt/realms
backup="${release}/previous"
mkdir -p "$backup"
tar --exclude=server/data -czf "$backup/code.tgz" server src dist package.json package-lock.json
# Install dependencies in staging before stopping the live world.
(cd "$release" && npm ci --omit=dev --silent >/dev/null)
rollback() {
  trap - ERR
  echo 'Promotion failed; restoring previous code.' >&2
  systemctl stop realms-ws
  tar -xzf "$backup/code.tgz" -C /opt/realms
  npm ci --omit=dev --silent >/dev/null
  systemctl start realms-ws
  exit 1
}
trap rollback ERR
systemctl stop realms-ws
# SQLite backup is made on this host; player data never comes from the workstation.
node --no-warnings --input-type=module - "$backup/world.db" <<'JS'
import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('/opt/realms/data/realms.db', { readOnly: true });
const target = process.argv[2].replaceAll("'", "''");
db.exec(`VACUUM INTO '${target}'`); db.close();
JS
rsync -a --delete --exclude data "$release/server/" server/
rsync -a --delete "$release/src/" src/
rsync -a --delete "$release/dist/" dist/
cp "$release/package.json" "$release/package-lock.json" .
rsync -a --delete "$release/node_modules/" node_modules/
systemctl start realms-ws
node --input-type=module <<'JS'
import WebSocket from 'ws';
let connected = false;
for (let attempt = 0; attempt < 15; attempt++) {
  connected = await new Promise(resolve => {
    const ws = new WebSocket('ws://127.0.0.1:8790');
    const timer = setTimeout(() => { ws.terminate(); resolve(false); }, 1500);
    ws.on('error', () => { clearTimeout(timer); resolve(false); });
    ws.on('message', raw => {
      const m = JSON.parse(raw); if (m.t !== 'hi') return;
      clearTimeout(timer); ws.close(); resolve(m.features?.groundLoot === 1 && m.features?.progression === 1 && m.features?.nativeOnly === 1 && m.features?.party === 1);
    });
  });
  if (connected) break;
  await new Promise(r => setTimeout(r, 300));
}
if (!connected) throw Error('Native progression protocol probe failed');
console.log('SERVER_RELEASE_OK groundLoot=1 progression=1 nativeOnly=1 party=1');
JS
systemctl is-active realms-ws
trap - ERR
echo "Release promoted; rollback code and SQLite snapshot are in the release's previous/ directory."
