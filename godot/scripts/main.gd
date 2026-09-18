extends Node3D
const WorldScene = preload("res://scenes/world.tscn")
const Actor = preload("res://scripts/actor.gd")
const Hud = preload("res://scripts/hud.gd")
var world: Node3D
var camera: Camera3D
var hud: CanvasLayer
var hero: Node3D
var profile: Dictionary = {}
var stats: Dictionary = {}
var buffs: Array = []
var mobs: Dictionary = {}
var players: Dictionary = {}
var npcs: Array = []
var target: Node3D
var destination = Vector3.ZERO
var has_destination = false
var attacking = false
var pending_skill = ""
var talking_to: Node3D
var joystick = Vector2.ZERO
var camera_yaw = 0.45
var camera_pitch = 0.56
var camera_distance = 28.0
var state_timer = 0.0
var ui_timer = 0.0
var cast_time = 0.0
var cooldowns: Dictionary = {}
var last_pm = ""
var own_id = 0
var clock_offset = 0.0
var have_clock = false
var flag_until = 0
var selection: MeshInstance3D
var marker: MeshInstance3D
var touch_start: Dictionary = {}
var touch_positions: Dictionary = {}
var touch_dragged = false
var pending_login: Dictionary = {}
var quick_start = false
var quick_tried = false
var capture_path = ""
var screenshot_done = false
var auth_ready_at = 0
var pvp_enabled = false
var initial_camera = true

func _ready():
	for a in OS.get_cmdline_user_args():
		if a == "--quick-start": quick_start = true
		if a.begins_with("--capture="): capture_path = a.trim_prefix("--capture=")
	world = WorldScene.instantiate(); add_child(world); world.build()
	camera = Camera3D.new(); camera.name = "Camera"; camera.fov = 55; camera.far = 1600; camera.near = 0.2; add_child(camera); camera.current = true
	camera.position = Vector3(-410, 30, 425); camera.look_at(Vector3(-430, 7, 390))
	for n in GameData.world.npcs:
		var actor = Actor.new(); actor.kind = "n"; actor.definition = n
		add_child(actor); actor.setup("warrior" if n.role == "guard" else "npc", n.name, n)
		actor.position = GameData.position_at(n.x, n.z)
		actor.apply_look({"body": n.color, "w": 0xb6c5d1 if n.role == "guard" else null, "mat": "chain" if n.role == "guard" else "cloth", "robe": n.role != "guard", "gear": {}})
		npcs.append(actor)
	selection = _ring(Color("f5c66c"), 1.2); marker = _ring(Color("75e3c7"), 0.7)
	selection.hide(); marker.hide()
	hud = Hud.new(); add_child(hud)
	hud.action.connect(_action); hud.login_requested.connect(_login)
	Network.message.connect(_message); Network.connected.connect(_connected)
	Network.status_changed.connect(func(text): hud.login_message.text = text; if not profile.is_empty(): hud.log_line(text))
	Network.start()
	print("NATIVE_READY")

func _connected():
	if not pending_login.is_empty(): Network.send(pending_login); pending_login = {}; return
	if not profile.is_empty(): Network.resume_session(); return
	if quick_start and not quick_tried:
		quick_tried = true
		if not Network.resume_session():
			var rng = Crypto.new()
			Network.send({"t": "register", "name": "Странник" + str(Time.get_ticks_msec() % 100000), "pass": rng.generate_random_bytes(16).hex_encode(), "cls": "warrior"})

func _login(data: Dictionary):
	var url = hud.server_field.text.strip_edges()
	if url != Network.endpoint or not Network.online:
		pending_login = data; Network.start(url)
	else: Network.send(data)

