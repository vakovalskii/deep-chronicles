extends Node3D
const Art = preload("res://scripts/art_assets.gd")
var materials: Dictionary = {}
var shapes: Dictionary = {}
var environment: WorldEnvironment
var sun: DirectionalLight3D
var portals: Array = []
var underground = false
var atmosphere: Dictionary = {}
var region_id = ""

func build():
	_lighting()
	_terrain()
	_props()
	_models()
	_town_details()
	var town_decor = preload("res://scripts/town_decor.gd").new()
	add_child(town_decor); town_decor.build()
	_portal(GameData.position_at(150, 258.5), Color("9c75ff"))
	_portal(Vector3(2205, 0, -195), Color("c6a4ff"))
	for t in GameData.world.towns: _portal(GameData.position_at(t.x + 18, t.z + 16), Color("70d5f0"))
	for i in 6:
		var light = OmniLight3D.new()
		light.position = Vector3(2200 + (i % 3 + 0.5) * 66, 6, -200 + (int(i / 3.0) + 0.5) * 99)
		light.omni_range = 70; light.light_color = Color("ffb271"); light.light_energy = 2.5
		add_child(light)

func _lighting():
	environment = $WorldEnvironment; sun = $Sun
	environment.environment = environment.environment.duplicate(true)

# Переходы света плавные; подземелье сразу получает тёмный фон неба.
func set_region(pos: Vector3):
	var zone = GameData.zone_at(pos)
	var id = "town" if zone.get("town", false) else str(zone.id)
	if id == region_id: return
	region_id = id; underground = id == "crypt"
	atmosphere = {
		"town": {"fog": Color("b9b3a3"), "density": 0.0018, "sun": Color("ffe0b0"), "energy": 1.2, "ambient": 0.38},
		"meadow": {"fog": Color("a8bec5"), "density": 0.0018, "sun": Color("fff0cf"), "energy": 1.1, "ambient": 0.35},
		"forest": {"fog": Color("788e91"), "density": 0.0032, "sun": Color("dce6da"), "energy": 0.85, "ambient": 0.32},
		"waste": {"fog": Color("baa58b"), "density": 0.0025, "sun": Color("ffdbb6"), "energy": 1.15, "ambient": 0.32},
		"crypt": {"fog": Color("191e30"), "density": 0.008, "sun": Color("9fb1da"), "energy": 0.12, "ambient": 0.23},
	}.get(id, {})
	var e = environment.environment
	e.background_mode = Environment.BG_COLOR if underground else Environment.BG_SKY
	e.background_color = Color("11121b")

func _town_details():
	var cloth = ShaderMaterial.new(); cloth.shader = load("res://shaders/banner.gdshader")
	var iron = StandardMaterial3D.new(); iron.albedo_color = Color("34333b"); iron.metallic = 0.75; iron.roughness = 0.5
	var glow = StandardMaterial3D.new(); glow.albedo_color = Color("ffd398")
	glow.emission_enabled = true; glow.emission = Color("ffb45f"); glow.emission_energy_multiplier = 1.8
	for town in GameData.world.towns:
		for side in [-1, 1]:
			var banner = MeshInstance3D.new(); var fabric = QuadMesh.new(); fabric.size = Vector2(2.1, 5.5)
			banner.mesh = fabric; banner.material_override = cloth
			banner.position = GameData.position_at(town.x + side * 5.3, town.z - 18.8) + Vector3.UP * 9
			banner.visibility_range_end = 160; add_child(banner)
			var rail = MeshInstance3D.new(); var bar = BoxMesh.new(); bar.size = Vector3(2.5, 0.12, 0.18)
			rail.mesh = bar; rail.material_override = iron; rail.position = banner.position + Vector3.UP * 2.8; add_child(rail)
			var lamp = MeshInstance3D.new(); var lantern = CylinderMesh.new()
			lantern.top_radius = 0.2; lantern.bottom_radius = 0.3; lantern.height = 0.65; lantern.radial_segments = 6
			lamp.mesh = lantern; lamp.material_override = glow
			lamp.position = GameData.position_at(town.x + side * 7.0, town.z - 18.8) + Vector3.UP * 5.5; add_child(lamp)
			var light = OmniLight3D.new(); light.position = lamp.position
			light.light_color = Color("ffc07b"); light.light_energy = 1.8; light.omni_range = 9; light.distance_fade_enabled = true
			light.distance_fade_begin = 60; light.distance_fade_length = 20; add_child(light)

