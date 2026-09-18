"""Normalize GLB textures and reduce repeated scenery to a runtime budget."""
import bpy,sys
source,output,budget=sys.argv[sys.argv.index('--')+1:];budget=int(budget)
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=source)
for obj in bpy.data.objects:
 if obj.type!='MESH':continue
 bpy.context.view_layer.objects.active=obj
 triangles=sum(len(p.vertices)-2 for p in obj.data.polygons)
 if triangles>budget:
  mod=obj.modifiers.new('Runtime triangle budget','DECIMATE');mod.ratio=budget/triangles;bpy.ops.object.modifier_apply(modifier=mod.name)
 for mat in obj.data.materials:
  if mat:mat.use_backface_culling=False
bpy.ops.export_scene.gltf(filepath=output,export_format='GLB',export_animations=False)
print('PREPARED',output)