func _message(m: Dictionary):
	match m.get("t", ""):
		"authok":
			auth_ready_at = Time.get_ticks_msec()
			own_id = int(m.id)
			_clear_entities()
			profile = m.p; stats = GameData.stats(profile)
			if is_instance_valid(hero): hero.queue_free()
			hero = Actor.new(); hero.kind = "self"; hero.name = "Hero"; add_child(hero)
			hero.setup(profile.cls, profile.name); hero.position = GameData.position_at(profile.x, profile.z)
			hero.apply_look(_look_of(profile)); hero.dead = profile.get("dead", false)
			buffs.clear(); cooldowns.clear(); cast_time = 0; has_destination = false; attacking = false
			initial_camera = true
			hud.enter(profile)
			hud.log_line("Добро пожаловать, %s! Хранитель врат перенесёт вас в зону охоты." % profile.name)
			print("NATIVE_AUTH_OK")
		"autherr":
			hud.login_message.text = str(m.reason)
			if not profile.is_empty(): hud.log_line(str(m.reason)); _return_to_login(false)
		"kicked":
			hud.log_line("Этот персонаж вошёл с другого устройства.")
			_return_to_login(false); hud.login_message.text = "Вход с другого устройства. Войдите снова."
		"you":
			if profile.is_empty(): return
			profile = m.p; stats = GameData.stats(profile, buffs)
			hero.dead = profile.get("dead", false); hero.apply_look(_look_of(profile)); hud.update_profile(profile)
		"mobs":
			for row in m.n:
				var id = int(row[0]); var mob_kind = row[1]
				if mobs.has(id): continue
				var actor = Actor.new(); actor.entity_id = id; actor.kind = "m"; add_child(actor)
				var def = GameData.catalog.MOBS[mob_kind]
				actor.setup(mob_kind, "%s · %s" % [def.name, int(def.lvl)], def); actor.hide(); mobs[id] = actor
		"look":
			var id = int(m.id)
			if id == own_id: return
			if not players.has(id):
				var actor = Actor.new(); actor.entity_id = id; actor.kind = "p"; add_child(actor)
				actor.setup(m.look.get("cls", "warrior"), m.name); actor.hide(); players[id] = actor
			players[id].apply_look(m.look)
		"snap":
			if profile.is_empty(): return
			var now = Time.get_unix_time_from_system() * 1000
			var offset = now - m.get("ts", now)
			clock_offset = offset if not have_clock or offset < clock_offset else lerpf(clock_offset, offset, 0.02); have_clock = true
			for row in m.get("o", []):
				if players.has(int(row[0])): players[int(row[0])].snapshot(row, m.get("ts", now))
			for row in m.get("m", []):
				if mobs.has(int(row[0])): mobs[int(row[0])].snapshot(row, m.get("ts", now))
			if m.has("me"):
				profile.hp = m.me.hp; profile.mp = m.me.mp; profile.dead = m.me.dead; hero.dead = m.me.dead
		"ev":
			for e in m.e: _event(e)
		"fix": _place(float(m.x), float(m.z))
		"leave":
			var id = int(m.id)
			if players.has(id):
				if target == players[id]: set_target(null)
				players[id].queue_free(); players.erase(id)
		"me":
			if profile.is_empty(): return
			profile.karma = m.karma; profile.pk = m.pk; profile.pvp = m.pvp
			flag_until = Time.get_ticks_msec() + int(m.get("flag", 0))
		"chat": hud.log_line("[%s] %s: %s" % [{"all": "Общий", "trade": "Торговля", "near": "Рядом"}.get(m.ch, m.ch), m.from, m.text])
		"pm":
			last_pm = m.from if m.from != profile.get("name") else m.to
			hud.log_line("[Личное] %s → %s: %s" % [m.from, m.to, m.text])
		"pmerr": hud.log_line("%s: %s" % [m.to, m.reason])
		"chatwait": hud.log_line("Подождите %.1f с перед следующим сообщением." % (m.wait / 1000.0))
		"announce": hud.log_line(m.text)
		"pvperr": hud.log_line(m.reason); attacking = false
		"washok": hud.log_line("Карма очищена за %s монет." % int(m.cost)); hud.close_window()
		"washerr": hud.log_line("Для очищения нужно %s монет." % int(m.cost))

func _look_of(p: Dictionary) -> Dictionary:
	var items = GameData.catalog.ITEMS
	var weapon = items.get(p.equip.get("weapon"), {})
	var armor = items.get(p.equip.get("armor"), {})
	var gear = {}
	for slot in ["head", "legs", "gloves", "feet", "shield"]: gear[slot] = items.get(p.equip.get(slot), {}).get("color")
	gear.helmKind = items.get(p.equip.get("head"), {}).get("set")
	var mat = {"chain": "chain", "bone": "plate", "leather": "leather"}.get(armor.get("set", ""), "cloth")
	return {"cls": p.cls, "body": armor.get("color", GameData.catalog.CLASSES[p.cls].color), "w": weapon.get("color"), "staff": weapon.get("twoHand", false), "ench": p.get("enc", {}).get("weapon", 0), "robe": armor.get("robe", false) or p.cls == "mage", "mat": mat, "gear": gear}

