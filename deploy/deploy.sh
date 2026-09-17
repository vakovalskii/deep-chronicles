#!/usr/bin/env bash
# Релиз: тесты → сборка → выкладка статики на прод. Без зелёных тестов не выкладывает.
set -euo pipefail
cd "$(dirname "$0")/.."
H=root@92.255.78.10
npm test
rsync -az --delete dist/ $H:/opt/realms/dist/
# WS-сервер: код + общие правила из src/ + зависимости в /opt/realms, перезапуск (игроки переподключатся сами)
rsync -az --delete --exclude data server/ $H:/opt/realms/server/
rsync -az --delete src/ $H:/opt/realms/src/
rsync -az package.json package-lock.json $H:/opt/realms/
scp -q deploy/realms-ws.service $H:/etc/systemd/system/realms-ws.service
ssh $H 'cd /opt/realms && npm ci --omit=dev --silent >/dev/null && systemctl daemon-reload && systemctl enable -q realms-ws && systemctl restart realms-ws && sleep 1 && systemctl is-active realms-ws'
echo "OK → https://realms.neuraldeep.ru"
