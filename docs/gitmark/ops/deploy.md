---
node_type: runbook
title: Выкладка на прод
service: server
status: active
updated: 2026-09-18
tags: [deploy, nginx, systemd, ops]
links:
  documents: [deploy/deploy.sh, deploy/nginx-realms.conf, deploy/realms-ws.service]
  depends_on: [docs/gitmark/services/server/README.md]
  relates_to: [docs/gitmark/ops/native-build.md, docs/gitmark/plans/godot-migration.md]
---

# Runbook: выкладка на прод

Прод — https://realms.neuraldeep.ru. Адрес сервера живёт в переменной окружения
`DEPLOY_HOST=user@host` и **в репозиторий не коммитится**, как и `.env`.

```bash
DEPLOY_HOST=... bash deploy/deploy.sh
```

Актуальный конвейер: `deploy/deploy.sh` → `deploy/release.mjs` → `deploy/promote.sh`.

1. Native/server/сайт проверки и обе настольные сборки (`native:verify --headless --offline --release`). С `--verified` допускается готовый успешный отчёт; все хеши входов, результатов и набор файлов проверяются заново.
2. Готовые код, ZIP клиентов и страница скачивания загружаются в `/opt/realms/releases/<commit-time>/`; зависимости устанавливаются в staging.
3. Сохраняются архив предыдущего кода и локальная серверная SQLite-копия; служба останавливается для замены кода. Рабочая БД не приезжает с компьютера и не заменяется.
4. После старта проверяется локальное `hi.features.groundLoot:1`, `progression:1`, `nativeOnly:1`, затем внешний TLS из Godot. При сбое promotion код откатывается. Успешный результат записывается в `.native-run/deployment.json`.

`npm run native:verify -- --release` → `npm run deploy -- --verified` позволяет сначала проверить и собрать клиент, затем выпустить те же проверенные файлы. Подробности: [NATIVE_PIPELINE](docs/NATIVE_PIPELINE.md).

`deploy/quick.sh` остаётся старым ручным путём без резервной копии и полной приёмки; для изменения протокола использовать новый конвейер.

## Что где на хосте

| | |
|---|---|
| статика | `/opt/realms/dist` |
| сервер | `/opt/realms/server`, запуск `node --no-warnings server/server.js` |
| база | `/opt/realms/data/realms.db` (`Environment=DB=…`) |
| порт | 8790 (`Environment=PORT=8790`), только локально |
| служба | systemd `realms-ws`, `Restart=always`, `RestartSec=3`, `User=root` |

[`deploy/nginx-realms.conf`](deploy/nginx-realms.conf): 80 → 443 с дыркой под ACME,
сертификаты certbot, корень `/opt/realms/dist`, `index.html` с `no-cache`, `/assets/` на 30 дней,
`location /ws` → `proxy_pass http://127.0.0.1:8790` с заголовками апгрейда,
`X-Forwarded-For $remote_addr` (**именно его читает лимит попыток входа**),
`proxy_read_timeout 3600s`, SPA-фолбэк на `index.html`.

## Важное

- **`DEV_CMD` в проде нет** — отладочная команда `dev` доступна только автотестам.
- Сервер сам пингует клиентов каждые 25 с, чтобы nginx не рвал простаивающие соединения.
- Профили игроков живут в SQLite на хосте и rsync-ом **не трогаются** (`server/data` исключён).
  Удалять базу — значит обнулить прогресс всем.
- Сейв версии, отличной от `SAVE_VERSION`, молча пересоздаётся. Поднимая версию, считайте,
  что персонажи будут сброшены.

## Выпуск дропа 18.09.2026

Релиз `b9c7fe7dcbd8-20260918T074147720Z` обновил основной сервер и совместимый web-клиент. Внешняя проверка Godot подтвердила TLS и `groundLoot:1`. Сборки macOS/Windows подготовлены локально. Неподнятый дроп живёт до рестарта мира; поднятая награда сохранена в профиле.

## Текущий сайт

Браузерная игра закрыта. `site/` собирается через `tools/site/build.mjs` в `dist/`: страница скачивания, ZIP обеих платформ, SHA-256 и онлайн через анонимный кадр `hi`. `deploy` заменяет старые файлы с `--delete`. Обновлятора/публичной подписи клиентов пока нет. Полный контракт — [DISTRIBUTION.md](docs/DISTRIBUTION.md).
