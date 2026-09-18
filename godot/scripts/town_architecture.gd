extends RefCounted
## Собственные модульные дома: объём, фасады и крыши создаются в метрах.
var b: Node3D
func _init(builder: Node3D):
	b = builder
	b._material("plaster_ivory",Color("d2c3a4"))
	b._material("plaster_sage",Color("929c89"))
	b._material("plaster_ochre",Color("ba9a72"))
	b._material("plaster_rose",Color("af8273"))
	b._material("timber",Color("46372d"))
	b._material("masonry",Color("a9a293"),"res://generated/tex/brick.png")
	b._material("slate",Color("526574"),"res://generated/tex/roof.png")
	b._material("tile",Color("985b46"),"res://generated/tex/roof.png")
	b._material("glass",Color("344750"))
	b.materials.slate.cull_mode = BaseMaterial3D.CULL_DISABLED
	b.materials.tile.cull_mode = BaseMaterial3D.CULL_DISABLED

func beam(a: Vector3, c: Vector3, thickness: float, material = "timber"):
	var mesh = BoxMesh.new(); mesh.size = Vector3(thickness,thickness,a.distance_to(c))
	b._part(mesh,(a+c)*.5,material,"beam"+str(mesh.size),Basis.looking_at(c-a,Vector3.UP))

func roof(w: float, d: float, y: float, rise: float, material: String):
	var vertices = PackedVector3Array([
		Vector3(-w/2,y,-d/2),Vector3(0,y+rise,-d/2),Vector3(-w/2,y,d/2),
		Vector3(0,y+rise,-d/2),Vector3(0,y+rise,d/2),Vector3(-w/2,y,d/2),
		Vector3(0,y+rise,-d/2),Vector3(w/2,y,-d/2),Vector3(w/2,y,d/2),
		Vector3(0,y+rise,-d/2),Vector3(w/2,y,d/2),Vector3(0,y+rise,d/2),
		Vector3(-w/2,y,d/2),Vector3(0,y+rise,d/2),Vector3(w/2,y,d/2),
		Vector3(w/2,y,-d/2),Vector3(0,y+rise,-d/2),Vector3(-w/2,y,-d/2)])
	var normals = PackedVector3Array()
	for i in range(0,vertices.size(),3):
		var normal = -(vertices[i+1]-vertices[i]).cross(vertices[i+2]-vertices[i]).normalized()
		for j in 3: normals.append(normal)
	var arrays = []; arrays.resize(Mesh.ARRAY_MAX); arrays[Mesh.ARRAY_VERTEX] = vertices; arrays[Mesh.ARRAY_NORMAL] = normals
	var mesh = ArrayMesh.new(); mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES,arrays)
	b._part(mesh,Vector3.ZERO,material,"roof%s,%s,%s,%s"%[w,d,y,rise])
	beam(Vector3(0,y+rise,-d/2-.12),Vector3(0,y+rise,d/2+.12),.22)
	for z in [-d/2,d/2]:
		beam(Vector3(-w/2,y,z),Vector3(0,y+rise,z),.22)
		beam(Vector3(w/2,y,z),Vector3(0,y+rise,z),.22)

func window(x: float, y: float, z: float, shutters: bool, color: String):
	b._box(Vector3(x,y,z),Vector3(1.35,1.85,.14),"timber")
	b._box(Vector3(x,y,z+.09),Vector3(1.1,1.58,.08),"glass")
	b._box(Vector3(x,y,z+.15),Vector3(.09,1.65,.08),"cream")
	b._box(Vector3(x,y,z+.15),Vector3(1.16,.09,.08),"cream")
	b._box(Vector3(x,y-1,z+.12),Vector3(1.75,.16,.45),"masonry")
	if shutters:
		for side in [-1,1]:
			b._box(Vector3(x+side*.99,y,z+.06),Vector3(.5,1.8,.13),color)
			for dy in [-.58,.58]: b._box(Vector3(x+side*.99,y+dy,z+.14),Vector3(.5,.1,.05),"timber")

