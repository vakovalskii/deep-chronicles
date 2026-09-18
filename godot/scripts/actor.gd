extends Node3D
## A native scene with imported mesh and AnimationPlayer; no browser runtime.
const Art = preload("res://scripts/art_assets.gd")
var art_model = false
var base_model = ""
var active_art = ""
var entity_id = 0
var kind = "m"
var definition: Dictionary = {}
var model: Node3D
var animator: AnimationPlayer
var label: Label3D
var hp = 100.0
var dead = false
var death_elapsed = 0.0
var model_rest_y = 0.0
var moving = false
var casting = false
var attack_time = 0.0
var radius = 0.6
var seen = 0
var snapshots: Array = []
var selected = false
var status = 0
var look: Dictionary = {}
var display_name = ""
var last_clip = ""
var weapon_node: Node3D
var shield_node: Node3D
var helm_node: Node3D
var bubble: Label3D
var bubble_until = 0

func setup(model_id: String, title: String, def: Dictionary = {}):
	definition = def; display_name = title; base_model = model_id
	radius = float(def.get("size", 1)) * 0.9 if kind == "m" else 0.6
	var art_id = str(def.get("role", model_id)) if kind == "n" else model_id
	if art_id == "guard": art_id = "warrior_chain"
	active_art = art_id
	model = Art.actor(art_id)
	art_model = model != null
	if not model:
		var asset_id = "mage_generated" if model_id == "mage" else model_id
		model = Art.packed("res://generated/actors/%s.glb" % asset_id).instantiate()
	add_child(model)
	model_rest_y = model.position.y
	animator = model.find_child("AnimationPlayer", true, false)
	if animator:
		for clip in animator.get_animation_list():
			if clip in ["idle", "walk", "cast"]: animator.get_animation(clip).loop_mode = Animation.LOOP_LINEAR
			if clip == "death": animator.get_animation(clip).loop_mode = Animation.LOOP_NONE
	if art_model and art_id in ["warrior", "warrior_chain", "mage"]: _attach_weapon("warrior" if art_id == "warrior_chain" else art_id)
	else:
		weapon_node = model.find_child("weapon", true, false)
		shield_node = model.find_child("shield", true, false)
		helm_node = model.find_child("helmet", true, false)
	if shield_node: shield_node.visible = false
	if helm_node: helm_node.visible = false
	if kind == "n" and weapon_node: weapon_node.visible = false
	label = Label3D.new(); label.text = title
	label.position.y = maxf(2.9, 2.7 * float(def.get("size", 1)))
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED; label.font_size = 38; label.pixel_size = 0.012
	label.modulate = Color("e7d8ab") if kind == "n" else Color.WHITE
	label.outline_modulate = Color("18201b"); label.outline_size = 10
	add_child(label)

func apply_look(data: Dictionary):
	if data == look: return
	if art_model and base_model == "warrior" and kind != "n":
		var desired = "warrior_chain" if data.get("mat", "cloth") in ["chain", "plate"] else "warrior"
		if desired != active_art:
			var replacement = Art.actor(desired)
			if replacement:
				model.queue_free(); model = replacement; add_child(model); active_art = desired
				animator = model.find_child("AnimationPlayer", true, false); last_clip = ""
				weapon_node = null; shield_node = null; helm_node = null
				_attach_weapon("warrior")
	if art_model and weapon_node:
		var desired_weapon = "mage" if data.get("staff", base_model == "mage") else "warrior"
		if weapon_node.get_meta("weapon_kind", "") != desired_weapon:
			var skeleton = model.find_child("Skeleton3D", true, false)
			for attachment_name in ["RightHandEquipment", "LeftArmEquipment"]:
				var old = skeleton.get_node_or_null(attachment_name)
				if old: old.free()
			weapon_node = null; shield_node = null; _attach_weapon(desired_weapon)
	look = data.duplicate(true)
	var gear = data.get("gear", {})
	if weapon_node: weapon_node.visible = data.get("w") != null
	if shield_node: shield_node.visible = gear.get("shield") != null
	if helm_node: helm_node.visible = gear.get("head") != null
	if art_model:
		if weapon_node:
			for mesh in weapon_node.find_children("*", "MeshInstance3D", true, false):
				var material = mesh.get_active_material(0)
				if material is StandardMaterial3D and material.metallic > 0.1:
					material = material.duplicate()
					if data.get("w") != null: material.albedo_color = GameData.color(data.w)
					material.emission_enabled = data.get("ench", 0) >= 4; material.emission = Color("77cfff"); material.emission_energy_multiplier = 0.6
					mesh.material_override = material
		if shield_node and gear.get("shield") != null:
			var material = shield_node.get_active_material(0).duplicate(); material.albedo_color = GameData.color(gear.shield); shield_node.material_override = material
		return
	var colors = {"body": data.get("body"), "helmet": gear.get("head"), "legs": gear.get("legs"), "gloves": gear.get("gloves"), "feet": gear.get("feet"), "shield": gear.get("shield")}
	for node in model.find_children("*", "MeshInstance3D", true, false):
		for surface in node.mesh.get_surface_count():
			var mat = node.get_active_material(surface)
			if mat is StandardMaterial3D:
				mat = mat.duplicate()
				var key = mat.resource_name
				if colors.get(key) != null: mat.albedo_color = GameData.color(colors[key])
				if key == "body":
					var tex = "robe" if data.get("robe", false) else {"cloth": "leather", "plate": "plate", "chain": "chain", "leather": "leather"}.get(data.get("mat", "cloth"), "leather")
					mat.albedo_texture = load("res://generated/tex/%s.png" % tex)
				node.set_surface_override_material(surface, mat)
	if weapon_node:
		for node in weapon_node.find_children("*", "MeshInstance3D", true, false):
			var mat = StandardMaterial3D.new(); mat.albedo_color = GameData.color(data.get("w", 0xaaaaaa) if data.get("w") != null else 0xaaaaaa)
			if data.get("ench", 0) >= 4:
				mat.emission_enabled = true; mat.emission = Color("77cfff"); mat.emission_energy_multiplier = 1.2
			node.material_override = mat

