extends CanvasLayer
signal action(kind: String, value)
signal login_requested(data: Dictionary)
var root: Control
var login_panel: PanelContainer
var login_name: LineEdit
var login_pass: LineEdit
var server_field: LineEdit
var class_select: OptionButton
var login_message: Label
var continue_button: Button
var game_ui: Control
var info: Label
var zone: Label
var target_info: Label
var hp_bar: ProgressBar
var mp_bar: ProgressBar
var hp_text: Label
var mp_text: Label
var xp_bar: ProgressBar
var cast_bar: ProgressBar
var chat_log: RichTextLabel
var chat_input: LineEdit
var chat_channel: OptionButton
var skill_buttons: Array = []
var window: PanelContainer
var window_body: VBoxContainer
var window_kind = ""
var profile: Dictionary = {}
var current_stats: Dictionary = {}
var enchant_scroll = ""
var map_control: Control
var dead_panel: PanelContainer
var status_label: Label
var touch = false
var joystick: Control
var quick_hint: Label
var item_details: VBoxContainer
var minimap: Control

func _ready():
	touch = OS.has_feature("mobile") or "--touch" in OS.get_cmdline_user_args()
	root = Control.new(); root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT); root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root); root.theme = _theme()
	_game_hud(); _login()

func _theme() -> Theme:
	var t = Theme.new(); t.default_font_size = 16
	var panel = _style(Color(0.045, 0.065, 0.08, 0.94), Color("6b6149"), 8)
	t.set_stylebox("panel", "PanelContainer", panel)
	for state in ["normal", "hover", "pressed", "disabled", "focus"]:
		var col = Color("25343c") if state == "normal" else Color("405252")
		if state == "disabled": col = Color("1d252d")
		t.set_stylebox(state, "Button", _style(col, Color("aa9360") if state in ["hover", "focus"] else Color("53605d"), 5))
		t.set_stylebox(state, "LineEdit", _style(Color("152229"), Color("506161"), 5))
	t.set_color("font_color", "Label", Color("e5e4d7"))
	t.set_color("font_color", "Button", Color("f0e3bf"))
	t.set_color("font_disabled_color", "Button", Color("7e8587"))
	t.set_constant("separation", "VBoxContainer", 8); t.set_constant("separation", "HBoxContainer", 8)
	t.set_stylebox("background", "ProgressBar", _style(Color("111d25"), Color("53605d"), 4))
	t.set_stylebox("fill", "ProgressBar", _style(Color("a84c4e"), Color.TRANSPARENT, 3))
	for key in ["background", "fill"]:
		var bar_style = t.get_stylebox(key, "ProgressBar")
		bar_style.content_margin_top = 1; bar_style.content_margin_bottom = 1
	return t

func _style(bg: Color, border: Color, radius: int) -> StyleBoxFlat:
	var s = StyleBoxFlat.new(); s.bg_color = bg; s.border_color = border
	s.set_border_width_all(1); s.set_corner_radius_all(radius)
	s.content_margin_left = 12; s.content_margin_right = 12; s.content_margin_top = 9; s.content_margin_bottom = 9
	return s

func _label(parent: Node, text: String, font_size = 16) -> Label:
	var n = Label.new(); n.text = text; n.add_theme_font_size_override("font_size", font_size); parent.add_child(n); return n

func _button(parent: Node, text: String, callback: Callable) -> Button:
	var b = Button.new(); b.text = text; b.custom_minimum_size.y = 38; b.pressed.connect(callback); parent.add_child(b); return b

func _row(parent: Node) -> HBoxContainer:
	var n = HBoxContainer.new(); parent.add_child(n); return n

func _panel(parent: Node, pos: Vector2, width: float) -> VBoxContainer:
	var p = PanelContainer.new(); p.position = pos; p.custom_minimum_size.x = width; parent.add_child(p)
	var v = VBoxContainer.new(); p.add_child(v); return v

