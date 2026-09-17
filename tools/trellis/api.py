# HTTP API генерации 3D (TRELLIS.2): картинка → GLB. Модель грузится один раз, задачи идут очередью.
# Запуск в контейнере trellis2 на GPU-сервере: python /work/api.py  (слушает 127.0.0.1:8765, доступ — через ssh -L)
#   POST /jobs?id=<имя>&dec=30000&tex=1024&seed=7   тело — PNG/JPG (фон вырежется сам)  → {"id": ...}
#   GET  /jobs                                        → список задач и статусы
#   GET  /jobs/<id>                                   → {"status": queued|running|done|error, ...}
#   GET  /jobs/<id>/glb                               → файл модели
#   GET  /health
import os, io, re, json, time, queue, threading, traceback
os.environ['OPENCV_IO_ENABLE_OPENEXR'] = '1'
os.environ['PYTORCH_CUDA_ALLOC_CONF'] = 'expandable_segments:True'
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from PIL import Image
import torch
import trellis2.pipelines.rembg as rb

class NoRembg:  # закрытую модель фона не грузим — вырезаем rembg сами
    def __init__(self, *a, **k): pass
    def to(self, *a, **k): return self
    def cuda(self): return self
    def cpu(self): return self
    def __call__(self, img): raise RuntimeError('нужна картинка с альфой')
rb.BiRefNet = NoRembg

from rembg import remove, new_session
from trellis2.pipelines import Trellis2ImageTo3DPipeline
import o_voxel

OUT = os.environ.get('OUT', '/work/api-out')
os.makedirs(OUT, exist_ok=True)
jobs, q, lock = {}, queue.Queue(), threading.Lock()

print('загрузка модели…', flush=True)
sess = new_session('birefnet-general')
pipe = Trellis2ImageTo3DPipeline.from_pretrained('microsoft/TRELLIS.2-4B')
# все веса — на GPU (24 ГБ хватает, если OCR остановлен); иначе копии в ОЗУ (15 ГБ) и процесс убивает OOM
pipe.low_vram = os.environ.get('LOW_VRAM', '0') == '1'
pipe.cuda()
import gc; gc.collect()
print('готово', flush=True)

def work():
    while True:
        jid = q.get()
        j = jobs[jid]
        j['status'], j['started'] = 'running', time.time()
        mesh = glb = None
        try:
            img = Image.open(io.BytesIO(j.pop('data')))
            if img.mode != 'RGBA' or img.getextrema()[3][0] == 255:
                img = remove(img.convert('RGB'), session=sess)
            mesh = pipe.run(img, seed=j['seed'])[0]
            mesh.simplify(j['pre'])
            glb = o_voxel.postprocess.to_glb(
                vertices=mesh.vertices, faces=mesh.faces, attr_volume=mesh.attrs, coords=mesh.coords,
                attr_layout=mesh.layout, voxel_size=mesh.voxel_size, aabb=[[-0.5, -0.5, -0.5], [0.5, 0.5, 0.5]],
                decimation_target=j['dec'], texture_size=j['tex'], remesh=True, remesh_band=1, remesh_project=0, verbose=False)
            glb.export(os.path.join(OUT, jid + '.glb'), extension_webp=True)
            j['status'] = 'done'
        except Exception as e:
            traceback.print_exc()
            j['status'], j['error'] = 'error', str(e)[:500]
        finally:
            j['secs'] = round(time.time() - j['started'])
            mesh = glb = None  # освобождаем память GPU до следующей задачи
            torch.cuda.empty_cache()
            print(jid, j['status'], j['secs'], 's', flush=True)
threading.Thread(target=work, daemon=True).start()

class H(BaseHTTPRequestHandler):
    def _json(self, code, obj):
        b = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b)
    def log_message(self, *a): pass
    def do_GET(self):
        p = urlparse(self.path).path.rstrip('/')
        if p == '/health': return self._json(200, {'ok': True, 'queue': q.qsize(), 'gpu_mb': torch.cuda.memory_allocated() // 2**20})
        if p == '/jobs': return self._json(200, {k: {x: v for x, v in j.items() if x != 'data'} for k, j in jobs.items()})
        m = re.fullmatch(r'/jobs/([\w-]+)(/glb)?', p)
        if not m or m[1] not in jobs: return self._json(404, {'error': 'нет такой задачи'})
        j = jobs[m[1]]
        if not m[2]: return self._json(200, {x: v for x, v in j.items() if x != 'data'})
        f = os.path.join(OUT, m[1] + '.glb')
        if j['status'] != 'done' or not os.path.exists(f): return self._json(409, {'error': 'ещё не готово', 'status': j['status']})
        b = open(f, 'rb').read()
        self.send_response(200); self.send_header('Content-Type', 'model/gltf-binary'); self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_POST(self):
        u = urlparse(self.path)
        if u.path.rstrip('/') != '/jobs': return self._json(404, {'error': 'POST /jobs'})
        a = {k: v[0] for k, v in parse_qs(u.query).items()}
        n = int(self.headers.get('Content-Length', 0))
        if not 0 < n < 30 * 2**20: return self._json(400, {'error': 'нужна картинка до 30 МБ в теле запроса'})
        jid = re.sub(r'[^\w-]', '', a.get('id', '')) or f'job{int(time.time()*1000)}'
        with lock:
            if jobs.get(jid, {}).get('status') in ('queued', 'running'): return self._json(409, {'error': 'уже в работе', 'id': jid})
            jobs[jid] = {'id': jid, 'status': 'queued', 'queued': time.time(), 'data': self.rfile.read(n),
                         'dec': int(a.get('dec', 30000)), 'tex': int(a.get('tex', 1024)), 'seed': int(a.get('seed', 7)), 'pre': int(a.get('pre', 300000))}
        q.put(jid)
        self._json(202, {'id': jid, 'position': q.qsize()})

ThreadingHTTPServer((os.environ.get('HOST', '127.0.0.1'), int(os.environ.get('PORT', 8765))), H).serve_forever()
