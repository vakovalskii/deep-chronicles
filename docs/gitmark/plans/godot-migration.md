---
node_type: plan
title: Переезд клиента на Godot — состояние и хвосты
service: _platform
status: active
updated: 2026-09-18
tags: [migration, godot, roadmap]
links:
  documents: [godot/, tools/godot/]
  depends_on: [docs/gitmark/decisions/2026-09-18-native-godot-client.md]
  relates_to: [docs/gitmark/services/godot-client/README.md, docs/gitmark/services/web-client/README.md, docs/gitmark/ops/native-build.md]
---

# Переезд клиента на Godot: состояние на 2026-09-18

Ветка `server-authoritative`. Решение и его обоснование —
[отдельный документ](docs/gitmark/decisions/2026-09-18-native-godot-client.md);
здесь только «что уже есть, что в работе, что не сделано».

## Сделано

Коммит `5f84e76 Migrate primary client to Godot with textured world and restored UI` —
основной переезд: проект Godot, текстурированный мир, восстановленный интерфейс, концепты,
ассеты, документы в `docs/`.

- Клиент на Godot 4.7.2 играбелен против боевого сервера; `npm run dev` запускает именно его.
- Мост `tools/godot/export.mjs` запекает правила и мир из JS — общий код не продублирован.
- Сервер и `src/*.js` не тронуты: авторитет, баланс и тесты сохранены.
- Нативный smoke `godot/tests/smoke.gd` покрывает вход, бой, сумку, лавку, заточку, чат,
  переподключение по токену и смену класса.

## В работе (некоммиченная правка в рабочей копии)

Второй проход, 16 изменённых файлов (+794/−279) и 10 новых:

1. **Интерфейс под эталон L2** — основная масса правок в `godot/scripts/hud.gd`, новые
   `chat_panel.gd` (вкладки каналов), `window_frame.gd` (перетаскиваемые окна),
   `character_preview.gd` (3D-превью в окне персонажа и на экране создания).
   Спецификация — [docs/UI_STYLE.md](docs/UI_STYLE.md).
2. **По умолчанию — боевой сервер.** `tools/godot/run.mjs` теперь целится в
   `wss://realms.neuraldeep.ru/ws` с `--resume`; локальный мир — отдельным флагом `--local`.
3. **Новый приёмочный контур** — `verify.mjs`, `probe.mjs`, `weapons.mjs` плюс
   `godot/tests/server_probe.gd`, `godot/tests/weapons.gd` и сильно расширенный `smoke.gd`
   (`--touch`, `--artifacts`).
4. **`UI_RULES` в экспорте** — превью-персонажи (через `server/sim/player.js::newChar`),
   константы заточки и цены продажи уезжают в `catalog.json`, чтобы интерфейс Godot перестал
   пересчитывать правила у себя.
5. Три новых документа в `docs/`.

Правки в `tools/trellis/texture.py` к переезду не относятся — это отдельная работа над
текстурами.

## Хвосты

| хвост | суть | где |
|---|---|---|
| **Выкладка** | `npm run deploy` по-прежнему шлёт веб-`dist/`; нативные сборки никуда не публикуются | [DISTRIBUTION.md](docs/DISTRIBUTION.md) — это план, не реализация |
| ~~CLAUDE.md противоречит себе~~ | **закрыто 18.09.2026**: переписан под `AGENTS.md` | [гоча](docs/gitmark/ops/claude-md-outdated.md) |
| **Веб вне `npm test`** | регрессии в `src/main.js` ловятся только явным `npm run test:web` | [легаси-клиент](docs/gitmark/services/web-client/README.md) |
| **Телефонные сценарии** | раскладка iPhone и жесты камеры покрыты только браузерным E2E | `tests/e2e.mjs` |

## Порядок закрытия

1. ~~Привести `CLAUDE.md` в соответствие с `AGENTS.md`~~ — сделано 18.09.2026.
2. Реализовать раздачу нативных сборок по `DISTRIBUTION.md` и развести `deploy` на
   «сервер» и «клиент».
3. Решить судьбу браузерного клиента: либо вернуть `test:web` в обязательный прогон,
   либо честно заморозить и снять с прода.
4. Перенести телефонные проверки в нативный smoke (`--touch` для этого уже есть).