func _event(e: Dictionary):
	if profile.is_empty(): return
	var source = players.get(int(e.get("by", -1)), hero)
	var victim = mobs.get(int(e.get("m", -1))) if e.has("m") else players.get(int(e.get("p", -1)))
	match e.k:
		"msg": hud.log_line(e.text)
		"cd": cooldowns[e.id] = Time.get_ticks_msec() + float(e.cd) * 1000
		"hit", "miss":
			if is_instance_valid(source): source.attack_time = 0.55
			if is_instance_valid(victim):
				_float(victim.position, "Промах" if e.k == "miss" else str(int(e.dmg)), Color("ffdd79") if e.get("crit", false) else Color.WHITE)
				_effect(victim.position, Color("ffd284"), 0.8)
		"hurt":
			_float(hero.position, "Уклонение" if e.get("dodge", false) else "−%s" % int(e.get("dmg", 0)), Color("ff7777"))
			if not is_instance_valid(target): set_target(mobs.get(int(e.get("from", -1)), players.get(int(e.get("fromP", -1)))))
		"mdie":
			if is_instance_valid(victim): victim.dead = true; victim.hp = 0
			if target == victim: attacking = false; pending_skill = ""
		"kill": hud.log_line("%s повержен. +%s опыта, +%s монет." % [e.name, int(e.xp), int(e.coins)])
		"loot": hud.log_line("Получено: " + GameData.catalog.ITEMS.get(e.id, {}).get("name", e.id))
		"lvl":
			hud.log_line("Новый уровень: %s!" % int(e.lvl)); _float(hero.position, "Уровень %s!" % int(e.lvl), Color("ffe090")); _effect(hero.position, Color("ffe090"), 4)
		"heal": _float(hero.position, "+%s" % int(e.amount), Color("83ffb0")); _effect(hero.position, Color("70e7bb"), 2)
		"cast": cast_time = float(e.t); has_destination = false
		"buff":
			var sk = GameData.catalog.SKILLS[e.id]
			buffs.append({"stat": sk.stat, "mul": sk.mul, "until": Time.get_ticks_msec() + e.dur * 1000})
			hud.log_line(sk.name); _effect(hero.position, GameData.color(sk.color), 3)
		"cast_fx":
			var sk = GameData.catalog.SKILLS[e.id]
			if is_instance_valid(source):
				var hit_target = null
				if e.has("to"):
					hit_target = mobs.get(int(e.to.get("m", -1))) if e.to.has("m") else players.get(int(e.to.get("p", -1)))
				if sk.get("school") == "m" and is_instance_valid(hit_target): _projectile(source.position, hit_target.position, GameData.color(sk.color))
				else: _effect(source.position, GameData.color(sk.color), float(sk.get("radius", 2)))
		"ench": _effect(hero.position, Color("ffc96d") if e.ok else Color("787c89"), 2)
		"dead":
			profile.dead = true; hero.dead = true; attacking = false; cast_time = 0; has_destination = false
			hud.log_line("Вы погибли: %s. Потеря опыта: %s." % [e.by, int(e.loss)])
		"move": _place(float(e.x), float(e.z)); hud.close_window()

func _place(x: float, z: float):
	if not is_instance_valid(hero): return
	hero.position = GameData.position_at(x, z); has_destination = false; attacking = false; pending_skill = ""; talking_to = null
	marker.hide(); initial_camera = true

