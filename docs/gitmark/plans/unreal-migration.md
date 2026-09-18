---
node_type: plan
title: Переезд на UE5 — новая машина, перенос функций и приёмка
service: _platform
status: active
updated: 2026-09-18
tags: [unreal, migration, roadmap]
links:
  documents: [docs/UE5_MIGRATION.md, docs/CURRENT_TASKS.md]
  depends_on: [docs/gitmark/decisions/2026-09-18-unreal-client.md]
  supersedes: [docs/gitmark/plans/godot-migration.md]
  relates_to: [docs/gitmark/ops/native-build.md, docs/gitmark/reference/protocol.md]
---

# План перехода на UE5

Источник актуальных задач — [полный план](docs/UE5_MIGRATION.md); здесь навигация без копирования всей матрицы.

1. Выбрать машину с пользователем, закрепить UE/toolchain и проверить пустую упакованную игру.
2. Подключить существующий сервер и общий мир: вход, движение, моб, бой, награды/подбор.
3. Перенести все меню, чат/drag, снаряжение, прогрессию, пати, модели/анимации, материалы и звук; сравнивать с действующим Godot.
4. Проверить сборки/сервер/два клиента из чистого clone, загрузки на сайте и автообновление; выпустить и показать приложение на основном сервере.
5. Отдельно измерить серверную нагрузку и расширять зоны/контент по результатам.

UE-проекта и UE CI пока нет. Очистка текущего Mac остановлена, Godot checkpoint не является новым релизом. Ближайшее действие — выбор компьютера; бюджет и формат не получены. Проверки и открытые дефекты — [CURRENT_TASKS](docs/CURRENT_TASKS.md).
