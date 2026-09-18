---
node_type: runbook
title: Собрать и проверить нативный клиент
service: godot-client
status: active
updated: 2026-09-18
tags: [build, verify, godot, ci]
links:
  documents: [tools/godot/verify.mjs, tools/godot/run.mjs, tools/godot/build.mjs, docs/NATIVE_PIPELINE.md]
  depends_on: [docs/gitmark/services/godot-client/README.md]
  relates_to: [docs/gitmark/ops/deploy.md]
---

# Runbook: собрать и проверить нативный клиент

Требования: **Node 22.x** (`v22.23.1`, зафиксирована в `.nvmrc`) и **Godot 4.7.2.stable**
с совпадающими шаблонами экспорта. `verify` проверяет обе версии и отказывается работать
на других. Подробный контракт — [docs/NATIVE_PIPELINE.md](docs/NATIVE_PIPELINE.md).

## Где ищется Godot

`tools/godot/runtime.mjs`, в этом порядке: `$GODOT_BIN` → `/Applications/Godot.app/Contents/MacOS/Godot`
→ `~/Applications/Godot.app/...` → `godot`, `godot4`, `Godot.exe` в `PATH`.
Не нашёл — падает с «Godot 4.7.2 не найден». Свой путь: `GODOT_BIN=/путь/к/Godot npm run dev`.

## Запуск

| команда | что делает |
|---|---|
| `npm run dev` / `npm run native` | экспорт ассетов → импорт проекта → клиент против **боевого** сервера, с `--resume` |
| `npm run native:local` | то же, но поднимает локальный сервер на 8790 с базой `.native-run/world.db`, флаг `--quick-start` |
| `npm run native:editor` | открыть проект в редакторе Godot |
| `npm run native:assets` | только пересобрать `godot/generated/` |

Полезные флаги `run.mjs`: `--server=<url>`, `--built` (запустить собранное приложение из
`godot/builds/macos/`), `--skip-assets`, `--foreground`.
Клиент уходит в фон, логи и PID — в `.native-run/`.

> Локальный сервер поднимается **только** если адрес петлевой и на `hi`-рукопожатие за 1.5 с
> никто не ответил. Локальные сохранения в прод не переносятся: токены разделены по адресу
> сервера (`user://sessions.json`), для основного персонажа нужен вход в тот же аккаунт.

## Проверка

```bash
npm run native:verify -- --build=macos     # цели: macos | windows | android | ios
npm run native:verify -- --offline         # без шага к боевому серверу
```

Шаги (`tools/godot/verify.mjs`), каждый падает по ненулевому коду **или** по строкам
`SCRIPT ERROR:` / `^ERROR:` / `FAIL:` в выводе:

1. `rules` — юнит-тесты правил
2. `server` — тесты сервера
3. `client-server` — нативный smoke (`tools/godot/test.mjs`)
4. дайджест `catalog.json` / `world.json` / `heights.bin`
5. `weapons` — хват оружия в шести позах
6. `main-server` — проба боевого сервера (пропускается при `--offline`)
7. `build-<цель>` и дайджест артефакта — если передан `--build=`

Отчёт: `.native-run/verification/report.json` — коммит, признак «грязного» дерева, версии
инструментов, тайминги шагов и SHA-256 всех отслеживаемых git-ом входов
(`godot/`, `tools/godot`, `src`, `server`, `public/assets`).

Чего отчёт **не** утверждает: что ZIP побайтово одинаков между машинами и что `--offline`
как-то свидетельствует о живости боевого сервера.

## Точечные проверки

```bash
npm run test:native      # только smoke против временного сервера
npm run native:weapons   # хват оружия + скриншот
npm run native:probe     # TLS и кадр `hi` от боевого сервера, без входа в аккаунт
npm run native:gallery   # витрина моделей в PNG для художественной приёмки
npm run native:build -- macos   # только сборка
```

Артефакты тестов — `.native-run/test-artifacts` (или `test-touch-artifacts` при `--touch`),
сборки — `godot/builds/<цель>/`.

## Если упало

- `NATIVE_READY` не появился → клиент не собрал сцену; смотреть лог в `.native-run/`.
- `checks=N failures=0` нет в выводе → smoke не дошёл до конца, там же причина.
- Расхождение статов в экспортированных фикстурах → разъехались `data.gd` и `src/stats.js`; чинить зеркало
  в клиенте, не правила.
- Пустая или старая `godot/generated/` → `npm run native:assets`; руками её не правят.

## Полный выпуск

`npm run native:verify -- --release` дополнительно строит macOS и Windows ZIP, расчёт экономики и сайт скачивания, проверяет страницу с реальным временным сервером. Нужен Python 3 для ZIP Windows. Затем `npm run deploy -- --verified`. Браузерная игра закрыта, `--web` больше не поддерживается. Подробности и источники истины — [NATIVE_PIPELINE](docs/NATIVE_PIPELINE.md).
