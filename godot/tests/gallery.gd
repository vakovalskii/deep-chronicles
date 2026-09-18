extends SceneTree
const Art = preload("res://scripts/art_assets.gd")
var Actor
var models: Array = []
var output = "/tmp/khroniki-model-gallery.png"
func _initialize(): _run.call_deferred()
func _run():
	Actor = load("res://scripts/actor.gd")
	var scene = Node3D.new(); root.add_child(scene)
	var environment = WorldEnvironment.new(); environment.environment = load("res://resources/daylight.tres"); scene.add_child(environment)
	var sun = DirectionalLight3D.new(); sun.rotation_degrees = Vector3(-45, -30, 0); sun.light_energy = 1.1; sun.shadow_enabled = true; scene.add_child(sun)
	var plane = MeshInstance3D.new(); plane.mesh = PlaneMesh.new(); plane.mesh.size = Vector2(100,100)
	var mat = StandardMaterial3D.new(); mat.albedo_color = Color("8e9582"); plane.material_override = mat; scene.add_child(plane)
	var ids = ["warrior", "mage", "merchant", "gatekeeper", "wolf"]
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--models="): ids = Array(arg.trim_prefix("--models=").split(","))
		if arg.begins_with("--output="): output = arg.trim_prefix("--output=")
	for i in ids.size():
		var actor = Actor.new(); actor.kind = "n"; scene.add_child(actor); actor.setup(ids[i], ids[i]); actor.position.x = (i - (ids.size()-1) * 0.5) * 3.2
		models.append(actor)
	var camera = Camera3D.new(); scene.add_child(camera); camera.position = Vector3(1.5, 5.2, maxf(9, ids.size() * 2.5)); camera.look_at(Vector3(0,1.3,0)); camera.fov = 45; camera.current = true
	await create_timer(2).timeout
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(output)
	print("GALLERY ", output)
	quit()
