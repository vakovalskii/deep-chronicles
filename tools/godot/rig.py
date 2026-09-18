"""Blender: generated A-pose -> canonical T-pose skin, UVs preserved.
blender -b -P tools/godot/rig.py -- source.glb library.gltf output.glb [height]
Animations are imported once by Godot from the same canonical library.
"""
import bpy, sys, math
from mathutils import Vector, Matrix
args = sys.argv[sys.argv.index('--')+1:]
source, library, output = args[:3]
target_height = float(args[3]) if len(args)>3 else 1.79
arm_angle = float(args[4]) if len(args)>4 else 57
bpy.ops.wm.read_factory_settings(use_empty=True)
def imp(path):
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]
def bounds(meshes):
    coords=[o.matrix_world@Vector(p) for o in meshes for p in o.bound_box]
    return Vector([min(p[i] for p in coords) for i in range(3)]),Vector([max(p[i] for p in coords) for i in range(3)])
lib=imp(library)
arm=next(o for o in lib if o.type=='ARMATURE')
ref=max((o for o in lib if o.type=='MESH'),key=lambda o:len(o.vertex_groups))
arm.animation_data_clear()
for p in arm.pose.bones:p.matrix_basis.identity()
# Transfer weights in the SAME pose as the concept, then unpose the source
# vertices. Transferring directly from a T-pose makes the elbows follow hips.
for side,sign in [('L',1),('R',-1)]:
    p=arm.pose.bones['DEF-upper_arm.'+side]
    rest=p.bone.matrix_local.copy();pivot=Matrix.Translation(rest.translation)
    p.matrix=pivot@Matrix.Rotation(math.radians(arm_angle)*sign,4,'Y')@pivot.inverted()@rest
bpy.context.view_layer.update()
deps=bpy.context.evaluated_depsgraph_get()
posed=ref.copy();posed.data=bpy.data.meshes.new_from_object(ref.evaluated_get(deps));bpy.context.collection.objects.link(posed)
posed.modifiers.clear();posed.parent=None;posed.matrix_world=ref.matrix_world.copy()
skin_matrices={b.name:arm.pose.bones[b.name].matrix@b.matrix_local.inverted() for b in arm.data.bones}
body=imp(source);meshes=[o for o in body if o.type=='MESH']
for m in meshes:
    world=m.matrix_world.copy();m.parent=None;m.matrix_world=world
    for mod in list(m.modifiers):m.modifiers.remove(mod)
    m.vertex_groups.clear()
lo,hi=bounds(meshes);factor=target_height/(hi.z-lo.z)
center=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
for m in meshes:
    world=m.matrix_world.copy()
    for v in m.data.vertices:v.co=(world@v.co-center)*factor
    m.matrix_world=Matrix.Identity(4)
    bpy.ops.object.select_all(action='DESELECT');m.select_set(True);bpy.context.view_layer.objects.active=m
    mod=m.modifiers.new('A-pose weight transfer','DATA_TRANSFER');mod.object=posed;mod.use_vert_data=True;mod.data_types_verts={'VGROUP_WEIGHTS'};mod.vert_mapping='NEAREST'
    bpy.ops.object.datalayout_transfer(modifier=mod.name);bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.ops.object.mode_set(mode='WEIGHT_PAINT');bpy.ops.object.vertex_group_smooth(group_select_mode='ALL',factor=.5,repeat=4);bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.vertex_group_limit_total(limit=4);bpy.ops.object.vertex_group_clean(group_select_mode='ALL',limit=.004);bpy.ops.object.vertex_group_normalize_all(lock_active=False)
    names={g.index:g.name for g in m.vertex_groups}
    for v in m.data.vertices:
        influences=[(skin_matrices[names[g.group]],g.weight) for g in v.groups if names[g.group] in skin_matrices]
        if not influences:continue
        blended=Matrix([[sum(mat[r][c]*w for mat,w in influences) for c in range(4)]for r in range(4)])
        v.co=blended.inverted_safe()@v.co
    # TRELLIS surfaces are not manifold. Recalculating normals flips small
    # disconnected shells; keep the generated normals and render both sides.
    for mat in m.data.materials:
        if mat:mat.use_backface_culling=False
    m.parent=arm;m.matrix_parent_inverse=arm.matrix_world.inverted()
    mod=m.modifiers.new('Skeleton','ARMATURE');mod.object=arm
for p in arm.pose.bones:p.matrix_basis.identity()
for o in list(lib)+[posed]:
    if o!=arm and o.name in bpy.data.objects:bpy.data.objects.remove(o,do_unlink=True)
arm.hide_viewport=False;arm.hide_set(False);arm.hide_render=False
bpy.context.view_layer.update()
bpy.ops.export_scene.gltf(filepath=output,export_format='GLB',export_animations=False,export_skins=True)
print('RIGGED',output)
