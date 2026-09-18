extends SceneTree
var Actor
var failures = 0
var output = "user://native-weapons.png"
func _initialize(): _run.call_deferred()
func _run():
	Actor = load("res://scripts/actor.gd")
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--output="): output = arg.trim_prefix("--output=")
	var scene = Node3D.new(); root.add_child(scene)
	var environment = WorldEnvironment.new(); environment.environment = load("res://resources/daylight.tres"); scene.add_child(environment)
	var sun = DirectionalLight3D.new(); sun.rotation_degrees = Vector3(-45, -30, 0); sun.light_energy = 1.1; sun.shadow_enabled = true; scene.add_child(sun)
	var plane = MeshInstance3D.new(); plane.mesh = PlaneMesh.new(); plane.mesh.size = Vector2(50,50)
	var mat = StandardMaterial3D.new(); mat.albedo_color = Color("83907e"); plane.material_override = mat; scene.add_child(plane)
	var actors: Array = []
	for row in 2:
		for col in 5:
			var id = "warrior" if row == 0 else "mage"
			var actor = Actor.new(); actor.kind = "self"; scene.add_child(actor); actor.setup(id, id + " · " + ["idle", "walk", "run", "attack", "cast_enter"][col])
			actor.position = Vector3((col - 2) * 3.2, 0, row * 4.0); actor.rotation.y = -0.3
			actor.apply_look({"w": 0xbbccd8, "staff": id == "mage", "gear": {}, "ench": 4})
			actor.set_process(false); actor.animator.play(["idle", "walk", "run", "attack", "cast_enter"][col]); actor.animator.seek([0.4, 0.2, 0.22, 0.6, 0.25][col], true); actor.animator.pause()
			actors.append(actor)
	if "--reference" in OS.get_cmdline_user_args():
		for actor in actors: actor.hide()
		var reference = load("res://generated/anims/AnimationLibrary_Godot_Standard.nofingers.gltf").instantiate()
		scene.add_child(reference); reference.scale = Vector3.ONE * 2
		var anim = reference.find_child("AnimationPlayer", true, false); anim.play("Sword_Idle"); anim.seek(0.4, true); anim.pause()
	var camera = Camera3D.new(); scene.add_child(camera); camera.position = Vector3(-1, 7, -20); camera.look_at(Vector3(0, 1, 1.8)); camera.fov = 43; camera.current = true
	await create_timer(0.5).timeout
	for actor in actors:
		var skeleton = actor.model.find_child("Skeleton3D", true, false)
		var hand = skeleton.get_bone_global_pose(skeleton.find_bone("DEF-hand.R"))
		var attachment = actor.weapon_node.get_parent().get_parent()
		var grip = actor.weapon_node.get_parent()
		var wrist_error = (skeleton.global_transform * hand.origin).distance_to(attachment.global_position)
		var handle_error = actor.weapon_node.to_global(actor.weapon_node.get_meta("handle_center")).distance_to(grip.global_position)
		var forward = (skeleton.global_basis * hand.basis.z).normalized()
		var blade = actor.weapon_node.global_basis.z.normalized()
		if wrist_error > 0.001 or handle_error > 0.001 or forward.dot(blade) < 0.999:
			failures += 1; push_error("Weapon grip drift: " + actor.display_name)
		else: print("PASS: palm grip and blade orientation: ", actor.display_name)
	if DisplayServer.get_name() != "headless":
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png(output)
		print("WEAPONS ", ProjectSettings.globalize_path(output))
	print("WEAPON_TEST_RESULT checks=10 failures=", failures)
	quit(0 if failures == 0 else 1)