func _process(dt):
	if profile.is_empty() or not is_instance_valid(hero): return
	dt = minf(dt, 0.1)
	cast_time = maxf(0, cast_time - dt); hero.casting = cast_time > 0; hero.moving = false
	if Network.authed and not hero.dead and cast_time <= 0: _move_hero(dt)
	var time = Time.get_unix_time_from_system() * 1000 - clock_offset - 150
	for actor in mobs.values() + players.values():
		if Time.get_ticks_msec() - actor.seen > 1500: actor.hide()
		elif actor.visible: actor.interpolate(time)
		actor.label.visible = actor.visible and hero.position.distance_to(actor.position) < 50
	for npc in npcs: npc.label.visible = hero.position.distance_to(npc.position) < 60
	if is_instance_valid(target) and target.visible:
		selection.show(); selection.position = target.position + Vector3.UP * 0.12
		selection.scale = Vector3.ONE * maxf(0.75, target.radius)
	else: selection.hide()
	hero.status = 2 if profile.get("karma", 0) > 0 else (1 if flag_until > Time.get_ticks_msec() else 0)
	_update_camera(dt); world.set_region(hero.position)
	state_timer += dt; ui_timer += dt
	if state_timer >= 0.1:
		state_timer = 0
		if Network.authed:
			Network.send({"t": "st", "x": hero.position.x, "y": hero.position.y, "z": hero.position.z, "r": hero.rotation.y, "a": (1 if hero.moving else 0) | (2 if hero.attack_time > 0 else 0) | (4 if hero.casting else 0) | (8 if hero.dead else 0)})
	if ui_timer >= 0.2:
		ui_timer = 0; stats = GameData.stats(profile, buffs)
		hud.update_values(profile, stats, hero.position, target, cooldowns, cast_time)
	if not capture_path.is_empty() and not screenshot_done and Time.get_ticks_msec() > maxi(8000, auth_ready_at + 2500):
		screenshot_done = true; _capture()

func _move_hero(dt):
	var input = joystick
	var focus = get_viewport().gui_get_focus_owner()
	if not focus is LineEdit:
		input += Vector2(float(Input.is_physical_key_pressed(KEY_D)) - float(Input.is_physical_key_pressed(KEY_A)), float(Input.is_physical_key_pressed(KEY_S)) - float(Input.is_physical_key_pressed(KEY_W)))
	var direction = Vector3.ZERO
	var distance = stats.speed * dt
	if input.length() > 0.15:
		_cancel_attack(); has_destination = false; talking_to = null; marker.hide()
		direction = Vector3(input.x, 0, input.y).rotated(Vector3.UP, camera_yaw).normalized()
		distance *= minf(1, input.length())
	elif attacking and is_instance_valid(target) and not target.dead:
		var reach = float(stats.range) + target.radius
		if pending_skill != "": reach = float(GameData.catalog.SKILLS[pending_skill].get("range", stats.range)) + target.radius
		var offset = target.position - hero.position; offset.y = 0
		if offset.length() > reach * 0.94: direction = offset.normalized(); distance = minf(distance, offset.length() - reach * 0.9)
		else:
			hero.rotation.y = atan2(offset.x, offset.z)
			if pending_skill != "":
				Network.send({"t": "skill", "id": pending_skill}); pending_skill = ""
	elif has_destination:
		var offset = destination - hero.position; offset.y = 0
		if offset.length() < (3.5 if is_instance_valid(talking_to) else 0.5):
			has_destination = false; marker.hide()
			if is_instance_valid(talking_to): _open_npc(talking_to); talking_to = null
		else: direction = offset.normalized(); distance = minf(distance, offset.length())
	if direction.length_squared() > 0.1:
		var before = hero.position
		hero.position = GameData.move(hero.position, direction, distance)
		hero.rotation.y = lerp_angle(hero.rotation.y, atan2(direction.x, direction.z), minf(1, dt * 15))
		hero.moving = before.distance_squared_to(hero.position) > 0.00001

func _update_camera(dt):
	var aim = hero.position + Vector3.UP * 1.4
	var offset = Vector3(sin(camera_yaw) * cos(camera_pitch), sin(camera_pitch), cos(camera_yaw) * cos(camera_pitch)) * camera_distance
	var desired = aim + offset
	desired.y = maxf(desired.y, GameData.height_at(desired.x, desired.z) + 1.0)
	if hero.position.x > 2100: desired.y = minf(desired.y, 6.7)
	camera.position = desired if initial_camera else camera.position.lerp(desired, 1 - exp(-dt * 12))
	initial_camera = false; camera.look_at(aim)

func set_target(actor):
	if is_instance_valid(target) and target != actor: _cancel_attack()
	target = actor
	if is_instance_valid(actor) and actor.kind in ["m", "p"]: Network.send({"t": "atk", "id": actor.entity_id, "kind": actor.kind, "hold": true})

func _cancel_attack():
	if attacking: Network.send({"t": "atk", "id": null})
	attacking = false; pending_skill = ""

