#!/usr/bin/env bash
# Запуск в контейнере trellis2 на GPU-сервере: все модели одним процессом (веса 4B грузятся один раз),
# если процесс упал — оставшиеся добиваем по одной. Порядок id = порядок генерации.
set -u
cd /opt/TRELLIS.2
pip install -q rembg onnxruntime transformers==4.57.1 2>&1 | tail -1
python /work/gen.py --cut
python /work/gen.py "$@" || echo BATCH_FAIL
for id in "$@"; do [ -f "/work/out/$id.glb" ] || python /work/gen.py "$id" || echo "FAIL $id"; done
echo ALL_DONE
