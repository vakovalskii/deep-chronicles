---
node_type: reference
title: Конвейер графики и ассетов
service: godot-client
status: active
updated: 2026-09-18
tags: [assets, trellis, blender, glb, manifest]
links:
  documents: [godot/assets/manifest.json, tools/godot/export.mjs, tools/trellis/texture.py, art/README.md]
  depends_on: [docs/gitmark/services/godot-client/README.md]
  relates_to: [docs/gitmark/ops/native-build.md]
---

# Конвейер графики и ассетов

Два каталога с разной судьбой:

- **`godot/assets/`** — авторский исходник, **коммитится**. Персонажи, существа, постройки,
  текстуры рельефа и реестр `manifest.json`.
- **`godot/generated/`** — расходный мост к JS-коду, в `.gitignore`, пересобирается
  `npm run native:assets`. Руками не править.

Поиск всегда «сначала исходник, потом сгенерённое»: `world.gd:47` и `world.gd:104-106`
пробуют `res://assets/terrain/<k>.png` и падают на `res://generated/tex/<k>.png`;
`actor.gd:42` падает на `res://generated/actors/<id>.glb` для всего, чего нет в манифесте.

## `manifest.json`

Ровно две карты верхнего уровня.

```jsonc
{
  "actors": {                       // 19 записей
    "warrior": { "path": "res://assets/characters/warrior_cloth.glb",
                 "height": 2.5, "rig": "canonical" },
    "priest":  { "path": "res://assets/characters/cleric.gltf", "height": 2.5,
                 "clips": { "idle":"Idle", "walk":"Walk",
                            "attack":"Staff_Attack", "cast":"Spell1", "death":"Death" } }
  },
  "props": {                        // 13 записей
    "house_a": { "path": "res://assets/props/house_a.glb", "triangles": 18000 }
  }
}
```

Поля актёра: `path` (обязателен), `height` — целевая высота в метрах, под неё модель
равномерно масштабируется (`art_assets.gd:51`), и **ровно одно** из:

- `rig: "canonical"` — пересадить общую библиотеку анимаций
  (`res://generated/anims/AnimationLibrary_Godot_Standard.nofingers.gltf`) в пять клипов
  `idle/walk/attack/cast/death` с точечными переопределениями (`art_assets.gd:28-32`);
- `clips` — переименовать собственные клипы GLB в те же пять канонических имён.

Необязательный `yaw` читается на `art_assets.gd:54`. Поле `triangles` у построек — только
пометка о бюджете, код его не читает: сценография разрешается по соглашению
`res://assets/props/<id>.glb` из `modelPlacements` в `world.json` (`world.gd:132`), а
`smoke.gd:65-66` проверяет, что для каждой расстановки файл существует.

## Путь одного ассета

```
концепт (art/concepts/, art/imagegen-prompts.json)
   ↓ TRELLIS.2 → GLB в tools/models-out/ (в .gitignore)
   ↓ npm run native:art -- <id>   (Blender: rig.py / rig-creature.py / prepare-static.py)
godot/assets/<категория>/<id>.glb  +  запись в manifest.json   ← коммитится
```

Конвейер **намеренно не воспроизводим байт в байт**: принятые результаты кладутся в git,
поэтому обычная сборка игры никогда не вызывает нейросети. `art/` — это запись происхождения
(30 концептов, промпты, лицензия Quaternius в `art/licenses/`), а не генератор.

## Расстановка моделей

[`tools/godot/placements.mjs`](tools/godot/placements.mjs) выдаёт строки
`[id, x, y, z, yaw, sx, sy, sz]`. `world.gd:123-158` батчит их через MultiMesh по паре
«id + ячейка 100 м», отсечение дальности — 360 для листвы и камней, 800 для остального;
на карте они же рисуются в `map.gd:62-65`.

## Текстуры (TRELLIS)

[`tools/trellis/texture.py`](tools/trellis/texture.py) — переписанный `run()` текстурирования
TRELLIS.2, принимающий **несколько ракурсов** вместо одного (одна картинка давала выдуманную
спину и швы). Геометрия меша не трогается. Закрытая модель RMBG-2.0 заглушена, фон режется
локальным `rembg`/birefnet.

Грабли, которые уже стоили девяти заходов:

- Без `torch.set_grad_enabled(False)` / `@torch.no_grad()` не хватает видеопамяти.
- `--fuse=concat` на двух ракурсах не влезает в 24 ГБ; `mean` совпадает с поведением
  ComfyUI-Trellis2 — он и по умолчанию.
- Встроенная заделка дыр через `cv2.inpaint` оставляла до 40 % текселей чёрными и заменена.

> Правки в `texture.py` в текущей рабочей копии — отдельная работа пользователя, к переезду
> на Godot отношения не имеющая.