func _login():
	login_panel = PanelContainer.new(); root.add_child(login_panel)
	login_panel.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	login_panel.offset_left = -225; login_panel.offset_right = 225; login_panel.offset_top = -270; login_panel.offset_bottom = 270
	var v = VBoxContainer.new(); v.add_theme_constant_override("separation", 12); login_panel.add_child(v)
	_label(v, "ХРОНИКИ ГЛУБИН", 30).horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_label(v, "Два города. Древние катакомбы. Твоя история.", 14).horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_label(v, "Имя персонажа")
	login_name = LineEdit.new(); login_name.placeholder_text = "От 3 до 16 символов"; login_name.max_length = 16; v.add_child(login_name)
	_label(v, "Пароль")
	login_pass = LineEdit.new(); login_pass.secret = true; login_pass.placeholder_text = "Не менее 4 символов"; v.add_child(login_pass)
	login_pass.text_submitted.connect(func(_s): _auth("login"))
	class_select = OptionButton.new(); class_select.add_item("Воин — меч, броня и ближний бой"); class_select.add_item("Маг — огонь, лёд и исцеление"); v.add_child(class_select)
	var row = _row(v)
	_button(row, "Войти", func(): _auth("login")).size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_button(row, "Создать героя", func(): _auth("register")).size_flags_horizontal = Control.SIZE_EXPAND_FILL
	continue_button = _button(v, "Продолжить", func(): login_requested.emit({"t": "auth", "token": Network.session.get("token", "")}))
	continue_button.visible = Network.session.get("endpoint") == Network.endpoint and Network.session.has("token")
	if continue_button.visible:
		continue_button.text = "Продолжить: " + Network.session.get("name", "")
		login_name.text = Network.session.get("name", "")
	_label(v, "Сервер", 13)
	server_field = LineEdit.new(); server_field.text = Network.endpoint; v.add_child(server_field)
	server_field.tooltip_text = "Локальная игра: ws://127.0.0.1:8790\nОбщий мир: wss://realms.neuraldeep.ru/ws"
	login_message = _label(v, "Подключение…", 14); login_message.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_label(v, "Windows · macOS · Android · iOS", 13).horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER

func _auth(kind: String):
	login_requested.emit({"t": kind, "name": login_name.text.strip_edges(), "pass": login_pass.text, "cls": "warrior" if class_select.selected == 0 else "mage"})
	login_message.text = "Вход…"

