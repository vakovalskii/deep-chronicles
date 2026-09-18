extends Node3D
## Рынок и сквер: расстановка и препятствия приходят из общего каталога мира.
const Art = preload("res://scripts/art_assets.gd")
var materials: Dictionary = {}
var groups: Dictionary = {}
var origin = Vector3.ZERO
var orientation = Basis.IDENTITY

func build():
	_material("wood", Color("76523b"))
	_material("stone", Color.WHITE, "res://assets/terrain/cobble.png")
	_material("iron", Color("383a40"))
	_material("soil", Color("39372a"))
	_material("cream", Color("d7c8a0"))
	_material("burgundy", Color("743740")); _material("ochre", Color("b78b42")); _material("green", Color("4e7264"))
	_material("leaf", Color("52613c")); _material("flower", Color("bd7ca0")); _material("fruit", Color("bd5636"))
	var glow = _material("glow", Color("ffcc80")); glow.emission_enabled = true; glow.emission = Color("ffb365"); glow.emission_energy_multiplier = 1.2
	for road in GameData.world.get("townRoads", []):
		origin = GameData.position_at(road.x, road.z); orientation = Basis.IDENTITY
		_box(Vector3(0,.05,0),Vector3(road.w,.08,road.d),"stone")
	for shop in GameData.world.get("townShops", []):
		origin = GameData.position_at(shop.x, shop.z); orientation = Basis.IDENTITY
		_shop(shop)
	for item in GameData.world.get("townDecor", []):
		origin = GameData.position_at(item.x, item.z)
		orientation = Basis(Vector3.UP, float(item.rotation))
		match item.kind:
			"stall": _stall(item.color)
			"bench": _bench()
			"planter": _planter()
			"tree": _tree()
			"barrels":
				_barrel(Vector3(-0.6,0,0)); _barrel(Vector3(0.6,0,0.3))
			"lamp": _lamp()
	for group in groups.values():
		var mm = MultiMesh.new(); mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = group.mesh; mm.instance_count = group.transforms.size()
		for i in mm.instance_count: mm.set_instance_transform(i, group.transforms[i])
		var instance = MultiMeshInstance3D.new(); instance.multimesh = mm; instance.material_override = group.material; instance.position = group.anchor
		instance.visibility_range_end = 180; instance.visibility_range_end_margin = 20; add_child(instance)

func _material(id: String, color: Color, texture_path = "") -> StandardMaterial3D:
	var m = StandardMaterial3D.new(); m.albedo_color = color; m.roughness = 0.88
	if not texture_path.is_empty() and ResourceLoader.exists(texture_path):
		m.albedo_texture = load(texture_path); m.uv1_triplanar = true; m.uv1_world_triplanar = true; m.uv1_scale = Vector3.ONE * 0.25
	if id == "iron": m.metallic = 0.65; m.roughness = 0.48
	materials[id] = m; return m

func _part(mesh: Mesh, pos: Vector3, id: String, key: String, rotation = Basis.IDENTITY):
	var anchor = Vector3(floorf(origin.x / 100) * 100, 0, floorf(origin.z / 100) * 100)
	key += id + str(anchor)
	if not groups.has(key): groups[key] = {"mesh": mesh, "material": materials[id], "anchor": anchor, "transforms": []}
	groups[key].transforms.append(Transform3D(orientation * rotation, origin + orientation * pos - anchor))

func _box(pos: Vector3, size: Vector3, id: String, angle = 0.0):
	var mesh = BoxMesh.new(); mesh.size = size
	_part(mesh, pos, id, "box" + str(size), Basis(Vector3.RIGHT, angle))

func _cylinder(pos: Vector3, radius: float, height: float, id: String):
	var mesh = CylinderMesh.new(); mesh.top_radius = radius; mesh.bottom_radius = radius; mesh.height = height; mesh.radial_segments = 12
	_part(mesh, pos, id, "cylinder%s,%s" % [radius,height])

func _stall(color: String):
	for x in [-2.1, 2.1]:
		for z in [-1.1, 1.1]: _box(Vector3(x,1.65,z), Vector3(.14,3.3,.14), "wood")
	_box(Vector3(0,1.05,.65), Vector3(4.4,.17,1.15), "wood")
	for x in [-1.9,-.95,0,.95,1.9]: _box(Vector3(x,.58,1.15), Vector3(.86,.9,.1), "wood")
	for i in 8:
		var color_id = color if i % 2 == 0 else "cream"
		for side in [-1,1]:
			_box(Vector3(-2.1+i*.6,3.35,side*.7), Vector3(.6,.045,1.55), color_id, side*.3)
		_box(Vector3(-2.1+i*.6,3.0,1.43), Vector3(.6,.32,.05), color_id)
	for x in [-1.3,0,1.3]:
		_box(Vector3(x,1.2,.65), Vector3(1,.2,.75), "wood")
		for i in 5: _cylinder(Vector3(x-.3+(i%3)*.27,1.4,.45+int(i/3.0)*.25),.13,.19,"fruit" if color == "burgundy" else "ochre")
	_box(Vector3(-1.3,.4,-.5),Vector3(.8,.8,.8),"wood")
	_barrel(Vector3(1.35,0,-.5))

