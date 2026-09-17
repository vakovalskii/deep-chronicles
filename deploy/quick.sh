#!/usr/bin/env bash
# Быстрая выкладка без тестов: сборка → rsync только изменившегося → рестарт WS при правках сервера.
# DEPLOY_HOST=user@host bash deploy/quick.sh        — клиент (dist), ~10 с
# DEPLOY_HOST=user@host bash deploy/quick.sh --ws   — ещё и сервер с рестартом (игроков разорвёт на пару секунд)
set -euo pipefail
cd "$(dirname "$0")/.."
H=${DEPLOY_HOST:?укажите DEPLOY_HOST=user@host}
t0=$SECONDS
npx vite build >/dev/null
rsync -az --delete dist/ "$H:/opt/realms/dist/"
if [ "${1:-}" = "--ws" ]; then
  rsync -az --delete --exclude data server/ "$H:/opt/realms/server/"
  rsync -az --delete src/ "$H:/opt/realms/src/"
  ssh "$H" 'systemctl restart realms-ws && sleep 1 && systemctl is-active realms-ws'
fi
echo "выложено за $((SECONDS - t0)) с → $H  (клиенты увидят кнопку обновления в течение минуты)"