func house(data: Dictionary):
	var w = float(data.w); var d = float(data.d); var h = float(data.h)
	var variant = int(data.get("variant",abs(int(data.x*3+data.z)))) % 4
	var plaster = ["plaster_ivory","plaster_sage","plaster_ochre","plaster_rose"][variant]
	var roof_material = "slate" if data.roof == "blue" else "tile"
	var floors = maxi(2,roundi(h/3.5)); var level = h/floors
	b._box(Vector3(0,.18,0),Vector3(w+.35,.36,d+.35),"masonry")
	b._box(Vector3(0,level/2,0),Vector3(w,level,d),"masonry")
	b._box(Vector3(0,(h+level)/2,0),Vector3(w+.18,h-level,d+.18),plaster)
	var original = b.orientation
	for side in 4:
		b.orientation = original * Basis(Vector3.UP,side*PI/2)
		var span = w if side%2==0 else d; var front = (d if side%2==0 else w)/2+.12
		for floor in range(1,floors+1):
			b._box(Vector3(0,floor*level,front),Vector3(span+.4,.22,.22),"timber")
		for x in [-span/2+.1,0,span/2-.1]:
			b._box(Vector3(x,(h+level)/2,front),Vector3(.2,h-level,.22),"timber")
		for floor in range(floors):
			for x in [-span*.28,span*.28]:
				window(x,floor*level+level*.55,front+.04,floor>0,"green" if variant%2 else "burgundy")
		if side%2==0:
			for sign in [-1,1]: beam(Vector3(sign*.35,level+.3,front+.15),Vector3(sign*(span/2-.4),2*level-.3,front+.15),.15)
		if side == 0:
			b._box(Vector3(0,1.45,front+.04),Vector3(1.8,2.9,.2),"timber")
			for x in [-.62,-.31,0,.31,.62]: b._box(Vector3(x,1.4,front+.18),Vector3(.24,2.65,.08),"wood")
			b._box(Vector3(.5,1.35,front+.25),Vector3(.1,.3,.1),"ochre")
			b._box(Vector3(0,.1,front+.5),Vector3(2.3,.2,1),"masonry")
			b._box(Vector3(0,3.2,front+.6),Vector3(2.8,.18,1.4),roof_material,.16)
			for x in [-1.1,1.1]: beam(Vector3(x,2.55,front+.05),Vector3(x,3.1,front+1.1),.12)
	b.orientation = original
	roof(w+1,d+1,h+.12,w*.38,roof_material)
	# Труба с оголовком и тёмным устьем.
	b._box(Vector3(w*.29,h+1.7,-d*.22),Vector3(1,4.6,1.15),"masonry")
	b._box(Vector3(w*.29,h+4.02,-d*.22),Vector3(1.3,.25,1.45),"masonry")
	b._box(Vector3(w*.29,h+4.16,-d*.22),Vector3(.7,.02,.85),"iron")
	# Разные силуэты: эркер, балкон или мансардное окно.
	if variant == 0:
		b._box(Vector3(w*.27,level*1.55,d/2+.6),Vector3(2.3,2.7,1.25),plaster)
		window(w*.27,level*1.6,d/2+1.25,false,"green")
		b._box(Vector3(w*.27,level*1.55+1.5,d/2+.6),Vector3(2.7,.2,1.5),roof_material)
	elif variant == 1:
		b._box(Vector3(0,level+.05,d/2+.65),Vector3(4,.2,1.5),"wood")
		for x in [-1.9,-1.3,-.65,0,.65,1.3,1.9]: b._box(Vector3(x,level+.65,d/2+1.35),Vector3(.09,1.2,.09),"timber")
		b._box(Vector3(0,level+1.2,d/2+1.35),Vector3(4,.12,.12),"timber")
	else:
		b._box(Vector3(0,h+1,d/2+.04),Vector3(1.9,1.7,.15),plaster)
		window(0,h+1,d/2+.15,false,"green")
