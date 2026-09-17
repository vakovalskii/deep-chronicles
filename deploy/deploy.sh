#!/usr/bin/env bash
# Релиз: тесты → сборка → выкладка статики на прод. Без зелёных тестов не выкладывает.
set -euo pipefail
cd "$(dirname "$0")/.."
# куда выкладывать: DEPLOY_HOST=user@host bash deploy/deploy.sh
H=${DEPLOY_HOST:?укажите DEPLOY_HOST=user@host}
npm test
rsync -az --delete dist/ $H:/opt/realms/dist/
# WS-сервер: код + общие правила из src/ + зависимости в /opt/realms, перезапуск (игроки переподключатся сами)
rsync -az --delete --exclude data server/ $H:/opt/realms/server/
rsync -az --delete src/ $H:/opt/realms/src/
rsync -az package.json package-lock.json $H:/opt/realms/
scp -q deploy/realms-ws.service $H:/etc/systemd/system/realms-ws.service
ssh $H 'cd /opt/realms && npm ci --omit=dev --silent >/dev/null && systemctl daemon-reload && systemctl enable -q realms-ws && systemctl restart realms-ws && sleep 1 && systemctl is-active realms-ws'
echo "OK → $H"
