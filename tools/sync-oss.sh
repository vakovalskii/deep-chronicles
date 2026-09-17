#!/usr/bin/env bash
# Перенос текущей версии в публичный репозиторий (vakovalskii/khroniki-glubin): bash tools/sync-oss.sh "сообщение"
# Берутся только файлы из git (git archive), проверяется отсутствие адресов серверов и ключей.
set -euo pipefail
cd "$(dirname "$0")/.."
OSS=${OSS_DIR:-$HOME/khroniki-glubin}
MSG=${1:-"Обновление из основной ветки"}
[ -d "$OSS/.git" ] || git clone -q https://github.com/vakovalskii/khroniki-glubin "$OSS"
git -C "$OSS" pull -q
# переносим: сначала снимаем старые файлы из индекса копии, потом распаковываем новые
git -C "$OSS" ls-files -z | (cd "$OSS" && xargs -0 git rm -q --cached)
git ls-files -z | xargs -0 -I{} dirname {} | sort -u >/dev/null
git archive HEAD | tar -x -C "$OSS"
if grep -rnE "sk-or-|BEGIN (RSA|OPENSSH)|[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}" "$OSS" --exclude-dir=.git --exclude=package-lock.json --exclude=LICENSE | grep -v "127.0.0.1" ; then
  echo "Найдены адреса или ключи — синхронизация остановлена"; exit 1
fi
cd "$OSS" && git add -A && git ls-files --deleted -z | xargs -0 -r git rm -q
git diff --cached --quiet && { echo "Нет изменений"; exit 0; }
git commit -qm "$MSG" && git push -q && git log --oneline -1