func attack():
	if not is_instance_valid(target) or target.dead or target.kind == "n": return
	if target.kind == "p" and not pvp_enabled and not Input.is_key_pressed(KEY_CTRL):
		hud.log_line("Для PvP удерживайте Ctrl при атаке или включите PvP в окне персонажа."); return
	attacking = true; has_destination = false; talking_to = null
	Network.send({"t": "atk", "id": target.entity_id, "kind": target.kind})

func use_skill(id: String):
	var sk = GameData.catalog.SKILLS[id]
	if sk.kind == "dmg" and is_instance_valid(target):
		if target.kind == "p" and not pvp_enabled and not Input.is_key_pressed(KEY_CTRL): hud.log_line("Включите PvP в окне персонажа."); return
		Network.send({"t": "atk", "id": target.entity_id, "kind": target.kind, "hold": true})
		var distance = Vector2(target.position.x - hero.position.x, target.position.z - hero.position.z).length()
		if distance > sk.get("range", stats.range) + target.radius:
			pending_skill = id; attacking = true; has_destination = false; return
	Network.send({"t": "skill", "id": id})

func next_target():
	if not is_instance_valid(hero): return
	var list = mobs.values().filter(func(m): return m.visible and not m.dead and hero.position.distance_to(m.position) < 55)
	list.sort_custom(func(a, b): return hero.position.distance_squared_to(a.position) < hero.position.distance_squared_to(b.position))
	if list.is_empty(): return
	set_target(list[(list.find(target) + 1) % list.size()])

func talk_nearest():
	var nearest; var distance = 25.0
	for npc in npcs:
		var d = hero.position.distance_to(npc.position)
		if d < distance and npc.definition.role != "guard": nearest = npc; distance = d
	if nearest: _talk(nearest)
	else: hud.log_line("Подойдите к торговцу, жрецу или хранителю врат.")

func _talk(npc):
	_cancel_attack(); set_target(npc)
	if hero.position.distance_to(npc.position) < 8: _open_npc(npc)
	else: destination = npc.position; has_destination = true; talking_to = npc

func _open_npc(npc):
	var kind = {"merchant": "shop", "gatekeeper": "teleport", "priest": "priest"}.get(npc.definition.role, "")
	if kind != "": hud.show_window(kind)
	else: hud.log_line("Страж охраняет город от убийц.")

func _action(kind: String, value):
	if profile.is_empty(): return
	match kind:
		"inventory", "character", "map": hud.toggle(kind)
		"attack": attack()
		"target": next_target()
		"talk": talk_nearest()
		"joystick": joystick = value
		"respawn": Network.send({"t": "respawn"})
		"logout": _return_to_login(true)
		"pvp": pvp_enabled = not pvp_enabled; hud.log_line("PvP включён" if pvp_enabled else "PvP выключен")
		"hotbar":
			if value < 3: use_skill(GameData.catalog.CLASSES[profile.cls].skills[value])
			else: Network.send({"t": "use", "id": "potion_hp" if value == 3 else "potion_mp"})
		"use", "buy": Network.send({"t": kind, "id": value, "n": 1})
		"equip", "sell": Network.send({"t": kind, "idx": value, "n": 1})
		"equip_slot": Network.send({"t": "equip", "idx": value.idx, "slot": value.slot})
		"unequip": Network.send({"t": "unequip", "slot": value})
		"enchant": Network.send({"t": "ench", "scroll": value.scroll, "ref": value.ref})
		"teleport": Network.send({"t": "tp", "id": value})
		"wash": Network.send({"t": "wash"})
		"chat": _chat(str(value))

func _chat(text: String):
	text = text.strip_edges()
	if text.is_empty(): return
	if text.begins_with("/w "):
		var parts = text.split(" ", false, 2)
		if parts.size() >= 3: Network.send({"t": "pm", "to": parts[1], "text": parts[2]})
	elif text.begins_with("/r ") and not last_pm.is_empty(): Network.send({"t": "pm", "to": last_pm, "text": text.substr(3)})
	else:
		var channel = ["all", "near", "trade"][hud.chat_channel.selected]
		if text.begins_with("+"): channel = "trade"; text = text.substr(1)
		Network.send({"t": "chat", "ch": channel, "text": text})