func _terrain():
	var material = ShaderMaterial.new()
	material.shader = load("res://shaders/terrain.gdshader")
	for key in ["grass", "forest", "sand", "dirt", "rock", "snow"]:
		var path = "res://assets/terrain/%s.png" % key
		material.set_shader_parameter(key, load(path if ResourceLoader.exists(path) else "res://generated/tex/t_%s.png" % key))
	# Chunked meshes let the engine cull terrain behind the camera.
	for cz in range(-1000, 1000, 100):
		for cx in range(-1000, 1000, 100):
			var vertices = PackedVector3Array(); var normals = PackedVector3Array(); var indices = PackedInt32Array()
			for z in 26:
				for x in 26:
					var px = cx + x * 4.0; var pz = cz + z * 4.0
					vertices.append(GameData.position_at(px, pz))
					normals.append(Vector3(GameData.height_at(px - 1, pz) - GameData.height_at(px + 1, pz), 2, GameData.height_at(px, pz - 1) - GameData.height_at(px, pz + 1)).normalized())
					if x < 25 and z < 25:
						var a = z * 26 + x
						indices.append_array(PackedInt32Array([a, a + 1, a + 26, a + 1, a + 27, a + 26]))
			var arrays = []; arrays.resize(Mesh.ARRAY_MAX)
			arrays[Mesh.ARRAY_VERTEX] = vertices; arrays[Mesh.ARRAY_NORMAL] = normals; arrays[Mesh.ARRAY_INDEX] = indices
			var mesh = ArrayMesh.new(); mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
			var node = MeshInstance3D.new(); node.mesh = mesh; node.material_override = material
			node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF; add_child(node)
	var water = MeshInstance3D.new(); var plane = PlaneMesh.new(); plane.size = Vector2(2000, 2000)
	water.mesh = plane; water.position.y = -6.5
	var wm = StandardMaterial3D.new(); wm.albedo_color = Color(0.24, 0.5, 0.65, 0.86)
	wm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; wm.roughness = 0.25
	wm.albedo_texture = load("res://generated/tex/water.png"); wm.uv1_scale = Vector3(160, 160, 160)
	water.material_override = wm; water.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF; add_child(water)

func _props():
	var box = BoxMesh.new(); box.size = Vector3.ONE; shapes.box = box
	for key in ["cone", "cone4", "cyl"]:
		var mesh = CylinderMesh.new(); mesh.height = 1
		mesh.bottom_radius = 0.75 if key == "cone4" else 0.5
		mesh.top_radius = 0.5 if key == "cyl" else 0.0
		mesh.radial_segments = 4 if key == "cone4" else (32 if key == "cyl" else 7)
		shapes[key] = mesh
	var ico = SphereMesh.new(); ico.radius = 1; ico.height = 2; ico.radial_segments = 8; ico.rings = 4; shapes.ico = ico
	var groups: Dictionary = {}
	for row in GameData.world.shapes:
		var key = "%s_%s_%s_%s_%s" % [row[0], int(row[1]), row[9], floori(row[2] / 200), floori(row[4] / 200)]
		if not groups.has(key): groups[key] = []
		groups[key].append(row)
	for rows in groups.values():
		var first = rows[0]
		var mm = MultiMesh.new(); mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = shapes[first[0]]; mm.instance_count = rows.size()
		for i in rows.size():
			var r = rows[i]
			var rotation_y = r[5] + (PI / 4 if r[0] == "cone4" else 0)
			var basis = Basis(Vector3.UP, rotation_y).scaled_local(Vector3(r[6], r[7], r[8]))
			mm.set_instance_transform(i, Transform3D(basis, Vector3(r[2], r[3], r[4])))
		var node = MultiMeshInstance3D.new(); node.multimesh = mm
		node.material_override = _material(int(first[1]), first[9]); add_child(node)

