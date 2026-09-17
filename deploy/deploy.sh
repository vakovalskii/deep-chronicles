#!/usr/bin/env bash
# Релиз: тесты → сборка → выкладка статики на прод. Без зелёных тестов не выкладывает.
set -euo pipefail
cd "$(dirname "$0")/.."
H=root@92.255.78.10
npm test
rsync -az --delete dist/ $H:/opt/realms/dist/
# WS-сервер: код + зависимости, перезапуск (игроки переподключатся сами)
rsync -az --exclude data server/ package.json package-lock.json $H:/opt/realms/server/
scp -q deploy/realms-ws.service $H:/etc/systemd/system/realms-ws.service
ssh $H 'cd /opt/realms/server && npm ci --omit=dev --silent >/dev/null && systemctl daemon-reload && systemctl enable -q realms-ws && systemctl restart realms-ws && sleep 1 && systemctl is-active realms-ws'
echo "OK → https://realms.neuraldeep.ru"