func _return_to_login(forget: bool):
	if forget: Network.logout()
	_clear_entities(); profile = {}; hud.close_window(); hud.game_ui.hide(); hud.login_panel.show()
	if is_instance_valid(hero): hero.queue_free()
	hero = null; hud.continue_button.visible = not forget and not Network.session.is_empty()
	Network.start()

func _clear_entities():
	target = null; attacking = false; talking_to = null
	for actor in mobs.values() + players.values(): actor.queue_free()
	mobs.clear(); players.clear()

func _unhandled_input(event):
	if profile.is_empty(): return
	if event is InputEventKey and event.pressed and not event.echo:
		match event.physical_keycode:
			KEY_I: hud.toggle("inventory")
			KEY_C: hud.toggle("character")
			KEY_M: hud.toggle("map")
			KEY_F: attack()
			KEY_E: talk_nearest()
			KEY_TAB: next_target()
			KEY_ESCAPE:
				if hud.window_kind != "": hud.close_window()
				else: set_target(null); _cancel_attack(); has_destination = false
			KEY_ENTER: hud.chat_input.grab_focus()
			KEY_V: camera_yaw = hero.rotation.y + PI; camera_pitch = 0.65; camera_distance = 24
			KEY_1, KEY_2, KEY_3, KEY_4, KEY_5: _action("hotbar", int(event.physical_keycode) - KEY_1)
			KEY_F11: DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED if DisplayServer.window_get_mode() == DisplayServer.WINDOW_MODE_FULLSCREEN else DisplayServer.WINDOW_MODE_FULLSCREEN)
	elif event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_WHEEL_UP: camera_distance = clampf(camera_distance * 0.9, 6, 65)
		if event.button_index == MOUSE_BUTTON_WHEEL_DOWN: camera_distance = clampf(camera_distance * 1.1, 6, 65)
		if event.button_index == MOUSE_BUTTON_LEFT and event.pressed: pick(event.position)
	elif event is InputEventMouseMotion and Input.is_mouse_button_pressed(MOUSE_BUTTON_RIGHT):
		camera_yaw -= event.relative.x * 0.006; camera_pitch = clampf(camera_pitch + event.relative.y * 0.005, 0.18, 1.4)
	elif event is InputEventPanGesture:
		camera_yaw -= event.delta.x * 0.035; camera_pitch = clampf(camera_pitch + event.delta.y * 0.025, 0.18, 1.4)
	elif event is InputEventMagnifyGesture: camera_distance = clampf(camera_distance / event.factor, 6, 65)
	elif event is InputEventScreenTouch:
		if event.pressed:
			touch_start[event.index] = event.position; touch_positions[event.index] = event.position
			if touch_positions.size() == 1: touch_dragged = false
			else: touch_dragged = true
		else:
			if not touch_dragged and touch_positions.size() == 1: pick(event.position)
			touch_start.erase(event.index); touch_positions.erase(event.index)
	elif event is InputEventScreenDrag:
		if not touch_positions.has(event.index): return
		if event.position.distance_to(touch_start.get(event.index, event.position)) > 10: touch_dragged = true
		if touch_positions.size() == 2:
			var other = touch_positions.keys()[0] if touch_positions.keys()[1] == event.index else touch_positions.keys()[1]
			var before = touch_positions[event.index].distance_to(touch_positions[other])
			var after = event.position.distance_to(touch_positions[other])
			if after > 1: camera_distance = clampf(camera_distance * before / after, 6, 65)
		elif touch_dragged:
			camera_yaw -= event.relative.x * 0.007; camera_pitch = clampf(camera_pitch + event.relative.y * 0.005, 0.18, 1.4)
		touch_positions[event.index] = event.position

func pick(screen: Vector2):
	if not is_instance_valid(hero) or hero.dead: return
	var closest; var distance = 40.0
	for actor in mobs.values() + players.values() + npcs:
		if not actor.visible or actor.dead or camera.is_position_behind(actor.position): continue
		var projected = camera.unproject_position(actor.position + Vector3.UP * 1.1)
		var d = projected.distance_to(screen)
		if d < distance: closest = actor; distance = d
	if closest:
		if closest.kind == "n": _talk(closest)
		elif target == closest: attack()
		else: set_target(closest)
		return
	var origin = camera.project_ray_origin(screen); var direction = camera.project_ray_normal(screen)
	var previous = origin
	for i in range(1, 401):
		var pos = origin + direction * i * 2.5
		if pos.y <= GameData.height_at(pos.x, pos.z):
			for j in 8:
				var middle = (pos + previous) * 0.5
				if middle.y <= GameData.height_at(middle.x, middle.z): pos = middle
				else: previous = middle
			destination = GameData.position_at(pos.x, pos.z); has_destination = true; talking_to = null; _cancel_attack()
			marker.position = destination + Vector3.UP * 0.1; marker.show(); return
		previous = pos