func snapshot(row: Array, timestamp: float):
	var pos = Vector3(row[1], row[2], row[3])
	if snapshots.is_empty() or position.distance_to(pos) > 30:
		snapshots.clear(); position = pos; rotation.y = row[4]
	snapshots.append({"t": timestamp, "p": pos, "r": row[4]})
	if snapshots.size() > 30: snapshots.pop_front()
	var flags = int(row[5]); moving = (flags & 1) != 0; casting = (flags & 4) != 0
	if (flags & 2) != 0: attack_time = 0.3
	dead = (flags & 8) != 0; hp = row[6]
	status = int(row[7]) if row.size() > 7 else 0
	seen = Time.get_ticks_msec(); visible = true

func interpolate(time: float):
	while snapshots.size() > 2 and snapshots[1].t <= time: snapshots.pop_front()
	if snapshots.size() < 2: return
	var a = snapshots[0]; var b = snapshots[1]
	var factor = clampf((time - a.t) / maxf(1, b.t - a.t), 0, 1.5)
	position = a.p.lerp(b.p, factor); rotation.y = lerp_angle(a.r, b.r, minf(1, factor))

func _process(dt):
	attack_time = maxf(0, attack_time - dt)
	if is_instance_valid(bubble): bubble.visible = Time.get_ticks_msec() < bubble_until and not dead
	if not model: return
	death_elapsed = death_elapsed + dt if dead else 0.0
	if kind == "m": model.position.y = model_rest_y - maxf(0, death_elapsed - 3.0) * 0.65
	if not animator or not animator.has_animation("death"):
		model.rotation.z = lerp_angle(model.rotation.z, PI / 2 if dead else 0, minf(1, dt * 10))
	var clip = "attack" if attack_time > 0 else ("cast" if casting else ("walk" if moving else "idle"))
	if dead: clip = "death" if animator and animator.has_animation("death") else "idle"
	if animator and clip != last_clip and animator.has_animation(clip):
		animator.play(clip, 0.15); last_clip = clip
	if label:
		label.text = display_name + (" · повержен" if dead else "")
		label.modulate = Color("ffe3a6") if selected else (Color("ff7373") if status == 2 else (Color("d49bff") if status == 1 else (Color("e7d8ab") if kind == "n" else Color.WHITE)))

func _attach_weapon(id: String):
	var skeleton = model.find_child("Skeleton3D", true, false)
	if not skeleton: return
	var donor = Art.packed("res://generated/actors/%s.glb" % id).instantiate()
	var weapon = donor.find_child("weapon", true, false)
	if weapon:
		weapon.get_parent().remove_child(weapon)
		weapon.owner = null
		for child in weapon.find_children("*", "", true, false): child.owner = null
		var attachment = BoneAttachment3D.new(); attachment.name = "RightHandEquipment"; attachment.bone_name = "DEF-hand.R"
		skeleton.add_child(attachment)
		var grip = Node3D.new(); grip.name = "WeaponGrip"; attachment.add_child(grip)
		# Bone origin is the wrist; +Y follows the fingers. The canonical rig
		# and equipment use +Z for the forward edge of the palm/blade.
		grip.position = Vector3(0, 0.075, -0.015)
		grip.add_child(weapon)
		weapon.transform = Transform3D.IDENTITY
		weapon.rotation = Vector3.ZERO
		weapon.scale = Vector3.ONE * (0.8 / model.scale.x)
		var handle_center = Vector3(0, 0, 0.14 if id == "warrior" else 0.0)
		weapon.position = -(weapon.basis * handle_center)
		weapon.set_meta("handle_center", handle_center)
		weapon.set_meta("weapon_kind", id)
		weapon_node = weapon
	var shield = donor.find_child("shield", true, false)
	if shield:
		shield.get_parent().remove_child(shield); shield.owner = null
		var attachment = BoneAttachment3D.new(); attachment.name = "LeftArmEquipment"; attachment.bone_name = "DEF-forearm.L"
		skeleton.add_child(attachment); attachment.add_child(shield)
		shield.position = Vector3(0.1, 0.16, 0); shield.rotation = Vector3.ZERO; shield.scale *= 0.9 / model.scale.x
		shield_node = shield; shield.visible = false
	donor.free()

func speak(text: String):
	if not is_instance_valid(bubble):
		bubble = Label3D.new(); bubble.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		bubble.font_size = 30; bubble.pixel_size = 0.012; bubble.outline_size = 8
		bubble.modulate = Color("fff5d8"); bubble.position.y = label.position.y + 0.5; add_child(bubble)
	bubble.text = text.left(60) + ("…" if text.length() > 60 else "")
	bubble_until = Time.get_ticks_msec() + 5000
