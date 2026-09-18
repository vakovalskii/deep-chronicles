extends Node3D
const Art = preload("res://scripts/art_assets.gd")
var materials: Dictionary = {}
var shapes: Dictionary = {}
var environment: WorldEnvironment
var sun: DirectionalLight3D
var portals: Array = []
var underground = false
var daylight_energy = 1.1

func build():
	_lighting()
	_terrain()
	_props()
	_models()
	_watchfires()
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
	daylight_energy = sun.light_energy

func set_region(pos: Vector3):
	var is_under = pos.x > 2100
	if is_under == underground: return
	underground = is_under
	var e = environment.environment
	e.background_mode = Environment.BG_COLOR if underground else Environment.BG_SKY
	e.background_color = Color("11121b")
	e.ambient_light_energy = 0.3 if underground else 0.32
	e.fog_light_color = Color("191723") if underground else Color("576675")
	e.fog_density = 0.008 if underground else 0.0015
	sun.light_energy = 0.18 if underground else daylight_energy

func _terrain():
	var material = ShaderMaterial.new()
	material.shader = load("res://shaders/terrain.gdshader")
	for key in ["grass", "forest", "sand", "dirt", "rock", "snow"]:
		var path = "res://assets/terrain/%s.png" % key
		material.set_shader_parameter(key, load(path if ResourceLoader.exists(path) else "res://generated/tex/t_%s.png" % key))
	for key in ["ground", "paving"]:
		for layer in ["albedo", "normal", "roughness"]:
			material.set_shader_parameter(key + "_" + layer, load("res://assets/materials/%s_%s.jpg" % [key, layer]))
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
	var pbr = "paving" if kind in ["cobble", "dfloor", "stone"] else ("masonry" if kind in ["brick", "dbrick"] else "")
	if not pbr.is_empty():
		m.albedo_texture = load("res://assets/materials/%s_albedo.jpg" % pbr)
		m.normal_enabled = true; m.normal_texture = load("res://assets/materials/%s_normal.jpg" % pbr); m.normal_scale = 0.65
		m.roughness_texture = load("res://assets/materials/%s_roughness.jpg" % pbr)
		m.albedo_color = Color("929da7") if pbr == "masonry" else Color("acb0b2")
		m.uv1_triplanar = true; m.uv1_world_triplanar = true; m.uv1_scale = Vector3.ONE * (0.33 if pbr == "masonry" else 0.11)
	materials[key] = m; return m

func _portal(pos: Vector3, col: Color):
	var node = MeshInstance3D.new(); var mesh = TorusMesh.new()
	mesh.inner_radius = 1.9; mesh.outer_radius = 2.2
	node.mesh = mesh; node.position = pos + Vector3.UP * 2.5; node.rotation.x = PI / 2
	var m = StandardMaterial3D.new(); m.albedo_color = col; m.emission_enabled = true; m.emission = col; m.emission_energy_multiplier = 2
	node.material_override = m; add_child(node); portals.append(node)

func _process(dt):
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

func _watchfires():
	# A few warm pools guide the route out of the cold town; range limits mobile cost.
	for town in GameData.world.towns:
		for offset in [Vector2(87, -13), Vector2(87, -3), Vector2(-18, 10), Vector2(18, -16)]:
			var pos = GameData.position_at(town.x + offset.x, town.z + offset.y)
			var lamp = OmniLight3D.new(); lamp.position = pos + Vector3.UP * 2.0
			lamp.light_color = Color("ffa254"); lamp.light_energy = 2.8; lamp.omni_range = 10; lamp.shadow_enabled = false; add_child(lamp)
			var brazier = MeshInstance3D.new(); var bowl = CylinderMesh.new(); bowl.top_radius = 0.38; bowl.bottom_radius = 0.16; bowl.height = 0.45
			brazier.mesh = bowl; brazier.position = pos + Vector3.UP * 1.55
			var iron = StandardMaterial3D.new(); iron.albedo_color = Color("292e32"); iron.metallic = 0.75; iron.roughness = 0.65; brazier.material_override = iron; add_child(brazier)
			var post = MeshInstance3D.new(); var shaft = CylinderMesh.new(); shaft.top_radius = 0.09; shaft.bottom_radius = 0.2; shaft.height = 1.4
			post.mesh = shaft; post.material_override = iron; post.position = pos + Vector3.UP * 0.7; add_child(post)
			var ember = MeshInstance3D.new(); var flame = SphereMesh.new(); flame.radius = 0.23; flame.height = 0.32
			ember.mesh = flame; ember.position = pos + Vector3.UP * 1.82
			var glow = StandardMaterial3D.new(); glow.albedo_color = Color("ff973d"); glow.emission_enabled = true; glow.emission = Color("ff6c23"); glow.emission_energy_multiplier = 2.5; ember.material_override = glow; add_child(ember)
