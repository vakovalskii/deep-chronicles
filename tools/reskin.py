# Пересадка нашей модели на канонический скелет (Quaternius, CC0) в Blender:
#   blender -b -P tools/reskin.py -- <тело.glb> <библиотека.gltf> <выход.glb>
# Веса считает Blender (автоматические веса по костям), клипы из библиотеки едут отдельно.
import bpy, sys, math
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
BODY, LIB, OUT = argv[0], argv[1], argv[2]

def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def imp(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]

def bbox(objs):
    lo = Vector((1e9, 1e9, 1e9)); hi = Vector((-1e9, -1e9, -1e9))
    for o in objs:
        if o.type != 'MESH':
            continue
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            lo = Vector((min(lo[i], w[i]) for i in range(3)))
            hi = Vector((max(hi[i], w[i]) for i in range(3)))
    return lo, hi

clear()

# 1. библиотечный персонаж: из него берём только арматуру
lib_objs = imp(LIB)
arm = next(o for o in lib_objs if o.type == 'ARMATURE')
# в сцене библиотеки лежит посторонняя сфера — эталон выбираем по наличию весов
lib_meshes = [o for o in lib_objs if o.type == 'MESH']
ref = max(lib_meshes, key=lambda o: len(o.vertex_groups))
if not len(ref.vertex_groups):
    raise SystemExit('в библиотеке нет меша с весами')
lib_lo, lib_hi = bbox([ref])
lib_h = lib_hi.z - lib_lo.z
print('скелет:', arm.name, '| костей:', len(arm.data.bones), '| эталон:', ref.name, '| рост эталона:', round(lib_h, 3))

# 2. наше тело
body_objs = imp(BODY)
body_meshes = [o for o in body_objs if o.type == 'MESH']
for o in body_objs:              # свой скелет нам не нужен — будет библиотечный
    if o.type == 'ARMATURE':
        bpy.data.objects.remove(o, do_unlink=True)
for m in body_meshes:            # снимаем привязку к старому скелету
    m.parent = None
    for mod in list(m.modifiers):
        if mod.type == 'ARMATURE':
            m.modifiers.remove(mod)
    for vg in list(m.vertex_groups):
        m.vertex_groups.remove(vg)

# 3. подгоняем наше тело под рост и положение эталона
lo, hi = bbox(body_meshes)
h = hi.z - lo.z
k = lib_h / h if h else 1
mid = (lo + hi) / 2
for m in body_meshes:
    m.scale = (k, k, k)
    m.location = (m.location.x - mid.x * k, m.location.y - mid.y * k, m.location.z - lo.z * k + lib_lo.z)
bpy.context.view_layer.update()
print('наше тело:', [m.name for m in body_meshes], 'масштаб:', round(k, 4))

# 4. веса: переносим с эталонного манекена по ближайшей поверхности.
# Автоматические веса Blender (ARMATURE_AUTO) на мешах из TRELLIS не работают —
# геометрия не-многообразная, и тепловой алгоритм не сходится («failed to find solution»).
src = ref
for m in body_meshes:
    bpy.ops.object.select_all(action='DESELECT')
    m.select_set(True)
    bpy.context.view_layer.objects.active = m
    mod = m.modifiers.new('ПереносВесов', 'DATA_TRANSFER')
    mod.object = src
    mod.use_vert_data = True
    mod.data_types_verts = {'VGROUP_WEIGHTS'}
    mod.vert_mapping = 'NEAREST'  # по ближайшей вершине: на тонких руках надёжнее
    # (POLYINTERP_NEAREST мажет на запястьях, POLYINTERP_VNORPROJ разносит меш в щепки)
    bpy.ops.object.datalayout_transfer(modifier=mod.name)   # создаём группы под кости
    bpy.ops.object.modifier_apply(modifier=mod.name)

    # В glTF на вершину допускается максимум 4 кости. Если оставить больше,
    # экспорт молча отбросит лишние, веса перестанут складываться в единицу —
    # и меш рвёт в клочья при анимации. Поэтому урезаем и нормируем.
    # Сглаживаем веса: перенос «по ближайшей вершине» даёт резкие стыки —
    # волосы у плеча получают кости руки и улетают с ней при взмахе.
    bpy.ops.object.mode_set(mode='WEIGHT_PAINT')   # оператор сглаживания работает только здесь
    bpy.ops.object.vertex_group_smooth(group_select_mode='ALL', factor=0.5, repeat=6, expand=0.2)
    bpy.ops.object.mode_set(mode='OBJECT')

    bpy.ops.object.vertex_group_limit_total(limit=4)
    bpy.ops.object.vertex_group_clean(group_select_mode='ALL', limit=0.005)
    bpy.ops.object.vertex_group_normalize_all(lock_active=False)

    # Нормали приводим к внешним. Склейку вершин (remove_doubles) здесь делать НЕЛЬЗЯ:
    # на швах UV у совпадающих вершин разные координаты, склейка рвёт текстуру.
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.shade_smooth()

    withw = sum(1 for v in m.data.vertices if v.groups)
    mx = max((len(v.groups) for v in m.data.vertices), default=0)
    print('веса:', m.name, '| вершин с весами:', withw, 'из', len(m.data.vertices), '| максимум костей на вершину:', mx)
    # привязка к арматуре: родитель + модификатор
    m.parent = arm
    m.matrix_parent_inverse = arm.matrix_world.inverted()
    am = m.modifiers.new('Скелет', 'ARMATURE')
    am.object = arm

for m in lib_meshes:             # эталонный манекен больше не нужен
    bpy.data.objects.remove(m, do_unlink=True)
print('веса перенесены')

# скрытая арматура не попадает в экспорт, и скин теряется — показываем её явно
arm.hide_viewport = False
arm.hide_set(False)
arm.hide_render = False
for m in body_meshes:
    m.hide_viewport = False
    m.hide_set(False)
if arm.name not in bpy.context.scene.collection.objects:
    for c in list(arm.users_collection):
        c.objects.unlink(arm)
    bpy.context.scene.collection.objects.link(arm)
bpy.context.view_layer.update()
print('видимость: арматура', not arm.hide_viewport, '| мешей', len(body_meshes))

# 5. экспорт: меш + скелет, без анимаций (клипы приезжают отдельным файлом)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_animations=False, export_skins=True)
print('ГОТОВО ->', OUT)