func _game_hud():
	game_ui = Control.new(); root.add_child(game_ui); game_ui.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT); game_ui.mouse_filter = Control.MOUSE_FILTER_IGNORE; game_ui.hide()
	var v = _panel(game_ui, Vector2(18, 18), 265)
	info = _label(v, "", 18)
	hp_bar = ProgressBar.new(); hp_bar.custom_minimum_size = Vector2(245, 23); v.add_child(hp_bar)
	mp_bar = ProgressBar.new(); mp_bar.custom_minimum_size = Vector2(245, 18); v.add_child(mp_bar)
	mp_bar.add_theme_stylebox_override("fill", _style(Color("477cb8"), Color.TRANSPARENT, 3))
	hp_bar.show_percentage = false; mp_bar.show_percentage = false
	hp_text = _label(hp_bar, "", 13); hp_text.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT); hp_text.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER; hp_text.mouse_filter = Control.MOUSE_FILTER_IGNORE
	mp_text = _label(mp_bar, "", 12); mp_text.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT); mp_text.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER; mp_text.mouse_filter = Control.MOUSE_FILTER_IGNORE
	xp_bar = ProgressBar.new(); xp_bar.custom_minimum_size.y = 8; xp_bar.show_percentage = false; v.add_child(xp_bar)
	xp_bar.add_theme_stylebox_override("fill", _style(Color("bfa666"), Color.TRANSPARENT, 3))
	zone = _label(v, "", 14)
	status_label = _label(v, "", 12)
	var menu = HBoxContainer.new(); game_ui.add_child(menu)
	menu.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT)
	menu.offset_left = -482; menu.offset_right = -18; menu.offset_top = 18; menu.offset_bottom = 62
	for entry in [["Сумка  I", "inventory"], ["Герой  C", "character"], ["Карта  M", "map"], ["Выход", "logout"]]:
		_button(menu, entry[0], func(): action.emit(entry[1], null))
	target_info = _label(game_ui, "", 20); target_info.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP)
	target_info.offset_left = -190; target_info.offset_right = 190; target_info.offset_top = 26; target_info.offset_bottom = 60
	target_info.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	var map_panel = PanelContainer.new(); game_ui.add_child(map_panel)
	map_panel.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT)
	map_panel.offset_left = -208; map_panel.offset_right = -18; map_panel.offset_top = 78; map_panel.offset_bottom = 232
	minimap = load("res://scripts/map.gd").new(); minimap.compact = true; map_panel.add_child(minimap)
	var chat_box = _panel(game_ui, Vector2.ZERO, 340)
	chat_box.get_parent().set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT)
	chat_box.get_parent().offset_left = 18; chat_box.get_parent().offset_right = 358
	chat_box.get_parent().offset_top = -220 if not touch else -398
	chat_box.get_parent().offset_bottom = -18 if not touch else -196
	chat_log = RichTextLabel.new(); chat_log.custom_minimum_size = Vector2(320, 125); chat_log.bbcode_enabled = false; chat_log.scroll_following = true
	chat_log.add_theme_font_size_override("normal_font_size", 13); chat_box.add_child(chat_log)
	var input_row = _row(chat_box)
	chat_channel = OptionButton.new(); chat_channel.add_item("Общий"); chat_channel.add_item("Рядом"); chat_channel.add_item("Торговля"); input_row.add_child(chat_channel)
	chat_input = LineEdit.new(); chat_input.placeholder_text = "Enter — чат"; chat_input.size_flags_horizontal = Control.SIZE_EXPAND_FILL; input_row.add_child(chat_input)
	chat_input.max_length = 180; chat_input.text_submitted.connect(func(text): action.emit("chat", text); chat_input.clear(); chat_input.release_focus())
	var bottom = VBoxContainer.new(); game_ui.add_child(bottom)
	bottom.set_anchors_and_offsets_preset(Control.PRESET_CENTER_BOTTOM)
	bottom.offset_left = -250; bottom.offset_right = 250; bottom.offset_top = -128; bottom.offset_bottom = -18
	cast_bar = ProgressBar.new(); cast_bar.custom_minimum_size.y = 16; cast_bar.visible = false; bottom.add_child(cast_bar)
	var hotbar = _row(bottom)
	for i in 5:
		var index = i
		var button = _button(hotbar, str(i + 1), func(): action.emit("hotbar", index))
		button.custom_minimum_size = Vector2(92, 64); button.expand_icon = true; button.add_theme_constant_override("icon_max_width", 32)
		skill_buttons.append(button)
	quick_hint = _label(bottom, "WASD / ЛКМ — идти · ПКМ — камера · F — атака · E — разговор", 12)
	quick_hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	var actions = VBoxContainer.new(); game_ui.add_child(actions)
	actions.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_RIGHT)
	actions.offset_left = -170; actions.offset_right = -18; actions.offset_top = -180; actions.offset_bottom = -18
	_button(actions, "Атаковать  F", func(): action.emit("attack", null)).custom_minimum_size = Vector2(150, 52)
	_button(actions, "Цель  Tab", func(): action.emit("target", null))
	_button(actions, "Говорить  E", func(): action.emit("talk", null))
	if touch:
		joystick = load("res://scripts/joystick.gd").new(); game_ui.add_child(joystick)
		joystick.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT)
		joystick.offset_left = 22; joystick.offset_right = 182; joystick.offset_top = -180; joystick.offset_bottom = -20
		joystick.changed.connect(func(value): action.emit("joystick", value))
		quick_hint.text = "Джойстик — идти · Проведи по миру — камера"
	dead_panel = PanelContainer.new(); game_ui.add_child(dead_panel); dead_panel.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	dead_panel.offset_left = -190; dead_panel.offset_right = 190; dead_panel.offset_top = -75; dead_panel.offset_bottom = 75
	dead_panel.hide()
	var death_v = VBoxContainer.new(); dead_panel.add_child(death_v)
	_label(death_v, "Вы пали в бою", 26)
	_label(death_v, "Жрец ждёт вас в родном городе.")
	_button(death_v, "Возродиться", func(): action.emit("respawn", null))

func enter(p: Dictionary):
	login_panel.hide(); game_ui.show(); update_profile(p)

func update_profile(p: Dictionary):
	profile = p; current_stats = GameData.stats(p)
	if window_kind != "" and window_kind != "map": show_window(window_kind)
	var skills = GameData.catalog.CLASSES[p.cls].skills
	for i in 5:
		var id = skills[i] if i < 3 else ("potion_hp" if i == 3 else "potion_mp")
		var it = GameData.catalog.SKILLS[id] if i < 3 else GameData.catalog.ITEMS[id]
		skill_buttons[i].icon = GameData.icon(id); skill_buttons[i].tooltip_text = it.name
		skill_buttons[i].text = str(i + 1); skill_buttons[i].disabled = i < 3 and p.lvl < it.lvl