func _barrel(pos: Vector3):
	_cylinder(pos+Vector3.UP*.55,.48,1.1,"wood")
	for y in [.14,.92]: _cylinder(pos+Vector3.UP*y,.495,.085,"iron")
	_cylinder(pos+Vector3.UP*1.11,.44,.04,"wood")

func _bench():
	for x in [-1.3,1.3]: _box(Vector3(x,.37,0),Vector3(.2,.75,.85),"iron")
	for z in [-.3,0,.3]: _box(Vector3(0,.8,z),Vector3(3.5,.14,.24),"wood")
	for x in [-1.5,1.5]: _box(Vector3(x,1.1,-.38),Vector3(.13,1.1,.13),"iron")
	for y in [1.12,1.45]: _box(Vector3(0,y,-.4),Vector3(3.5,.26,.12),"wood")

func _planter():
	_cylinder(Vector3(0,.2,0),1.8,.4,"stone")
	_cylinder(Vector3(0,.42,0),1.6,.05,"soil")
	for i in 18:
		var angle = i*2.4; var radius = .3+float(i%4)*.33
		var pos = Vector3(cos(angle)*radius,.6,sin(angle)*radius)
		_box(pos,Vector3(.14,.35,.14),"leaf")
		_cylinder(pos+Vector3.UP*.2,.17,.12,"flower" if i%3 else "cream")

func _tree():
	_cylinder(Vector3(0,.18,0),2,.36,"stone"); _cylinder(Vector3(0,.37,0),1.8,.04,"soil")
	var tree = Art.packed("res://assets/props/oak.glb").instantiate()
	var bounds = Art.aabb(tree); var factor = 10.0 / maxf(.1,bounds.size.y)
	tree.scale = Vector3.ONE * factor
	tree.position = origin + Vector3(-bounds.get_center().x*factor, .4-bounds.position.y*factor, -bounds.get_center().z*factor)
	add_child(tree)

func _lamp():
	_cylinder(Vector3(0,1.9,0),.095,3.8,"iron")
	_cylinder(Vector3(0,.15,0),.28,.3,"stone")
	_box(Vector3(0,4,0),Vector3(.45,.65,.45),"glow")
	for y in [3.65,4.36]: _box(Vector3(0,y,0),Vector3(.62,.12,.62),"iron")
	var light = OmniLight3D.new(); light.position = origin + Vector3.UP*4
	light.light_color = Color("ffcd91"); light.light_energy = 1.1; light.omni_range = 7
	light.distance_fade_enabled = true; light.distance_fade_begin = 35; light.distance_fade_length = 15; add_child(light)

func _shop(shop: Dictionary):
	var house = Art.packed("res://assets/props/house_b.glb" if shop.id == "clothes" else "res://assets/props/house_a.glb").instantiate()
	var bounds = Art.aabb(house)
	var scale_house = Vector3(10.0 / bounds.size.x, 12.0 / bounds.size.y, 7.0 / bounds.size.z)
	house.scale = scale_house; house.position = origin + Vector3(0,0,-7) + Vector3(-bounds.get_center().x,-bounds.position.y,-bounds.get_center().z) * scale_house
	add_child(house)
	# Открытый дворик перед прилавком позволяет войти и видеть продавца с игровой камеры.
	_box(Vector3(0,.06,0),Vector3(10,.12,8),"stone")
	_box(Vector3(0,2.4,-4),Vector3(10,4.8,.35),"cream")
	for x in [-5,5]:
		_box(Vector3(x,2.4,0),Vector3(.35,4.8,8),"cream")
		for z in [-4,0,4]: _box(Vector3(x,2.5,z),Vector3(.3,5,.3),"wood")
		_box(Vector3(x,3.2,0),Vector3(.42,.22,8.3),"wood")
	_box(Vector3(0,1,-1.5),Vector3(8.8,1.8,.9),"wood")
	for x in [-3,-1,1,3]:
		_box(Vector3(x,2.1,-3.4),Vector3(1.8,.15,.6),"wood")
		if shop.id == "weapons":
			_box(Vector3(x,3,-3.2),Vector3(.16,1.7,.1),"iron",-.2)
			_box(Vector3(x,2.45,-3.1),Vector3(.7,.12,.14),"ochre")
		elif shop.id == "clothes":
			_box(Vector3(x,2.8,-3.2),Vector3(.9,1.2,.15),shop.color)
			_box(Vector3(x,3.2,-3.2),Vector3(1.5,.3,.16),shop.color)
		else:
			for dx in [-.5,0,.5]: _cylinder(Vector3(x+dx,2.45,-3.3),.14,.6,"green")
	# Крыша над складской частью; передняя половина — открытая галерея.
	for side in [-1,1]: _box(Vector3(side*2.55,5.5,-2),Vector3(5.4,.2,4.8),shop.color)
	_box(Vector3(0,4.9,4),Vector3(10.4,.35,.4),"wood")
	_box(Vector3(0,4.85,4.3),Vector3(5,.9,.14),shop.color)
	var sign = Label3D.new(); sign.text = shop.name; sign.font_size = 48; sign.pixel_size = .012
	sign.modulate = Color("fff0cc"); sign.outline_size = 6; sign.position = origin + Vector3(0,4.85,4.4)
	sign.visibility_range_end = 100; add_child(sign)
	_barrel(Vector3(3.5,0,-.3))
