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
var artifacts = ""

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
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--artifacts="): artifacts = arg.trim_prefix("--artifacts=")
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
	await _screenshot("login.png")
	game.hud.login_switch.pressed.emit()
	check(is_instance_valid(game.hud.creation_preview) and game.hud.class_select.visible, "character creation previews the real Godot model")
	await _screenshot("create-character.png")
	game.hud.login_name.text = "NativeTest"; game.hud.login_pass.text = "isolated-test"
	game.hud.login_submit.pressed.emit()
	if not await wait_for(func(): return not game.profile.is_empty()):
		check(false, "registration returned profile"); _finish(); return
	check(game.profile.cls == "warrior" and game.profile.lvl == 1, "server creates the player")
	check(game.hero.animator != null and game.hero.animator.has_animation("walk"), "native animated hero imported")
	check(await wait_for(func(): return not game.mobs.is_empty()), "nearby mobs arrive as snapshots")
	await create_timer(0.2).timeout
	for kind in ["inventory", "character", "map", "shop", "teleport", "priest", "menu", "skills", "settings", "controls"]:
		game.hud.show_window(kind)
		await process_frame
		check(is_instance_valid(game.hud.window) and game.get_viewport().get_visible_rect().encloses(game.hud.window.get_global_rect()), kind + " window fits the viewport")
		if DisplayServer.get_name() != "headless": await _screenshot(kind + ".png")
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
	game.hud.show_window("shop")
	_click("buy", "sword_long")
	check(await wait_for(func(): return _bag("sword_long") >= 0), "shop purchase is server-authoritative")
	game.hud.show_window("inventory")
	_select_bag("sword_long"); _click("item_action", "sword_long")
	check(await wait_for(func(): return game.profile.equip.weapon == "sword_long"), "inventory equip updates character")
	await _dev({"item": "scroll_ench_w"})
	_select_bag("scroll_ench_w"); _click("item_action", "scroll_ench_w")
	for button in game.hud.window.find_children("*", "Button", true, false):
		if button.get("payload") is Dictionary and button.payload.get("slot") == "weapon": button.pressed.emit(); break
	_click("item_action", "sword_long")
	check(await wait_for(func(): return game.profile.enc.get("weapon", 0) == 1), "enchanting returns server result")
	await _dev({"item": "potion_mp", "n": 3})
	var quantity = int(game.profile.inv[_bag("potion_mp")].n)
	var money_before = game.profile.coins
	game.hud.show_window("shop"); _click("shop_tab", "sell"); _click("sell_stack", "potion_mp")
	check(await wait_for(func(): return _bag("potion_mp") < 0 and game.profile.coins == money_before + quantity * data.sell_price("potion_mp")), "sell tab sells the correct stack at the server price")
	game.hud.skill_buttons[1].pressed.emit()
	check(await wait_for(func(): return not game.hud.buff_text.text.is_empty() and game.stats.patk > data.stats(game.profile).patk), "buff and effective stats come from the server skill event")
	await _dev({"x": -418, "z": 410})
	game.hud.show_window("teleport"); _click("teleport", "meadow")
	check(await wait_for(func(): return absf(game.hero.position.x + 260) < 2), "teleport places the native hero in the correct world coordinates")
	await wait_for(func(): return game.mobs.values().any(func(m): return m.visible and not m.dead))
	check(await wait_for(func(): return not game.hud.minimap.mob_markers.is_empty()), "minimap displays live server mobs")
	await create_timer(0.3).timeout
	await _screenshot("minimap-mobs.png")
	var mob = null
	var combat_position = Vector3.ZERO
	for m in game.mobs.values():
		if not m.visible or m.dead or m.definition.lvl > 3: continue
		if data.world.towns.any(func(t): return Vector2(m.position.x - t.x, m.position.z - t.z).length() < t.r + 30): continue
		for i in 8:
			var angle = TAU * i / 8
			var candidate = data.position_at(m.position.x + cos(angle) * 1.2, m.position.z + sin(angle) * 1.2)
			if data.move(candidate, Vector3.ZERO, 0.01).distance_to(candidate) < 0.1:
				mob = m; combat_position = candidate; break
		if mob: break
	if mob:
		await _dev({"x": combat_position.x, "z": combat_position.z, "hp": 500, "lvl": 18})
		# Use the same screen-space picking as the mouse/touch client.
		await create_timer(0.25).timeout
		game.pick(game.camera.unproject_position(mob.position + Vector3.UP * 1.1))
		check(await wait_for(func(): return game.target == mob and game.target_arrow.visible and game.hud.target_panel.visible and mob.selected), "clicking a mob displays its name, HP, arrow and selection ring")
		await _screenshot("target-selected.png")
		game.attack(); game.use_skill("power_strike")
		var killed = await wait_for(func(): return game.profile.get("kills", 0) > 0, 12)
		if not killed:
			print("Combat diagnostics: player=", game.hero.position, " mob=", mob.position, " hp=", mob.hp, " visible=", mob.visible, " attacking=", game.attacking)
			for message in received:
				if message.t == "ev":
					for event in message.e:
						if event.k == "msg": print("Server: ", event.text)
		check(killed, "native target + attack + skill kill a server mob and award progress")
	else: check(false, "an unobstructed mob outside peace zones is available for combat test")
	game._cancel_attack()
	await create_timer(0.25).timeout
	check(game.hud.minimap.mob_markers.size() == game.mobs.values().filter(func(m): return m.visible and not m.dead and Time.get_ticks_msec() - m.seen < 1500).size(), "minimap removes dead and stale mobs")
	# A second ordinary WS client proves the native client interoperates with the existing protocol.
	peer = WebSocketPeer.new(); peer.connect_to_url(net.endpoint)
	check(await wait_for(func(): return peer.get_ready_state() == WebSocketPeer.STATE_OPEN), "second player connects")
	peer.send_text(JSON.stringify({"t": "register", "name": "NativePeer", "pass": "isolated-test", "cls": "mage"}))
	check(await wait_for(func(): return peer_inbox.any(func(m): return m.t == "authok")), "second player authenticates")
	for m in peer_inbox:
		if m.t == "authok": peer_id = int(m.id)
	await _dev({"x": -448, "z": 418})
	check(await wait_for(func(): return game.players.has(peer_id) and game.players[peer_id].visible), "native multiplayer renders a remote player")
	game.hud.chat.input.text = "native public chat"; game.hud.chat.submit()
	check(await wait_for(func(): return peer_inbox.any(func(m): return m.t == "chat" and m.text == "native public chat")), "public chat interoperates")
	game.hud.chat.select_channel("pm"); game.hud.chat.recipient.text = "NativePeer"
	game.hud.chat.input.text = "native private chat"; game.hud.chat.submit()
	check(await wait_for(func(): return peer_inbox.any(func(m): return m.t == "pm" and m.text == "native private chat")), "private chat interoperates")
	check(await wait_for(func(): return game.hud.chat.log_view.get_parsed_text().contains("native private chat")), "private chat tab renders the server reply")
	check(not game.hud.chat.log_view.get_parsed_text().contains("native public chat"), "private chat tab filters public messages")
	game.hud.chat.select_channel("all")
	check(game.hud.chat.log_view.get_parsed_text().contains("native public chat"), "public history is retained across tabs")
	game.hud.chat.set_preference("sys", false); game.hud.log_line("hidden system notice")
	check(not game.hud.chat.log_view.get_parsed_text().contains("hidden system notice"), "chat settings filter system messages")
	game.hud.chat.set_preference("sys", true)
	check(await wait_for(func(): return game.hud.minimap.player_markers.size() > 0 and net.online_count == 2), "server online count and remote players appear in the HUD and minimap")
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
	check(game.hud.enchant_scroll.is_empty() and game.hud.chat.recipient.text.is_empty(), "changing account clears old inventory and chat selection")
	game.hud.close_window()
	await _dev({"item": "sword_long", "lvl": 10})
	game._action("equip", _bag("sword_long"))
	check(await wait_for(func(): return game.hero.weapon_node.get_meta("weapon_kind") == "warrior"), "mage equipping a sword changes the actual weapon model")
	check(game.hero.weapon_node.to_global(game.hero.weapon_node.get_meta("handle_center")).distance_to(game.hero.weapon_node.get_parent().global_position) < 0.001, "weapon handle stays exactly on the palm grip")
	# Real screenshot from the rendering backend, when running with a display.
	if DisplayServer.get_name() != "headless":
		await RenderingServer.frame_post_draw
		await _screenshot("game.png")
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

func _click(key: String, value):
	for button in game.hud.window.find_children("*", "Button", true, false):
		if button.has_meta(key) and button.get_meta(key) == value:
			check(not button.disabled, "UI action is enabled: " + key)
			if not button.disabled: button.pressed.emit()
			return
	check(false, "UI action exists: " + key)

func _select_bag(id: String):
	for button in game.hud.window.find_children("*", "Button", true, false):
		if button.get("payload") is Dictionary and button.payload.get("id") == id and button.payload.has("idx"):
			button.pressed.emit(); return
	check(false, "inventory item exists: " + id)

func _screenshot(name: String):
	if DisplayServer.get_name() == "headless": return
	await process_frame
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(artifacts.path_join(name) if not artifacts.is_empty() else "user://native-" + name)