func update_values(p: Dictionary, s: Dictionary, pos: Vector3, target, cooldowns: Dictionary, cast_time: float):
	if p.is_empty(): return
	info.text = "%s · %s ур." % [p.name, int(p.lvl)]
	hp_bar.max_value = s.maxHp; hp_bar.value = p.hp; hp_bar.tooltip_text = "Здоровье: %s / %s" % [int(p.hp), int(s.maxHp)]
	hp_text.text = "HP  %s / %s" % [int(p.hp), int(s.maxHp)]
	mp_bar.max_value = s.maxMp; mp_bar.value = p.mp; mp_bar.tooltip_text = "Мана: %s / %s" % [int(p.mp), int(s.maxMp)]
	mp_text.text = "MP  %s / %s" % [int(p.mp), int(s.maxMp)]
	xp_bar.max_value = GameData.xp_next(int(p.lvl)); xp_bar.value = p.xp
	var z = GameData.zone_at(pos)
	zone.text = z.name + " · " + str(z.lv)
	status_label.text = ("В сети" if Network.authed else "Переподключение…") + "  ·  %s монет" % int(p.coins)
	if p.get("karma", 0) > 0: status_label.text += " · Карма %s" % int(p.karma)
	target_info.text = "%s   %s%%" % [target.display_name, int(target.hp)] if is_instance_valid(target) else ""
	dead_panel.visible = p.get("dead", false)
	cast_bar.visible = cast_time > 0; cast_bar.max_value = 3; cast_bar.value = cast_time
	var skills = GameData.catalog.CLASSES[p.cls].skills
	for i in 3:
		var remaining = maxf(0, (cooldowns.get(skills[i], 0) - Time.get_ticks_msec()) / 1000.0)
		skill_buttons[i].text = "%.1f" % remaining if remaining > 0 else str(i + 1)
	if is_instance_valid(map_control): map_control.player_position = pos; map_control.queue_redraw()
	minimap.player_position = pos; minimap.queue_redraw()

func log_line(text: String):
	chat_log.append_text(text + "\n")
	if chat_log.get_line_count() > 150: chat_log.remove_paragraph(0)

func close_window():
	if is_instance_valid(window): window.queue_free()
	window = null; window_kind = ""; map_control = null

func toggle(kind: String):
	if window_kind == kind: close_window()
	else: show_window(kind)

func show_window(kind: String):
	close_window(); window_kind = kind
	window = PanelContainer.new(); game_ui.add_child(window)
	window.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	window.offset_left = -375; window.offset_right = 375; window.offset_top = -260; window.offset_bottom = 260
	window_body = VBoxContainer.new(); window.add_child(window_body)
	var row = _row(window_body)
	var titles = {"inventory": "Снаряжение и сумка", "character": "Персонаж", "map": "Карта мира", "shop": "Торговец", "teleport": "Хранитель врат", "priest": "Жрец"}
	_label(row, titles.get(kind, kind), 24).size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_button(row, "Закрыть  Esc", close_window)
	if kind == "inventory":
		_inventory_grid(window_body)
		return
	if kind == "map":
		map_control = load("res://scripts/map.gd").new(); window_body.add_child(map_control); map_control.size_flags_vertical = Control.SIZE_EXPAND_FILL
		_label(window_body, "Города — золотые точки · Вы — бирюзовая точка · Телепорты доступны у хранителя", 13)
		return
	var scroll = ScrollContainer.new(); scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL; scroll.custom_minimum_size.y = 390; window_body.add_child(scroll)
	var list = VBoxContainer.new(); list.size_flags_horizontal = Control.SIZE_EXPAND_FILL; scroll.add_child(list)
	match kind:
		"inventory": _inventory(list)
		"character": _character(list)
		"shop":
			_label(list, "Ваши монеты: %s · Покупка по одной вещи" % int(profile.coins))
			for id in GameData.catalog.SHOP:
				var it = GameData.catalog.ITEMS[id]; var r = _item_row(list, id, "%s — %s мон." % [it.name, int(it.price)])
				_button(r, "Купить", func(): action.emit("buy", id))
		"teleport":
			for t in GameData.world.teleports:
				_button(list, "%s · %s мон." % [t.name, int(t.cost)], func(): action.emit("teleport", t.id))
		"priest":
			_label(list, "Карма: %s" % int(profile.get("karma", 0)))
			_label(list, "Очищение стоит %s монет." % ceili(profile.get("karma", 0) * 5))
			_button(list, "Очистить карму", func(): action.emit("wash", null))

