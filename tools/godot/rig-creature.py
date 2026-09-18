"""Skin generated quadrupeds/arthropods to a small native skeleton and bake clips.
blender -b -P tools/godot/rig-creature.py -- input.glb output.glb wolf|rabbit|boar|spider|scorpion
"""
import bpy,sys,math
from mathutils import Vector,Matrix
src,out,kind=sys.argv[sys.argv.index('--')+1:]
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=src)
meshes=[o for o in bpy.data.objects if o.type=='MESH']
pts=[o.matrix_world@Vector(p) for o in meshes for p in o.bound_box]
lo=Vector([min(p[i]for p in pts)for i in range(3)]);hi=Vector([max(p[i]for p in pts)for i in range(3)])
center=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z));k=1/(hi.z-lo.z)
for m in meshes:
 world=m.matrix_world.copy();m.parent=None
 for v in m.data.vertices:v.co=(world@v.co-center)*k
 m.matrix_world=Matrix.Identity(4)
 for mat in m.data.materials:
  if mat:mat.use_backface_culling=False
W,L,H=(hi-lo)*k
arthropod=kind in ['spider','scorpion']
armdata=bpy.data.armatures.new('CreatureSkeleton');arm=bpy.data.objects.new('CreatureRig',armdata);bpy.context.collection.objects.link(arm)
bpy.context.view_layer.objects.active=arm;arm.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
bones={}
def bone(name,head,tail,parent=None):
 b=armdata.edit_bones.new(name);b.head=head;b.tail=tail
 if parent:b.parent=armdata.edit_bones[parent]
 bones[name]=(Vector(head),Vector(tail));return b
body_z=.4 if arthropod else .64
bone('root',(0,0,0),(0,0,.15))
bone('body',(0,L*.18,body_z),(0,-L*.22,body_z),'root')
bone('head',(0,-L*.22,body_z),(0,-L*.43,.7 if not arthropod else .43),'body')
legs=[]
for side in [-1,1]:
 for i in range(4 if arthropod else 2):
  y=L*(-.28+i*(.18 if arthropod else .52));x=side*W*(.12 if arthropod else .26)
  mid=(side*W*.38,y+L*.06,.5 if arthropod else .33)
  end=(side*W*.49,y+L*.12,.02) if arthropod else (x,y-.02*L,.04)
  name=f'leg_{side}_{i}';legs.append(name)
  bone(name,(x,y,body_z),mid,'body');bone(name+'_lower',mid,end,name)
if kind in ['wolf','boar','scorpion']:
 bone('tail',(0,L*.25,.62),(0,L*.47,.92 if kind=='scorpion' else .5),'body')
bpy.ops.object.mode_set(mode='OBJECT')
def distance(p,a,b):
 v=b-a;t=max(0,min(1,(p-a).dot(v)/max(v.length_squared,1e-7)));return (p-(a+v*t)).length
for m in meshes:
 for name in bones:m.vertex_groups.new(name=name)
 for v in m.data.vertices:
  p=v.co;names=list(bones)
  names.remove('root')
  if not arthropod:
   if p.z>.57:names=[n for n in names if not n.startswith('leg')]
   elif p.z<.35 and abs(p.x)>W*.1:names=[n for n in names if n.startswith('leg')]
  ds=sorted((distance(p,*bones[n]),n) for n in names)[:3]
  values=[(n,1/max(d,.025)**5)for d,n in ds];total=sum(w for _,w in values)
  for n,w in values:m.vertex_groups[n].add([v.index],w/total,'REPLACE')
 m.parent=arm;mod=m.modifiers.new('Skin','ARMATURE');mod.object=arm
arm.animation_data_create()
for clip,seconds in [('idle',3),('walk',.8),('attack',.65),('cast',.65),('death',1.1)]:
 action=bpy.data.actions.new(clip);arm.animation_data.action=action
 frames=round(seconds*24)
 for f in range(frames+1):
  t=f/frames;phase=t*math.tau
  for p in arm.pose.bones:p.rotation_mode='XYZ';p.rotation_euler=(0,0,0);p.location=(0,0,0)
  body=arm.pose.bones['body'];head=arm.pose.bones['head'];root=arm.pose.bones['root']
  if clip=='idle':body.scale=(1+math.sin(phase)*.012,1,1+math.sin(phase)*.008);head.rotation_euler.z=math.sin(phase)*.04
  elif clip=='walk':
   body.scale=(1,1,1);body.location.y=abs(math.sin(phase))*.035
   for j,name in enumerate(legs):
    p=arm.pose.bones[name];s=math.sin(phase+(j%2+(j//(4 if arthropod else 2)))%2*math.pi)
    p.rotation_euler.x=s*(.25 if arthropod else .42)
    if arthropod:p.rotation_euler.z=s*.2
    arm.pose.bones[name+'_lower'].rotation_euler.x=max(0,-s)*.52
   head.rotation_euler.x=math.sin(phase)*.05
  elif clip in ['attack','cast']:
   pulse=math.sin(t*math.pi);head.rotation_euler.x=-pulse*.38;body.rotation_euler.x=pulse*.13;body.location.z=-pulse*.12
   for name in legs[:len(legs)//2]:arm.pose.bones[name].rotation_euler.x=-pulse*.28
  else:root.rotation_euler.y=min(1,t*1.8)*math.pi/2;root.location.z=-min(1,t*1.8)*.12
  if 'tail'in arm.pose.bones:arm.pose.bones['tail'].rotation_euler.z=math.sin(phase)*.2
  for p in arm.pose.bones:
   p.keyframe_insert('rotation_euler',frame=f);p.keyframe_insert('location',frame=f);p.keyframe_insert('scale',frame=f)
 track=arm.animation_data.nla_tracks.new();track.name=clip;track.strips.new(clip,0,action)
 arm.animation_data.action=None
# Export all named NLA tracks; disable animation evaluation for the rest mesh.
for track in arm.animation_data.nla_tracks:track.mute=True
for p in arm.pose.bones:p.matrix_basis.identity()
bpy.context.scene.render.fps=24
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True)
print('RIGGED CREATURE',kind,out)
