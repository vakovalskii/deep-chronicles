extends SceneTree
var game
var net
var data
var failures = 0
var checks = 0
var received: Array = []
var peer: WebSocketPeer
var peer_inbox: Array = []
var peer_id = 0

func _initialize():
	_run.call_deferred()

func check(condition: bool, description: String):
	checks += 1
	if condition: print("PASS: " + description)
	else: failures += 1; push_error("FAIL: " + description)

func wait_for(condition: Callable, seconds = 8.0) -> bool:
	var deadline = Time.get_ticks_msec() + seconds * 1000
	while Time.get_ticks_msec() < deadline:
		_poll_peer()
		if condition.call(): return true
		await create_timer(0.03).timeout
	return false

func _poll_peer():
	if not peer: return
	peer.poll()
	while peer.get_available_packet_count() > 0:
		var m = JSON.parse_string(peer.get_packet().get_string_from_utf8())
		if m is Dictionary: peer_inbox.append(m)

func _run():
	data = root.get_node("GameData"); net = root.get_node("Network")
	if not "--test-mode" in OS.get_cmdline_user_args() or not net.endpoint.begins_with("ws://127.0.0.1:"):
		push_error("Tests require an isolated local server and --test-mode"); quit(1); return
	var fixtures = JSON.parse_string(FileAccess.get_file_as_string("res://generated/stats-fixtures.json"))
	var stats_match = true
	for fixture in fixtures:
		var s = data.stats(fixture.p)
		for key in fixture.stats:
			if fixture.stats[key] is float or fixture.stats[key] is int:
				if not is_equal_approx(float(s[key]), float(fixture.stats[key])):
					stats_match = false; print("Mismatch ", key, ": ", s[key], " != ", fixture.stats[key])
	check(stats_match, "48 native stat profiles match the JS game rules")
	check(data.world.spawns.size() == 155 and data.world.obstacles.size() == 3251 and data.world.modelPlacements.size() >= 2000, "world content exported without missing spawns")
	check(absf(data.height_at(-430, 400) - 4) < 0.001, "town ground matches server")
	var position = data.move(Vector3(-437, 4, 400), Vector3.RIGHT, 5)
	check(position.distance_to(Vector3(-430, 4, 400)) >= 5.0, "movement cannot cross the fountain")
	var art = load("res://scripts/art_assets.gd")
	var assets_ok = true
	for id in data.catalog.MOBS.keys() + ["warrior", "mage", "merchant", "gatekeeper", "priest"]:
		var actor = art.actor(id)
		if not actor: assets_ok = false; continue
		var skeleton = actor.find_child("Skeleton3D", true, false)
		var player = actor.find_child("AnimationPlayer", true, false)
		if not skeleton or not player or not player.has_animation("walk") or not player.has_animation("death"):
			assets_ok = false; print("Incomplete rig: ", id)
		actor.free()
	for row in data.world.modelPlacements:
		if not ResourceLoader.exists("res://assets/props/%s.glb" % row[0]): assets_ok = false
	check(assets_ok, "all hero, NPC, mob rigs and placed scenery assets exist")
	game = load("res://scenes/main.tscn").instantiate(); root.add_child(game); current_scene = game
	net.message.connect(func(m): received.append(m))
	check(await wait_for(func(): return net.online), "Godot WebSocket connects to Node server")
	game._login({"t": "register", "name": "NativeTest", "pass": "isolated-test", "cls": "warrior"})
	if not await wait_for(func(): return not game.profile.is_empty()):
		check(false, "registration returned profile"); _finish(); return
	check(game.profile.cls == "warrior" and game.profile.lvl == 1, "server creates the player")
	check(game.hero.animator != null and game.hero.animator.has_animation("walk"), "native animated hero imported")
	check(await wait_for(func(): return not game.mobs.is_empty()), "nearby mobs arrive as snapshots")
	await create_timer(0.2).timeout
	for kind in ["inventory", "character", "map", "shop", "teleport", "priest"]:
		game.hud.show_window(kind)
		await process_frame
		check(is_instance_valid(game.hud.window) and game.get_viewport().get_visible_rect().encloses(game.hud.window.get_global_rect()), kind + " window fits the viewport")
		if kind == "inventory" and DisplayServer.get_name() != "headless":
			await RenderingServer.frame_post_draw
			root.get_texture().get_image().save_png("user://native-inventory.png")
	game.hud.close_window()
	check(game.hud.skill_buttons[0].get_global_rect().intersects(game.get_viewport().get_visible_rect()), "hotbar is inside viewport")
	var start = game.hero.position
	game.joystick = Vector2.RIGHT
	await create_timer(0.35).timeout
	game.joystick = Vector2.ZERO
	check(game.hero.position.distance_to(start) > 1, "native movement updates position")
	var fixes = received.filter(func(m): return m.t == "fix").size()
	check(fixes == 0, "server accepts native movement speed")
	await _dev({"x": -442, "z": 410, "coins": 10000, "lvl": 8})
	game._action("buy", "sword_long")
	check(await wait_for(func(): return _bag("sword_long") >= 0), "shop purchase is server-authoritative")
	game._action("equip", _bag("sword_long"))
	check(await wait_for(func(): return game.profile.equip.weapon == "sword_long"), "inventory equip updates character")
	await _dev({"item": "scroll_ench_w"})
	game._action("enchant", {"scroll": "scroll_ench_w", "ref": {"slot": "weapon"}})
	check(await wait_for(func(): return game.profile.enc.get("weapon", 0) == 1), "enchanting returns server result")
	await _dev({"x": -418, "z": 410})
	game._action("teleport", "meadow")
	check(await wait_for(func(): return absf(game.hero.position.x + 260) < 2), "teleport places the native hero in the correct world coordinates")
	await wait_for(func(): return game.mobs.values().any(func(m): return m.visible and not m.dead))
	var mob = null
	for m in game.mobs.values():
		if m.visible and not m.dead and m.definition.lvl <= 3: mob = m; break
	if mob:
		await _dev({"x": mob.position.x + 3, "z": mob.position.z, "hp": 500, "lvl": 18})
		game.set_target(mob); game.attack()
		game.use_skill("power_strike")
		check(await wait_for(func(): return game.profile.get("kills", 0) > 0, 12), "native target + attack + skill kill a server mob and award progress")
	else: check(false, "a low-level mob is available for combat test")
	game._cancel_attack()
	# A second ordinary WS client proves the native client interoperates with the existing protocol.
	peer = WebSocketPeer.new(); peer.connect_to_url(net.endpoint)
	check(await wait_for(func(): return peer.get_ready_state() == WebSocketPeer.STATE_OPEN), "second player connects")
	peer.send_text(JSON.stringify({"t": "register", "name": "NativePeer", "pass": "isolated-test", "cls": "mage"}))
	check(await wait_for(func(): return peer_inbox.any(func(m): return m.t == "authok")), "second player authenticates")
	for m in peer_inbox:
		if m.t == "authok": peer_id = int(m.id)
	await _dev({"x": -448, "z": 418})
	check(await wait_for(func(): return game.players.has(peer_id) and game.players[peer_id].visible), "native multiplayer renders a remote player")
	game._chat("native public chat")
	check(await wait_for(func(): return peer_inbox.any(func(m): return m.t == "chat" and m.text == "native public chat")), "public chat interoperates")
	game._chat("/w NativePeer native private chat")
	check(await wait_for(func(): return peer_inbox.any(func(m): return m.t == "pm" and m.text == "native private chat")), "private chat interoperates")
	var saved_level = game.profile.lvl
	net.start()
	check(await wait_for(func(): return net.authed and game.profile.lvl == saved_level and game.profile.equip.weapon == "sword_long"), "token reconnect retains progression and equipment")
	# Change class with a separate test account and test imported mage animation and casting.
	game._return_to_login(true)
	await wait_for(func(): return net.online)
	game._login({"t": "register", "name": "NativeMage", "pass": "isolated-test", "cls": "mage"})
	check(await wait_for(func(): return game.profile.get("cls") == "mage"), "mage character starts")
	check(game.hero.animator != null and game.hero.animator.has_animation("cast"), "mage has native cast animation")
	await _dev({"lvl": 10, "hp": 50})
	game.use_skill("heal")
	check(await wait_for(func(): return game.cast_time > 0), "server-driven casting starts")
	check(await wait_for(func(): return game.profile.hp > 60), "healing updates server health")
	game.hud.show_window("inventory")
	await process_frame
	game.hud.close_window()
	# Real screenshot from the rendering backend, when running with a display.
	if DisplayServer.get_name() != "headless":
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png("user://native-smoke.png")
	_finish()

func _bag(id: String) -> int:
	for i in game.profile.inv.size():
		if game.profile.inv[i].id == id: return i
	return -1

func _dev(fields: Dictionary):
	var command = fields.duplicate(); command.t = "dev"; net.send(command)
	await create_timer(0.3).timeout

func _finish():
	if peer: peer.close()
	if net.socket: net.socket.close()
	print("NATIVE_TEST_RESULT checks=%s failures=%s" % [checks, failures])
	quit(0 if failures == 0 else 1)