func _item_row(parent, id: String, text: String) -> HBoxContainer:
	var r = _row(parent); var tex = TextureRect.new(); tex.texture = GameData.icon(id)
	tex.custom_minimum_size = Vector2(36, 36); tex.expand_mode = TextureRect.EXPAND_IGNORE_SIZE; tex.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED; r.add_child(tex)
	var label = _label(r, text, 15); label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	label.tooltip_text = _item_description(id)
	return r

func _item_description(id: String) -> String:
	var it = GameData.catalog.ITEMS[id]; var s = it.name
	for key in ["patk", "matk", "pdef", "mdef", "hp", "mp", "lvl", "w"]:
		if it.has(key): s += "\n%s: %s" % [{"patk": "Физ. атака", "matk": "Маг. атака", "pdef": "Физ. защита", "mdef": "Маг. защита", "hp": "Здоровье", "mp": "Мана", "lvl": "Уровень", "w": "Вес"}[key], it[key]]
	return s

func _inventory(list):
	_label(list, "Монеты: %s  ·  Вес: %.1f / %s" % [int(profile.coins), current_stats.load, int(current_stats.cap)])
	if enchant_scroll != "":
		_label(list, "Выберите вещь для усиления. После +3 неудача уничтожает предмет.", 14)
		_button(list, "Отменить усиление", func(): enchant_scroll = ""; show_window("inventory"))
	_label(list, "Надето", 20)
	for sl in GameData.catalog.SLOTS:
		var id = profile.equip.get(sl.id)
		if id == null:
			_label(list, sl.name + ": —", 14); continue
		var ench = int(profile.get("enc", {}).get(sl.id, 0))
		var row = _item_row(list, id, sl.name + ": " + GameData.catalog.ITEMS[id].name + (" +%s" % ench if ench > 0 else ""))
		if enchant_scroll != "": _button(row, "Усилить", func(): action.emit("enchant", {"scroll": enchant_scroll, "ref": {"slot": sl.id}}); enchant_scroll = "")
		else: _button(row, "Снять", func(): action.emit("unequip", sl.id))
	_label(list, "В сумке", 20)
	for i in profile.inv.size():
		var index = i; var e = profile.inv[i]; var it = GameData.catalog.ITEMS[e.id]
		var row = _item_row(list, e.id, it.name + (" ×%s" % int(e.n) if e.n > 1 else "") + (" +%s" % int(e.e) if e.get("e", 0) > 0 else ""))
		if enchant_scroll != "" and it.has("slot"):
			_button(row, "Усилить", func(): action.emit("enchant", {"scroll": enchant_scroll, "ref": {"bag": index}}); enchant_scroll = "")
		elif it.has("slot"): _button(row, "Надеть", func(): action.emit("equip", index))
		elif it.get("use") == "ench": _button(row, "Усиление", func(): enchant_scroll = e.id; show_window("inventory"))
		elif it.has("use"): _button(row, "Использовать", func(): action.emit("use", e.id))
		_button(row, "Продать 1", func(): action.emit("sell", index)).tooltip_text = "Рядом с торговцем"

func _character(list):
	_label(list, "%s · %s · Уровень %s" % [profile.name, GameData.catalog.CLASSES[profile.cls].name, int(profile.lvl)], 22)
	_button(list, "Включить / выключить PvP", func(): action.emit("pvp", null))
	for pair in [["maxHp", "Здоровье"], ["maxMp", "Мана"], ["patk", "Физическая атака"], ["matk", "Магическая атака"], ["pdef", "Физическая защита"], ["mdef", "Магическая защита"], ["speed", "Скорость"], ["acc", "Точность"], ["eva", "Уклонение"]]:
		_label(list, "%s: %.1f" % [pair[1], current_stats[pair[0]]])
	_label(list, "Опыт: %s / %s · Убийств: %s · PvP: %s" % [int(profile.xp), GameData.xp_next(int(profile.lvl)), int(profile.get("kills", 0)), int(profile.get("pvp", 0))])
	for st in current_stats.sets: _label(list, "%s: %s / %s" % [st.name, int(st.have), st.parts.size()])

