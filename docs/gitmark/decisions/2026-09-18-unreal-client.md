---
node_type: decision
title: Следующий клиент — Unreal Engine 5, сервер и прогресс сохраняются
service: _platform
status: active
updated: 2026-09-18
tags: [unreal, ue5, migration, client]
links:
  documents: [AGENTS.md, docs/UE5_MIGRATION.md]
  supersedes: [docs/gitmark/decisions/2026-09-18-native-godot-client.md]
  relates_to: [docs/gitmark/plans/unreal-migration.md, docs/gitmark/reference/architecture.md]
---

# Следующий клиент — Unreal Engine 5

Пользователь явно попросил перенести всю игру на UE5. Последующим сообщением остановил очистку текущего Mac и предложил выбрать другую машину разработки; затем попросил сохранить все изменения, планы и TODO в Git. Решение о направлении принято, реализации UE-проекта ещё нет.

Godot остаётся действующим клиентом и образцом функций до приёмки замены. Node.js/WebSocket/SQLite, общие JS-правила, аккаунты и прогресс сохраняются; перенос не означает переписывание сервера или удаление работающей игры. Браузерная версия закрыта, сайт остаётся для скачивания и онлайна. Платформы: Windows/macOS/Android/iOS, с отдельной приёмкой каждой.

Бюджет, формат и конкретная машина пока не выбраны. Не продолжать очистку/установку на старом Mac по предыдущей просьбе. Не использовать production OCR как GPU-сервер игры. Автообновление, полноценный UE-клиент и масштаб MMORPG не объявлять реализованными.

Полный объём, контрольные точки и источники: [UE5_MIGRATION](docs/UE5_MIGRATION.md). Текущее состояние и известный отказ нативного теста: [CURRENT_TASKS](docs/CURRENT_TASKS.md).
