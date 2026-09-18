extends SubViewportContainer
var profile: Dictionary = {}
var actor: Node3D
var view: SubViewport
var rotating = false
var compact = false

func _ready():
	custom_minimum_size = Vector2(112, 220) if compact else Vector2(220, 210); stretch = true; mouse_filter = Control.MOUSE_FILTER_STOP
	view = SubViewport.new(); view.size = Vector2i(360, 210); view.own_world_3d = true; view.render_target_update_mode = SubViewport.UPDATE_WHEN_VISIBLE; add_child(view)
	var scene = Node3D.new(); view.add_child(scene)
	var environment = WorldEnvironment.new(); var env = Environment.new(); environment.environment = env
	env.background_mode = Environment.BG_CLEAR_COLOR if compact else Environment.BG_COLOR; env.background_color = Color("171b23")
	view.transparent_bg = compact
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR; env.ambient_light_color = Color("91a1ba"); env.ambient_light_energy = 0.7; scene.add_child(environment)
	var key = DirectionalLight3D.new(); key.rotation_degrees = Vector3(-35, -30, 0); key.light_color = Color("ffe0b3"); key.light_energy = 1.4; scene.add_child(key)
	var fill = OmniLight3D.new(); fill.position = Vector3(-2, 2, -2); fill.light_color = Color("759dde"); fill.light_energy = 2; scene.add_child(fill)
	var floor_mesh = MeshInstance3D.new(); var cylinder = CylinderMesh.new(); cylinder.top_radius = 1.3; cylinder.bottom_radius = 1.35; cylinder.height = 0.13; cylinder.radial_segments = 48
	floor_mesh.mesh = cylinder; floor_mesh.position.y = -0.065
	var material = StandardMaterial3D.new(); material.albedo_texture = load("res://assets/terrain/cobble.png"); material.albedo_color = Color("9b8a70"); material.roughness = 0.9; floor_mesh.material_override = material; scene.add_child(floor_mesh)
	actor = load("res://scripts/actor.gd").new(); actor.kind = "self"; scene.add_child(actor); actor.setup(profile.cls, "")
	actor.apply_look(GameData.appearance(profile)); actor.rotation.y = -0.25; actor.label.hide()
	var camera = Camera3D.new(); scene.add_child(camera); camera.position = Vector3(0, 1.9, 5.5); camera.look_at(Vector3(0, 1.25, 0)); camera.fov = 33; camera.current = true
	tooltip_text = "Потяните мышью, чтобы повернуть персонажа"

func _gui_input(event):
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT: rotating = event.pressed; accept_event()
	elif event is InputEventMouseMotion and rotating: actor.rotation.y += event.relative.x * 0.015; accept_event()
	elif event is InputEventScreenDrag: actor.rotation.y += event.relative.x * 0.015; accept_event()