func _inventory_grid(parent):
	_label(parent, "Монеты: %s  ·  Вес: %.1f / %s  ·  Перетащи вещь в слот или нажми дважды" % [int(profile.coins), current_stats.load, int(current_stats.cap)], 14)
	if enchant_scroll != "":
		_label(parent, "Выберите снаряжение для усиления. После +3 неудача уничтожает вещь.", 14)
		_button(parent, "Отменить усиление", func(): enchant_scroll = ""; show_window("inventory"))
	var columns = _row(parent); columns.size_flags_vertical = Control.SIZE_EXPAND_FILL
	var worn = VBoxContainer.new(); columns.add_child(worn)
	_label(worn, "Снаряжение", 18)
	var equip_grid = GridContainer.new(); equip_grid.columns = 3; worn.add_child(equip_grid)
	for slot in GameData.catalog.SLOTS:
		var id = profile.equip.get(slot.id)
		var payload = {"source": "inventory", "slot": slot.id, "id": id, "e": profile.get("enc", {}).get(slot.id, 0)} if id != null else {}
		var b = _slot(equip_grid, payload, slot.name)
		b.slot_type = slot.type
		b.item_dropped.connect(func(item): action.emit("equip_slot", {"idx": item.idx, "slot": slot.id}))
	var bag = VBoxContainer.new(); bag.size_flags_horizontal = Control.SIZE_EXPAND_FILL; columns.add_child(bag)
	_label(bag, "Сумка · %s предметов" % profile.inv.size(), 18)
	var scroll = ScrollContainer.new(); scroll.custom_minimum_size = Vector2(420, 290); scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL; bag.add_child(scroll)
	var grid = GridContainer.new(); grid.columns = 5; scroll.add_child(grid)
	for i in maxi(20, profile.inv.size()):
		var payload = {}
		if i < profile.inv.size():
			payload = profile.inv[i].duplicate(); payload["idx"] = i; payload["source"] = "inventory"
		var b = _slot(grid, payload, "")
		b.accept_equipped = true
		b.item_dropped.connect(func(item): action.emit("unequip", item.slot))
	item_details = VBoxContainer.new(); item_details.custom_minimum_size.y = 110; parent.add_child(item_details)
	_label(item_details, "Выберите предмет — здесь появятся характеристики и действия.", 14)

func _slot(parent, payload: Dictionary, empty_name: String) -> Button:
	var b = load("res://scripts/item_slot.gd").new(); b.payload = payload
	b.custom_minimum_size = Vector2(74, 62); b.expand_icon = true; b.add_theme_constant_override("icon_max_width", 38)
	parent.add_child(b)
	if payload.is_empty(): b.text = empty_name; b.add_theme_font_size_override("font_size", 11)
	else:
		b.icon = GameData.icon(payload.id); b.tooltip_text = _item_description(payload.id)
		b.text = "×%s" % int(payload.n) if payload.get("n", 1) > 1 else ("+%s" % int(payload.e) if payload.get("e", 0) > 0 else "")
		b.pressed.connect(func(): _select_item(payload))
		b.activated.connect(func(): _activate_item(payload))
	return b

func _activate_item(item: Dictionary):
	if enchant_scroll != "":
		var ref = {"slot": item.slot} if item.has("slot") else {"bag": item.idx}
		action.emit("enchant", {"scroll": enchant_scroll, "ref": ref}); enchant_scroll = ""; return
	if item.has("slot"): action.emit("unequip", item.slot); return
	var it = GameData.catalog.ITEMS[item.id]
	if it.has("slot"): action.emit("equip", item.idx)
	elif it.get("use") == "ench": enchant_scroll = item.id; show_window("inventory")
	elif it.has("use"): action.emit("use", item.id)

func _select_item(item: Dictionary):
	for child in item_details.get_children(): item_details.remove_child(child); child.queue_free()
	var it = GameData.catalog.ITEMS[item.id]
	_label(item_details, it.name + (" +%s" % int(item.e) if item.get("e", 0) > 0 else ""), 18)
	var text = _item_description(item.id).split("\n"); text.remove_at(0)
	_label(item_details, " · ".join(text), 13)
	var actions = _row(item_details)
	var title = "Усилить" if enchant_scroll != "" else ("Снять" if item.has("slot") else ("Надеть" if it.has("slot") else ("Усиление…" if it.get("use") == "ench" else "Использовать")))
	if it.has("slot") or it.has("use"): _button(actions, title, func(): _activate_item(item))
	if item.has("idx"): _button(actions, "Продать 1 торговцу", func(): action.emit("sell", item.idx))
