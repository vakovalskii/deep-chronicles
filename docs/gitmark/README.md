---
node_type: index
title: База знаний «Хроники Глубин»
service: _platform
status: active
updated: 2026-09-18
links:
  relates_to: [docs/gitmark/reference/architecture.md]
---

# База знаний «Хроники Глубин»

Документация по онтологии **OntoShip/GitMark**: каждый документ — объект с типом
(`node_type`), свойствами во фронтматтере и типизированными ссылками. Модель —
[ontology.md](docs/gitmark/ontology.md). Правило простое: **md + git — источник истины**,
индекс поиска производный и пересобирается.

## С чего начать

1. [Архитектура: кто что считает](docs/gitmark/reference/architecture.md) — общая картина.
2. [Решение: основной клиент — Godot](docs/gitmark/decisions/2026-09-18-native-godot-client.md) — почему всё так.
3. [Переезд на Godot: состояние и хвосты](docs/gitmark/plans/godot-migration.md) — что делается прямо сейчас.

## Разделы

- [Компоненты](docs/gitmark/services/README.md) — клиент Godot, сервер, легаси-браузер
- [Справочники](docs/gitmark/reference/README.md) — архитектура, протокол, общие правила, графика
- [Эксплуатация](docs/gitmark/ops/README.md) — сборка, проверка, выкладка, грабли
- [Решения](docs/gitmark/decisions/README.md) — архитектурные решения
- [Планы](docs/gitmark/plans/README.md) — незакрытая работа

## Обслуживание

```bash
python3 .claude/skills/kb-search/gitmark.py search "<тема>"   # искать перед тем, как писать
python3 .claude/skills/kb-search/gitmark.py lint              # инварианты I1–I6
python3 .claude/skills/kb-search/gitmark.py index             # пересобрать индекс
```

Пишете новый документ — сначала ищите, не дублируйте; выбирайте `node_type` и папку,
ставьте фронтматтер, **минимум одну** типизированную ссылку и строку в индекс папки.
Слэш-команды: `/kb-doc <тема>`, `/kb-build`, `/kb-graph`.

Вне базы знаний остаются рабочие документы `docs/*.md`
([NATIVE_PIPELINE](docs/NATIVE_PIPELINE.md), [UI_STYLE](docs/UI_STYLE.md),
[DISTRIBUTION](docs/DISTRIBUTION.md)) — они не сканируются линтером, на них только ссылаемся.
