# Многоракурсное текстурирование готового меша (TRELLIS.2, стадия texturing).
#   python texture.py вход.glb выход.glb спереди.png [сзади.png слева.png справа.png] [--tex 2048] [--res 1024]
#
# Зачем: обычный путь image-to-3D красит меш по ОДНОЙ картинке и выдумывает спину и бока —
# на швах между увиденным и выдуманным получается грязь («иглы» на руках и ногах).
# Стадия texturing внутри принимает список ракурсов (get_cond(image: list)), просто её
# штатный run() обёрнут под одну картинку. Здесь повторён run() с передачей всех видов.
#
# Геометрию НЕ трогаем: она собрана с одного вида и претензий к ней нет, а многоракурсность
# на стадии формы, по замерам авторов, скорее вредит — размывает деталь.
import sys, torch, trimesh
from PIL import Image
import trellis2.pipelines.rembg as rb

class NoRembg:  # закрытая модель фона (RMBG-2.0) отдаёт 403 — как и в api.py, режем фон сами
    def __init__(self, *a, **k): pass
    def to(self, *a, **k): return self
    def cuda(self): return self
    def cpu(self): return self
    def __call__(self, img): raise RuntimeError('нужна картинка с альфой')
rb.BiRefNet = NoRembg

from rembg import remove, new_session
from trellis2.pipelines import Trellis2TexturingPipeline

args = [a for a in sys.argv[1:] if not a.startswith('--')]
opt = {a.split('=')[0][2:]: a.split('=')[1] for a in sys.argv[1:] if a.startswith('--') and '=' in a}
src, dst, imgs = args[0], args[1], args[2:]
res, tex = int(opt.get('res', 1024)), int(opt.get('tex', 2048))
seed = int(opt.get('seed', 42))
assert imgs, 'нужен хотя бы один ракурс'

print(f'меш: {src}\nракурсы: {len(imgs)} — ' + ', '.join(imgs), flush=True)
pipe = Trellis2TexturingPipeline.from_pretrained('microsoft/TRELLIS.2-4B', config_file='texturing_pipeline.json')
pipe.cuda()

mesh = trimesh.load(src, force='mesh')

# фон режем до пайплайна: с готовой альфой его собственная чистка не запускается
sess = new_session('birefnet-general')
def prep(p):
    img = Image.open(p)
    if img.mode != 'RGBA' or img.getextrema()[3][0] == 255:
        img = remove(img.convert('RGB'), session=sess)
    return pipe.preprocess_image(img)
views = [prep(p) for p in imgs]
mesh = pipe.preprocess_mesh(mesh)
torch.manual_seed(seed)

# Отличие от штатного run(): сюда уходит весь список видов, а не [image].
# get_cond складывает виды в ПАКЕТ (batch = число ракурсов), а меш у нас один,
# и внутреннее внимание падает с «Batch size mismatch, got 1, 4, 4».
# Поэтому пакет расплющиваем в одну последовательность: [В, Н, Д] → [1, В*Н, Д].
# Так все ракурсы видны модели одновременно, как один длинный контекст.
cond = pipe.get_cond(views, 512 if res == 512 else 1024)
n = len(views)
if n > 1:
    for k, v in list(cond.items()):
        if torch.is_tensor(v) and v.dim() == 3 and v.shape[0] % n == 0 and v.shape[0] >= n:
            cond[k] = v.reshape(v.shape[0] // n, n * v.shape[1], v.shape[2])
            print(f'  {k}: {tuple(v.shape)} → {tuple(cond[k].shape)}', flush=True)
shape_slat = pipe.encode_shape_slat(mesh, res)
tex_model = pipe.models['tex_slat_flow_model_512' if res == 512 else 'tex_slat_flow_model_1024']
tex_slat = pipe.sample_tex_slat(cond, tex_model, shape_slat, {})
out = pipe.postprocess_mesh(mesh, pipe.decode_tex_slat(tex_slat), res, tex)
out.export(dst)
print('готово:', dst, flush=True)
