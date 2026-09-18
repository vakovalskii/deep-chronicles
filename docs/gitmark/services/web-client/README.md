---
node_type: service
title: Браузерный клиент на three.js (легаси)
service: web-client
status: deprecated
updated: 2026-09-18
tags: [three.js, vite, legacy, browser]
links:
  documents: [src/main.js, src/world.js, src/tex.js, index.html]
  depends_on: [docs/gitmark/decisions/2026-09-18-native-godot-client.md]
  relates_to: [docs/gitmark/services/godot-client/README.md]
---

# Браузерная игра закрыта

Прямое решение пользователя 18.09.2026: больше не поддерживать игру на сайте. Старые `src/main.js`, `src/world.js`, `src/tex.js`, `src/skin.js`, корневой `index.html`, `tests/e2e.mjs` оставлены как архив; команды `dev:web`, `build:web`, `test:web`, `test:e2e` удалены. Не восстанавливать их и не тратить задачи Godot на совместимость браузерной игры.

`site/` — отдельная страница скачивания нативного клиента и статуса сервера. `site:build` создаёт `dist/` с ZIP и манифестом SHA-256; `test:site` проверяет сайт headless-браузером против временного настоящего сервера. Игрового canvas на сайте нет.

Общие `src/data.js`, `stats.js`, `sim.js`, `progression.js`, `pvp.js`, `world-core.js`, `models.js`, `glb.js` нужны серверу, правилам, тестам и экспорту Godot. Их нельзя удалять вместе с архивным браузерным UI.