func _material(value: int, kind: String) -> Material:
	var key = str(value) + kind
	if materials.has(key): return materials[key]
	var m = StandardMaterial3D.new(); m.roughness = 0.9
	m.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
	m.albedo_color = GameData.color(value)
	var path = "res://assets/terrain/%s.png" % kind
	if not ResourceLoader.exists(path): path = "res://generated/tex/%s.png" % kind
	if ResourceLoader.exists(path):
		m.albedo_texture = load(path)
		m.uv1_triplanar = true; m.uv1_world_triplanar = true
		m.uv1_scale = Vector3.ONE * 0.25
		if kind in ["cobble", "dbrick", "dfloor", "roof_blue", "roof_red", "sandstone", "water"]: m.albedo_color = Color.WHITE
	materials[key] = m; return m

func _portal(pos: Vector3, col: Color):
	var node = MeshInstance3D.new(); var mesh = TorusMesh.new()
	mesh.inner_radius = 1.9; mesh.outer_radius = 2.2
	node.mesh = mesh; node.position = pos + Vector3.UP * 2.5; node.rotation.x = PI / 2
	var m = StandardMaterial3D.new(); m.albedo_color = col; m.emission_enabled = true; m.emission = col; m.emission_energy_multiplier = 2
	node.material_override = m; add_child(node); portals.append(node)

func _process(dt):
	if not atmosphere.is_empty():
		var blend = 1.0 - exp(-dt * 1.8)
		var e = environment.environment
		e.fog_light_color = e.fog_light_color.lerp(atmosphere.fog, blend)
		e.fog_density = lerpf(e.fog_density, atmosphere.density, blend)
		e.ambient_light_energy = lerpf(e.ambient_light_energy, atmosphere.ambient, blend)
		sun.light_color = sun.light_color.lerp(atmosphere.sun, blend)
		sun.light_energy = lerpf(sun.light_energy, atmosphere.energy, blend)
	for p in portals: p.rotate_y(dt * 0.35)

func _models():
	var groups: Dictionary = {}
	for row in GameData.world.get("modelPlacements", []):
		var key = "%s_%s_%s" % [row[0], floori(row[1] / 100), floori(row[3] / 100)]
		if not groups.has(key): groups[key] = []
		groups[key].append(row)
	var sources: Dictionary = {}
	for rows in groups.values():
		var id = rows[0][0]
		var path = "res://assets/props/%s.glb" % id
		if not ResourceLoader.exists(path): continue
		if not sources.has(id):
			var source = Art.packed(path).instantiate()
			var parts: Array = []
			for mesh in source.find_children("*", "MeshInstance3D", true, false):
				var local = mesh.transform; var parent = mesh.get_parent()
				while parent != source and parent is Node3D:
					local = parent.transform * local; parent = parent.get_parent()
				parts.append({"mesh": mesh.mesh, "transform": local})
			sources[id] = {"box": Art.aabb(source), "parts": parts}
			source.free()
		var box: AABB = sources[id].box
		for part in sources[id].parts:
			var mm = MultiMesh.new(); mm.transform_format = MultiMesh.TRANSFORM_3D
			mm.mesh = part.mesh; mm.instance_count = rows.size()
			for i in rows.size():
				var r = rows[i]
				var scale_3d = Vector3(r[5] / maxf(box.size.x, .01), r[6] / maxf(box.size.y, .01), r[7] / maxf(box.size.z, .01))
				var basis = Basis(Vector3.UP, r[4]).scaled_local(scale_3d)
				var offset = Vector3(-box.get_center().x, -box.position.y, -box.get_center().z)
				var transform = Transform3D(basis, Vector3(r[1], r[2], r[3]) + basis * offset)
				mm.set_instance_transform(i, transform * part.transform)
			var node = MultiMeshInstance3D.new(); node.name = "Art_" + id; node.multimesh = mm
			node.visibility_range_end = 360 if id in ["oak", "pine", "rock_a", "rock_b", "bush"] else 800
			node.visibility_range_end_margin = 30
			add_child(node)