func _ring(col: Color, radius: float) -> MeshInstance3D:
	var mesh = TorusMesh.new(); mesh.inner_radius = radius; mesh.outer_radius = radius + 0.08; mesh.rings = 24; mesh.ring_segments = 6
	var node = MeshInstance3D.new(); node.mesh = mesh
	var mat = StandardMaterial3D.new(); mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; mat.albedo_color = col
	node.material_override = mat; node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF; add_child(node); return node

func _effect(pos: Vector3, col: Color, radius: float):
	var node = _ring(col, 0.5); node.position = pos + Vector3.UP * 0.35
	node.material_override.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	var tween = create_tween(); tween.tween_property(node, "scale", Vector3.ONE * radius * 2, 0.5)
	tween.parallel().tween_property(node.material_override, "albedo_color:a", 0, 0.5)
	tween.tween_callback(node.queue_free)
	var sparks = CPUParticles3D.new(); sparks.position = pos + Vector3.UP
	sparks.amount = 22; sparks.lifetime = 0.65; sparks.one_shot = true; sparks.explosiveness = 1
	sparks.direction = Vector3.UP; sparks.spread = 100; sparks.gravity = Vector3(0, -5, 0)
	sparks.initial_velocity_min = 2; sparks.initial_velocity_max = 5; sparks.scale_amount_min = 0.06; sparks.scale_amount_max = 0.16
	var mesh = SphereMesh.new(); mesh.radius = 0.5; mesh.height = 1; mesh.radial_segments = 6; mesh.rings = 3
	var mat = StandardMaterial3D.new(); mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; mat.albedo_color = col
	mat.emission_enabled = true; mat.emission = col; mat.emission_energy_multiplier = 2.5; mesh.material = mat
	sparks.mesh = mesh; add_child(sparks); sparks.emitting = true
	get_tree().create_timer(1.2).timeout.connect(sparks.queue_free)

func _projectile(from: Vector3, to: Vector3, col: Color):
	var node = MeshInstance3D.new(); var mesh = SphereMesh.new(); mesh.radius = 0.25; mesh.height = 0.5
	node.mesh = mesh; node.position = from + Vector3.UP * 1.4
	var mat = StandardMaterial3D.new(); mat.albedo_color = col; mat.emission_enabled = true; mat.emission = col; mat.emission_energy_multiplier = 5
	node.material_override = mat; add_child(node)
	var light = OmniLight3D.new(); light.light_color = col; light.light_energy = 2; light.omni_range = 4; node.add_child(light)
	var tween = create_tween(); tween.tween_property(node, "position", to + Vector3.UP, clampf(from.distance_to(to) / 50, 0.15, 0.6))
	tween.tween_callback(func(): _effect(to, col, 1.8); node.queue_free())

func _float(pos: Vector3, text: String, col: Color):
	var label = Label3D.new(); label.text = text; label.modulate = col; label.font_size = 52; label.pixel_size = 0.012
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED; label.outline_size = 10; label.no_depth_test = true
	label.position = pos + Vector3.UP * 2.5; add_child(label)
	var tween = create_tween(); tween.tween_property(label, "position:y", label.position.y + 2, 0.9)
	tween.parallel().tween_property(label, "modulate:a", 0, 0.9); tween.tween_callback(label.queue_free)

func _capture():
	await RenderingServer.frame_post_draw
	var image = get_viewport().get_texture().get_image()
	image.save_png(capture_path)
	var report = FileAccess.open(capture_path + ".json", FileAccess.WRITE)
	if report: report.store_string(JSON.stringify({"health": hud.hp_text.text, "animation": hero.last_clip, "model": hero.active_art, "fps": Engine.get_frames_per_second(), "mobs": mobs.size(), "ready": not hud.hp_text.text.is_empty() and not hero.last_clip.is_empty()}))
	print("NATIVE_SCREENSHOT_SAVED")
