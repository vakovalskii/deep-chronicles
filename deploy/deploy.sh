#!/usr/bin/env bash
# Релиз: тесты → сборка → выкладка статики на прод. Без зелёных тестов не выкладывает.
set -euo pipefail
cd "$(dirname "$0")/.."
H=root@92.255.78.10
npm test
rsync -az --delete dist/ $H:/opt/realms/dist/
echo "OK → https://realms.neuraldeep.ru"
