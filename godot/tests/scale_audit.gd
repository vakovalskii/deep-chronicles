extends SceneTree
## A rendered, reproducible comparison: bodies, collision footprints, loot and gait.
const Art = preload("res://scripts/art_assets.gd")
var output = "user://scale-audit.png"
func _initialize(): _run.call_deferred()
func _run():
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--output="): output = arg.trim_prefix("--output=")
	var scene = Node3D.new(); root.add_child(scene)
	var env = WorldEnvironment.new(); env.environment = load("res://resources/daylight.tres"); scene.add_child(env)
	var sun = DirectionalLight3D.new(); sun.rotation_degrees = Vector3(-50, -30, 0); sun.light_energy = 1.0; scene.add_child(sun)
	var plane = MeshInstance3D.new(); plane.mesh = PlaneMesh.new(); plane.mesh.size = Vector2(70,70)
	var mat = StandardMaterial3D.new(); mat.albedo_color = Color("525d62"); plane.material_override = mat; scene.add_child(plane)
	var report = {"actors": {}, "loot": {}, "units": "world units; humanoid reference height 2.5"}
	var catalog = root.get_node("GameData").catalog
	var ids = ["warrior", "mage", "rabbit", "wolf", "boar", "goblin", "orc"]
	for id in Art.manifest().actors:
		var actor = Art.actor(id); scene.add_child(actor)
		var box = actor.transform * Art.aabb(actor)
		var row = {"height": box.size.y, "width": box.size.x, "depth": box.size.z, "ground": box.position.y,
			"collision_radius": float(catalog.MOBS.get(id, {}).get("size", 0.66667)) * 0.9}
		var animator = actor.find_child("AnimationPlayer", true, false)
		var skeleton = actor.find_child("Skeleton3D", true, false)
		if animator and skeleton and animator.has_animation("run") and skeleton.find_bone("DEF-foot.L") >= 0:
			var foot = skeleton.find_bone("DEF-foot.L"); var min_z = INF; var max_z = -INF
			animator.play("run"); var clip = animator.get_animation("run")
			for sample in 40:
				animator.seek(clip.length * sample / 40.0, true); animator.advance(0)
				var pos = skeleton.global_transform * skeleton.get_bone_global_pose(foot).origin
				min_z = minf(min_z,pos.z); max_z = maxf(max_z,pos.z)
			row.run_clip_seconds = clip.length; row.foot_fore_aft = max_z-min_z
		row.hero_run_speed = catalog.CLASSES.get(id, {}).get("base", {}).get("speed", null)
		report.actors[id] = row
		if not ids.has(id): actor.queue_free(); continue
		actor.position.x += (ids.find(id)-3)*3.5
		if animator: animator.play("idle"); animator.seek(0.2,true); animator.advance(0); animator.pause()
		var label = Label3D.new(); label.text = "%s\n%.2f" % [id,box.size.y]; label.position = Vector3((ids.find(id)-3)*3.5, box.size.y+0.45,0)
		label.billboard = BaseMaterial3D.BILLBOARD_ENABLED; label.font_size=30; label.pixel_size=.01; scene.add_child(label)
	for i in 2:
		var loot = load("res://scripts/ground_loot.gd").new(); scene.add_child(loot)
		var id = "coins" if i==0 else "potion_hp"
		loot.setup({"id":id,"item":id,"n":12,"available":true,"x":0,"y":0,"z":0,"ownerName":""})
		loot.position = Vector3(-2+i*3,0,4); loot.age=1; loot.set_process(false)
		var box = Art.aabb(loot.body)
		report.loot[id] = {"body_height": box.size.y, "body_width": box.size.x, "label_height": loot.label.position.y}
	var camera = Camera3D.new(); scene.add_child(camera); camera.position=Vector3(0,8,24); camera.look_at(Vector3(0,1.0,0));camera.fov=53;camera.current=true
	await process_frame; await process_frame
	var failures = 0
	for id in report.actors:
		var row = report.actors[id]
		if absf(row.ground) > 0.01 or row.height < 0.4 or row.height > 6: failures+=1;push_error("Invalid body scale: "+id)
	for row in report.loot.values():
		if row.body_height > 0.4 or row.body_width > 0.6 or row.label_height > 0.8: failures+=1;push_error("Oversized loot")
	if DisplayServer.get_name() != "headless":
		await RenderingServer.frame_post_draw; root.get_texture().get_image().save_png(output)
	var file = FileAccess.open(output + ".json", FileAccess.WRITE);file.store_string(JSON.stringify(report,"  "));file.close()
	print("SCALE_AUDIT actors=", report.actors.size(), " loot=2 failures=", failures)
	quit(1 if failures else 0)
