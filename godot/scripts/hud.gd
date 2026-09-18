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
var chat: VBoxContainer
var xp_text: Label
var buff_text: Label
var target_bar: ProgressBar
var cast_text: Label
var cast_duration = 1.0
var cast_name = ""
var active_buffs: Array = []
var selected_item: Dictionary = {}
var bag_filter = 0
var bag_query = ""
var bag_sort = 0
var bag_search: LineEdit
var bag_grid: GridContainer
var wallet_label: Label
var shop_tab = "buy"
var window_scroll: ScrollContainer
var pvp_enabled = false
var target_panel: PanelContainer
var target_hint: Label
var status_panel: PanelContainer
var buffs_row: HBoxContainer
var hotbar_labels: Array = []
var login_decoration: Control
var registration_mode = false
var login_submit: Button
var login_switch: Button
var creation_preview: Control
var window_positions: Dictionary = {}
const STAT_NAMES = {"patk": "Физ. атака", "matk": "Маг. атака", "pdef": "Физ. защита", "mdef": "Маг. защита", "hp": "Здоровье", "mp": "Мана", "maxHp": "Макс. здоровье", "maxMp": "Макс. мана", "crit": "Критический удар", "aspd": "Атак в секунду", "cast": "Скорость заклинаний", "speed": "Скорость бега", "range": "Дальность атаки", "acc": "Точность", "eva": "Уклонение", "lvl": "Уровень", "w": "Вес"}

func _ready():
	touch = OS.has_feature("mobile") or "--touch" in OS.get_cmdline_user_args()
	root = Control.new(); root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT); root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root); root.theme = _theme()
	_game_hud(); _login()

func _theme() -> Theme:
	var t = Theme.new(); t.default_font_size = 14 if touch else 12
	t.set_stylebox("panel", "PanelContainer", _style(Color(0.055, 0.055, 0.05, 0.88), Color("82765a"), 0))
	for state in ["normal", "hover", "pressed", "disabled", "focus"]:
		var col = Color("171c24") if state == "normal" else Color("313747")
		if state == "disabled": col = Color("171817")
		t.set_stylebox(state, "Button", _style(col, Color("bdab7d") if state in ["hover", "focus"] else Color("706b5e"), 0))
		t.set_stylebox(state, "LineEdit", _style(Color("090c10"), Color("58544a"), 0))
	t.set_color("font_color", "Label", Color("d8d7ce"))
	t.set_color("font_color", "Button", Color("e8e1cf"))
	t.set_color("font_disabled_color", "Button", Color("73736d"))
	t.set_constant("separation", "VBoxContainer", 4); t.set_constant("separation", "HBoxContainer", 4)
	t.set_stylebox("background", "ProgressBar", _style(Color("12151c"), Color("72716b"), 0))
	t.set_stylebox("fill", "ProgressBar", _style(Color("a32233"), Color.TRANSPARENT, 0))
	for key in ["background", "fill"]:
		var bar_style = t.get_stylebox(key, "ProgressBar")
		bar_style.content_margin_top = 0; bar_style.content_margin_bottom = 0
	return t

func _style(bg: Color, border: Color, _radius: int) -> StyleBoxFlat:
	var s = StyleBoxFlat.new(); s.bg_color = bg; s.border_color = border
	s.set_border_width_all(1); s.set_corner_radius_all(0)
	s.content_margin_left = 6; s.content_margin_right = 6; s.content_margin_top = 3; s.content_margin_bottom = 3
	return s

func _label(parent: Node, text: String, font_size = 13) -> Label:
	var n = Label.new(); n.text = text; n.add_theme_font_size_override("font_size", font_size); parent.add_child(n); return n

func _button(parent: Node, text: String, callback: Callable) -> Button:
	var b = Button.new(); b.text = text; b.custom_minimum_size.y = 36 if touch else 25; b.pressed.connect(callback); parent.add_child(b); return b

func _row(parent: Node) -> HBoxContainer:
	var n = HBoxContainer.new(); parent.add_child(n); return n

func _panel(parent: Node, pos: Vector2, width: float) -> VBoxContainer:
	var p = PanelContainer.new(); p.position = pos; p.custom_minimum_size.x = width; parent.add_child(p)
	var v = VBoxContainer.new(); p.add_child(v); return v

func _login():
	login_decoration = Control.new(); root.add_child(login_decoration); login_decoration.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT); login_decoration.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var title = _label(login_decoration, "ХРОНИКИ ГЛУБИН", 44)
	title.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP); title.offset_left = -380; title.offset_right = 380; title.offset_top = 100; title.offset_bottom = 164
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER; title.modulate = Color("eee1bc"); title.add_theme_color_override("font_shadow_color", Color("171c20")); title.add_theme_constant_override("shadow_offset_x", 2); title.add_theme_constant_override("shadow_offset_y", 3)
	var subtitle = _label(login_decoration, "ДВА ГОРОДА  ·  ДРЕВНИЕ КАТАКОМБЫ  ·  ОБЩИЙ МИР", 12)
	subtitle.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP); subtitle.offset_left = -350; subtitle.offset_right = 350; subtitle.offset_top = 166; subtitle.offset_bottom = 190; subtitle.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	login_panel = load("res://scripts/window_frame.gd").new(); root.add_child(login_panel)
	login_panel.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	login_panel.offset_left = -185; login_panel.offset_right = 185; login_panel.offset_top = -55; login_panel.offset_bottom = 130
	var v = VBoxContainer.new(); v.add_theme_constant_override("separation", 8); login_panel.add_child(v)
	_label(v, "Вход в мир", 15).horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	var row = _row(v); _label(row, "Имя").custom_minimum_size.x = 58
	login_name = LineEdit.new(); login_name.placeholder_text = "Имя персонажа"; login_name.max_length = 16; login_name.size_flags_horizontal = Control.SIZE_EXPAND_FILL; row.add_child(login_name)
	row = _row(v); _label(row, "Пароль").custom_minimum_size.x = 58
	login_pass = LineEdit.new(); login_pass.secret = true; login_pass.placeholder_text = "Пароль аккаунта"; login_pass.size_flags_horizontal = Control.SIZE_EXPAND_FILL; row.add_child(login_pass)
	login_pass.text_submitted.connect(func(_s): _auth("register" if registration_mode else "login"))
	class_select = OptionButton.new(); class_select.add_item("Воин — меч и тяжёлая броня"); class_select.add_item("Маг — заклинания и исцеление"); v.add_child(class_select); class_select.hide()
	class_select.item_selected.connect(func(_i): _refresh_creation_preview())
	row = _row(v)
	login_submit = _button(row, "Войти", func(): _auth("register" if registration_mode else "login")); login_submit.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	login_switch = _button(row, "Создать героя", func():
		registration_mode = not registration_mode; class_select.visible = registration_mode
		login_submit.text = "Создать и войти" if registration_mode else "Войти"
		login_switch.text = "Уже есть герой" if registration_mode else "Создать героя"
		_refresh_creation_preview())
	login_switch.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	continue_button = _button(v, "Продолжить", func(): login_requested.emit({"t": "auth", "token": Network.sessions.get(server_field.text.strip_edges(), {}).get("token", "")}))
	continue_button.visible = not Network.session.is_empty()
	if continue_button.visible: continue_button.text = "Продолжить: " + Network.session.get("name", ""); login_name.text = Network.session.get("name", "")
	var server_toggle = _button(v, "Сервер: Хроники Глубин ▾", func(): server_field.visible = not server_field.visible)
	server_toggle.add_theme_font_size_override("font_size", 11)
	server_field = LineEdit.new(); server_field.text = Network.endpoint; v.add_child(server_field); server_field.hide()
	server_field.text_changed.connect(func(text):
		var saved = Network.sessions.get(text.strip_edges(), {})
		continue_button.visible = not saved.is_empty(); continue_button.text = "Продолжить: " + saved.get("name", ""))
	server_field.tooltip_text = "Общий мир: wss://realms.neuraldeep.ru/ws\nЛокально: ws://127.0.0.1:8790"
	login_message = _label(v, "Подключение…", 11); login_message.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	var footer = _label(login_decoration, "ХРОНИКИ ГЛУБИН  /  NATIVE CLIENT\nWindows · macOS · Android · iOS", 11)
	footer.set_anchors_and_offsets_preset(Control.PRESET_CENTER_BOTTOM); footer.offset_left = -250; footer.offset_right = 250; footer.offset_top = -62; footer.offset_bottom = -20; footer.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER

func _refresh_creation_preview():
	if is_instance_valid(creation_preview): creation_preview.hide(); creation_preview.queue_free()
	if not registration_mode: return
	creation_preview = load("res://scripts/character_preview.gd").new()
	creation_preview.profile = GameData.catalog.UI_RULES.previewCharacters["warrior" if class_select.selected == 0 else "mage"]
	login_decoration.add_child(creation_preview)
	creation_preview.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	creation_preview.offset_left = 230; creation_preview.offset_right = 490; creation_preview.offset_top = -100; creation_preview.offset_bottom = 215

func _process(_dt):
	login_decoration.visible = login_panel.visible

func _auth(kind: String):
	login_requested.emit({"t": kind, "name": login_name.text.strip_edges(), "pass": login_pass.text, "cls": "warrior" if class_select.selected == 0 else "mage"})
	login_message.text = "Вход…"

func _game_hud():
	game_ui = Control.new(); root.add_child(game_ui); game_ui.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT); game_ui.mouse_filter = Control.MOUSE_FILTER_IGNORE; game_ui.hide()
	var v = _panel(game_ui, Vector2(8, 8), 222)
	status_panel = v.get_parent(); v.add_theme_constant_override("separation", 2)
	info = _label(v, "", 13)
	hp_bar = ProgressBar.new(); hp_bar.custom_minimum_size = Vector2(206, 15); v.add_child(hp_bar)
	mp_bar = ProgressBar.new(); mp_bar.custom_minimum_size = Vector2(206, 15); v.add_child(mp_bar)
	mp_bar.add_theme_stylebox_override("fill", _style(Color("285897"), Color.TRANSPARENT, 0))
	hp_bar.show_percentage = false; mp_bar.show_percentage = false
	hp_text = _label(hp_bar, "", 11); hp_text.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT); hp_text.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER; hp_text.mouse_filter = Control.MOUSE_FILTER_IGNORE
	mp_text = _label(mp_bar, "", 11); mp_text.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT); mp_text.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER; mp_text.mouse_filter = Control.MOUSE_FILTER_IGNORE
	xp_bar = ProgressBar.new(); xp_bar.custom_minimum_size.y = 13; xp_bar.show_percentage = false; v.add_child(xp_bar)
	xp_bar.add_theme_stylebox_override("fill", _style(Color("615d93"), Color.TRANSPARENT, 0))
	xp_text = _label(xp_bar, "", 10); xp_text.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT); xp_text.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER; xp_text.mouse_filter = Control.MOUSE_FILTER_IGNORE
	zone = _label(v, "", 10); status_label = _label(v, "", 10)
	buffs_row = HBoxContainer.new(); game_ui.add_child(buffs_row); buffs_row.position = Vector2(240, 8)
	buff_text = _label(buffs_row, "", 11)
	target_panel = PanelContainer.new(); game_ui.add_child(target_panel); target_panel.hide()
	target_panel.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP)
	target_panel.offset_left = -145; target_panel.offset_right = 145; target_panel.offset_top = 8; target_panel.offset_bottom = 66
	var target_v = VBoxContainer.new(); target_panel.add_child(target_v)
	target_info = _label(target_v, "", 14); target_info.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	target_bar = ProgressBar.new(); target_bar.show_percentage = false; target_bar.custom_minimum_size = Vector2(270, 13); target_v.add_child(target_bar)
	target_hint = _label(target_v, "", 10); target_hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	var map_panel = PanelContainer.new(); game_ui.add_child(map_panel)
	map_panel.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT)
	map_panel.offset_left = -176; map_panel.offset_right = -8; map_panel.offset_top = 8; map_panel.offset_bottom = 145
	minimap = load("res://scripts/map.gd").new(); minimap.compact = true; map_panel.add_child(minimap)
	var chat_box = _panel(game_ui, Vector2.ZERO, 306)
	chat_box.get_parent().set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT)
	chat_box.get_parent().offset_left = 8; chat_box.get_parent().offset_right = 314
	chat_box.get_parent().offset_top = -245 if not touch else -396
	chat_box.get_parent().offset_bottom = -8 if not touch else -160
	chat = load("res://scripts/chat_panel.gd").new(); chat_box.add_child(chat)
	chat_log = chat.log_view; chat_input = chat.input; chat_channel = chat.channel
	chat.submitted.connect(func(text): action.emit("chat", text))
	chat.settings_requested.connect(func(): toggle("settings"))
	var bottom = VBoxContainer.new(); game_ui.add_child(bottom)
	bottom.set_anchors_and_offsets_preset(Control.PRESET_CENTER_BOTTOM)
	bottom.offset_left = -248; bottom.offset_right = 248; bottom.offset_top = -90; bottom.offset_bottom = -8
	cast_bar = ProgressBar.new(); cast_bar.custom_minimum_size.y = 9; cast_bar.visible = false; bottom.add_child(cast_bar); cast_bar.show_percentage = false
	cast_text = _label(bottom, "", 11); cast_text.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER; cast_text.hide()
	var hotbar_panel = PanelContainer.new(); bottom.add_child(hotbar_panel)
	var hotbar = _row(hotbar_panel); hotbar.add_theme_constant_override("separation", 2)
	for i in 10:
		var index = i
		var button = _button(hotbar, "", func():
			if index < 5: action.emit("hotbar", index)
			else: action.emit(["attack", "target", "talk", "pickup", "skills"][index - 5], null))
		button.custom_minimum_size = Vector2(44 if not touch else 48, 44 if not touch else 48); button.expand_icon = true; button.add_theme_constant_override("icon_max_width", 32)
		var number = _label(button, str(i + 1) if i < 9 else "0", 9); number.position = Vector2(3, 0); number.mouse_filter = Control.MOUSE_FILTER_IGNORE
		if i < 5: skill_buttons.append(button); hotbar_labels.append(number)
		else:
			button.text = ["⚔", "◎", "E", "Z", "K"][i - 5]
			button.tooltip_text = ["Атака · F", "Следующая цель · Tab", "Разговор · E", "Подобрать добычу · Z", "Умения · K"][i - 5]
	quick_hint = _label(bottom, "F — атака · Tab — цель · Z — подбор · E — разговор", 10); quick_hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	var commands = PanelContainer.new(); game_ui.add_child(commands)
	commands.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_RIGHT)
	commands.offset_left = -292; commands.offset_right = -8; commands.offset_top = -58; commands.offset_bottom = -8
	var menu = _row(commands)
	for entry in [["Герой", "character"], ["Сумка", "inventory"], ["Карта", "map"], ["Меню", "menu"]]:
		var button = _button(menu, entry[0], func(): action.emit(entry[1], null)); button.custom_minimum_size = Vector2(65, 36); button.add_theme_font_size_override("font_size", 11)
	if touch:
		joystick = load("res://scripts/joystick.gd").new(); game_ui.add_child(joystick)
		joystick.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT)
		joystick.offset_left = 14; joystick.offset_right = 154; joystick.offset_top = -150; joystick.offset_bottom = -10
		joystick.changed.connect(func(value): action.emit("joystick", value))
		quick_hint.text = "Джойстик — идти · Свайп — камера"
	dead_panel = PanelContainer.new(); game_ui.add_child(dead_panel); dead_panel.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	dead_panel.offset_left = -165; dead_panel.offset_right = 165; dead_panel.offset_top = -65; dead_panel.offset_bottom = 65; dead_panel.hide()
	var death_v = VBoxContainer.new(); dead_panel.add_child(death_v)
	_label(death_v, "Вы пали в бою", 20); _label(death_v, "Возрождение в родном городе.")
	_button(death_v, "Возродиться", func(): action.emit("respawn", null))

func enter(p: Dictionary):
	login_panel.hide(); game_ui.show(); update_profile(p)

func update_profile(p: Dictionary):
	profile = p; current_stats = GameData.stats(p, active_buffs)
	if not enchant_scroll.is_empty() and not p.inv.any(func(e): return e.id == enchant_scroll): enchant_scroll = ""
	if window_kind in ["inventory", "character", "shop", "teleport", "priest", "skills"]: show_window(window_kind, true)
	var skills = GameData.catalog.CLASSES[p.cls].skills
	for i in 5:
		var id = skills[i] if i < 3 else ("potion_hp" if i == 3 else "potion_mp")
		var it = GameData.catalog.SKILLS[id] if i < 3 else GameData.catalog.ITEMS[id]
		skill_buttons[i].icon = GameData.icon(id); skill_buttons[i].tooltip_text = _skill_description(id) if i < 3 else _item_description(id)
		skill_buttons[i].text = ""; skill_buttons[i].disabled = i < 3 and p.lvl < it.lvl

func update_values(p: Dictionary, s: Dictionary, pos: Vector3, target, cooldowns: Dictionary, cast_time: float):
	if p.is_empty(): return
	info.text = "Ур. %s   %s" % [int(p.lvl), p.name]
	hp_bar.max_value = s.maxHp; hp_bar.value = p.hp; hp_bar.tooltip_text = "Здоровье: %s / %s" % [int(p.hp), int(s.maxHp)]
	hp_text.text = "HP  %s / %s" % [int(p.hp), int(s.maxHp)]
	mp_bar.max_value = s.maxMp; mp_bar.value = p.mp; mp_bar.tooltip_text = "Мана: %s / %s" % [int(p.mp), int(s.maxMp)]
	mp_text.text = "MP  %s / %s" % [int(p.mp), int(s.maxMp)]
	profile = p; current_stats = s
	xp_text.text = "EXP  %.2f%%" % (100.0 * p.xp / GameData.xp_next(int(p.lvl))) if p.lvl < 40 else "Максимальный уровень"
	var buff_lines: Array[String] = []
	for buff in active_buffs:
		if buff.until > Time.get_ticks_msec(): buff_lines.append("%s · %s с" % [GameData.catalog.SKILLS[buff.id].name, ceili((buff.until - Time.get_ticks_msec()) / 1000.0)])
	buff_text.text = "\n".join(buff_lines); buff_text.visible = not buff_lines.is_empty()
	xp_bar.max_value = GameData.xp_next(int(p.lvl)); xp_bar.value = p.xp
	var z = GameData.zone_at(pos)
	zone.text = z.name + " · " + str(z.lv)
	status_label.text = ("В сети: %s" % Network.online_count if Network.authed else "Переподключение…") + "  ·  %s монет" % int(p.coins)
	if p.get("karma", 0) > 0: status_label.text += " · Карма %s" % int(p.karma)
	target_panel.visible = is_instance_valid(target) and target.visible
	target_info.text = target.display_name if is_instance_valid(target) else ""
	target_info.modulate = Color("f2c67e") if is_instance_valid(target) and target.kind == "n" else Color("ffdfbc")
	if target_panel.visible: target_hint.text = "Повержен" if target.dead else ("E — разговор" if target.kind == "n" else "HP %s%%  ·  F / повторный щелчок — атака" % int(target.hp))
	target_bar.visible = is_instance_valid(target) and target.kind != "n"
	if target_bar.visible: target_bar.value = target.hp
	dead_panel.visible = p.get("dead", false)
	cast_bar.visible = cast_time > 0; cast_bar.max_value = maxf(0.01, cast_duration); cast_bar.value = cast_duration - cast_time
	cast_text.visible = cast_time > 0; cast_text.text = "%s · %.1f с" % [cast_name, cast_time]
	var skills = GameData.catalog.CLASSES[p.cls].skills
	for i in 3:
		var remaining = maxf(0, (cooldowns.get(skills[i], 0) - Time.get_ticks_msec()) / 1000.0)
		skill_buttons[i].text = "%.1f" % remaining if remaining > 0 else ""
		skill_buttons[i].disabled = not Network.authed or p.get("dead", false) or p.lvl < GameData.catalog.SKILLS[skills[i]].lvl or remaining > 0
	for i in [3, 4]:
		var id = "potion_hp" if i == 3 else "potion_mp"
		var count = 0
		for item in p.inv:
			if item.id == id: count += int(item.n)
		skill_buttons[i].text = str(count); skill_buttons[i].disabled = not Network.authed or p.get("dead", false) or count == 0
	if is_instance_valid(map_control): map_control.player_position = pos; map_control.queue_redraw()
	minimap.player_position = pos; minimap.queue_redraw()

func log_line(text: String):
	chat.add_message({"ch": "sys", "text": text})

func close_window():
	if is_instance_valid(window):
		window_positions[window_kind] = window.position; window.hide(); window.queue_free()
	window = null; window_kind = ""; map_control = null; window_scroll = null

func toggle(kind: String):
	if window_kind == kind: close_window()
	else: show_window(kind)

func show_window(kind: String, refresh = false):
	var search_cursor = bag_search.caret_column if refresh and is_instance_valid(bag_search) and bag_search.has_focus() else -1
	var scroll_y = window_scroll.scroll_vertical if refresh and is_instance_valid(window_scroll) else 0
	close_window(); window_kind = kind
	window = load("res://scripts/window_frame.gd").new(); game_ui.add_child(window)
	window.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	var dimensions = get_viewport().get_visible_rect().size
	var desired = {"inventory": Vector2(360, 560), "character": Vector2(410, 630), "shop": Vector2(500, 540), "map": Vector2(760, 530), "menu": Vector2(360, 405), "settings": Vector2(450, 370), "skills": Vector2(490, 400), "teleport": Vector2(480, 470), "priest": Vector2(370, 230), "controls": Vector2(500, 510)}.get(kind, Vector2(500, 520))
	if touch: desired.x += 35; desired.y += 35
	var half = Vector2(minf(desired.x, dimensions.x - 16), minf(desired.y, dimensions.y - 16)) * 0.5
	window.offset_left = -half.x; window.offset_right = half.x; window.offset_top = -half.y; window.offset_bottom = half.y
	window_body = VBoxContainer.new(); window.add_child(window_body)
	if kind in ["inventory", "character", "skills"]:
		window.position = Vector2(dimensions.x - half.x * 2 - 188, 76)
	if window_positions.has(kind): window.position = window_positions[kind]
	var row = _row(window_body); row.mouse_filter = Control.MOUSE_FILTER_STOP; row.gui_input.connect(window.drag_title)
	var titles = {"inventory": "Снаряжение и сумка", "character": "Персонаж", "map": "Карта мира", "shop": "Торговец", "teleport": "Хранитель врат", "priest": "Жрец", "menu": "Меню игры", "settings": "Настройки", "controls": "Управление", "skills": "Умения"}
	_label(row, "◇  " + titles.get(kind, kind), 14).size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_button(row, "×", close_window).tooltip_text = "Закрыть · Esc"
	if kind == "map":
		map_control = load("res://scripts/map.gd").new(); window_body.add_child(map_control); map_control.size_flags_vertical = Control.SIZE_EXPAND_FILL
		_wrapped(window_body, "Красные — мобы · Голубые — игроки · Золотые — NPC · Бирюзовая — вы\nПоказаны живые существа в области видимости сервера.", 13)
		return
	window_scroll = ScrollContainer.new(); window_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	window_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED; window_body.add_child(window_scroll)
	var list = VBoxContainer.new(); list.size_flags_horizontal = Control.SIZE_EXPAND_FILL; window_scroll.add_child(list)
	match kind:
		"inventory": _inventory_grid(list)
		"character": _character(list)
		"shop": _shop(list)
		"teleport":
			_wrapped(list, "Хранитель перенесёт вас в выбранную область. Возрождение — в родном городе: " + _home_name())
			_label(list, "Монеты: %s" % int(profile.coins))
			for t in GameData.world.teleports:
				var b = _button(list, "%s · %s" % [t.name, "%s мон." % int(t.cost) if t.cost > 0 else "бесплатно"], func(): action.emit("teleport", t.id))
				b.disabled = profile.coins < t.cost or not Network.authed; b.set_meta("teleport", t.id)
		"priest":
			var karma = float(profile.get("karma", 0)); var cost = ceili(karma) * 5
			_label(list, "Карма: %s · Монеты: %s" % [ceili(karma), int(profile.coins)], 20)
			_wrapped(list, "Ваша душа чиста. Очищение не требуется." if karma <= 0 else "Очищение снимет карму за %s монет. Счётчик PK сохраняется." % cost)
			var b = _button(list, "Очистить карму · %s мон." % cost, func(): action.emit("wash", null))
			b.disabled = karma <= 0 or profile.coins < cost or not Network.authed
		"skills": _skills(list)
		"menu":
			_label(list, "Персонаж: %s · %s" % [profile.name, GameData.catalog.CLASSES[profile.cls].name], 20)
			_wrapped(list, "Сервер: %s\n%s · Игроков в мире: %s" % [Network.endpoint, "Подключено" if Network.authed else "Переподключение…", Network.online_count])
			var grid = GridContainer.new(); grid.columns = 2; list.add_child(grid)
			for entry in [["Снаряжение · I", "inventory"], ["Персонаж · C", "character"], ["Умения · K", "skills"], ["Карта мира · M", "map"], ["Настройки", "settings"], ["Управление", "controls"]]:
				_button(grid, entry[0], func(): show_window(entry[1])).size_flags_horizontal = Control.SIZE_EXPAND_FILL
			_button(list, "Вернуть камеру за спину · V", func(): action.emit("camera", null); close_window())
			_button(list, "Полный экран / окно · F11", func(): action.emit("fullscreen", null))
			_button(list, "Сменить персонажа / сервер", func(): action.emit("logout", null))
			_button(list, "Вернуться в игру", close_window)
		"settings": _settings(list)
		"controls":
			for line in ["WASD / ЛКМ по земле — движение", "ЛКМ по цели — выбрать; ещё раз — атаковать", "F — атака · Tab — следующая цель · E — разговор", "Z / 9 — подобрать ближайшую добычу; клик — подойти и поднять", "1–3 — умения · 4–5 — зелья здоровья и маны", "I — сумка · C — персонаж · K — умения · M — карта", "ПКМ и движение мыши — камера · Колесо — приближение", "V — камера за спиной · F11 — полный экран · Esc — меню", "Ctrl + атака — PvP; на телефоне включите PvP в окне героя", "Enter — чат · /w Имя текст — ЛС · /r текст — ответ", "+текст — торговый чат · Нажмите на имя в чате для ЛС", "Телефон: джойстик — движение; свайп по миру — камера", "Два пальца — масштаб; двойное нажатие на вещь — действие"]:
				_wrapped(list, line)
	window_scroll.set_deferred("scroll_vertical", scroll_y)
	if search_cursor >= 0 and kind == "inventory": bag_search.grab_focus(); bag_search.caret_column = search_cursor

func _wrapped(parent: Node, text: String, font_size = 13) -> Label:
	var label = _label(parent, text, font_size); label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	return label

func _home_name() -> String:
	for town in GameData.world.towns:
		if town.id == profile.get("home", "harbor"): return town.name
	return "Светлая Гавань"

func _item_row(parent, id: String, text: String) -> HBoxContainer:
	var row = _row(parent); var tex = TextureRect.new(); tex.texture = GameData.icon(id)
	tex.custom_minimum_size = Vector2(36, 36); tex.expand_mode = TextureRect.EXPAND_IGNORE_SIZE; tex.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED; row.add_child(tex)
	var label = _wrapped(row, text, 15); label.tooltip_text = _skill_description(id) if GameData.catalog.SKILLS.has(id) else _item_description(id)
	return row

func _item_description(id: String, ench = 0) -> String:
	var it = GameData.catalog.ITEMS[id]; var result = it.name + (" +%s" % ench if ench > 0 else "")
	if it.has("grade"): result += " · %s" % ("Без ранга" if it.grade == "none" else "Ранг " + str(it.grade).to_upper())
	if it.get("twoHand", false): result += " · Двуручный посох"
	if it.get("robe", false): result += " · Мантия"
	if it.get("full", false): result += " · Полный доспех (занимает поножи)"
	for key in ["patk", "matk", "pdef", "mdef", "hp", "mp", "crit", "lvl", "w"]:
		if not it.has(key): continue
		var value = GameData.ench_value(it, key, ench) if key in ["patk", "matk", "pdef", "mdef"] else float(it[key])
		result += "\n%s: %s" % [STAT_NAMES[key], "%.1f%%" % (value * 100) if key == "crit" else str(snappedf(value, 0.01))]
	if it.get("use") == "ench": result += "\nУсиление: до +%s безопасно; далее %s%% успеха. При неудаче предмет превращается в кристаллы." % [int(GameData.catalog.UI_RULES.safeEnch), int(GameData.catalog.UI_RULES.enchChance * 100)]
	if it.has("slot") and not profile.is_empty():
		var reason = GameData.wear_error(profile, it)
		if not reason.is_empty(): result += "\n" + reason
	for st in GameData.catalog.SETS.values():
		if id in st.parts:
			result += "\nКомплект «%s»: %s" % [st.name, _bonus_text(st.bonus)]
	return result

func _bonus_text(bonus: Dictionary) -> String:
	var parts: Array[String] = []
	for key in bonus:
		parts.append("%s +%s" % [STAT_NAMES.get(key, key), "%.0f%%" % (bonus[key] * 100) if key in ["crit", "cast"] else str(bonus[key])])
	return ", ".join(parts)

func _shop(list):
	_label(list, "Ваши монеты: %s" % int(profile.coins), 20)
	var tabs = _row(list)
	for entry in [["Купить", "buy"], ["Продать", "sell"]]:
		var b = _button(tabs, entry[0], func(): shop_tab = entry[1]; show_window("shop"))
		b.toggle_mode = true; b.button_pressed = shop_tab == entry[1]; b.set_meta("shop_tab", entry[1])
	if shop_tab == "buy":
		for id in GameData.catalog.SHOP:
			var it = GameData.catalog.ITEMS[id]; var row = _item_row(list, id, "%s\n%s мон. · Ур. %s" % [it.name, int(it.price), int(it.get("lvl", 1))])
			var b = _button(row, "Купить", func(): action.emit("buy", id)); b.disabled = profile.coins < it.price or not Network.authed; b.set_meta("buy", id)
			if it.get("stack", false):
				b = _button(row, "×10", func(): action.emit("buy_stack", {"id": id, "n": 10})); b.disabled = profile.coins < it.price * 10 or not Network.authed
	else:
		if profile.inv.is_empty(): _label(list, "В сумке нет вещей для продажи.")
		for i in profile.inv.size():
			var index = i; var item = profile.inv[i]; var it = GameData.catalog.ITEMS[item.id]; var price = GameData.sell_price(item.id)
			var row = _item_row(list, item.id, "%s%s ×%s\n%s мон. за штуку" % [it.name, " +%s" % int(item.e) if item.get("e", 0) > 0 else "", int(item.n), price])
			var b = _button(row, "Продать 1", func(): action.emit("sell", index)); b.set_meta("sell", index); b.disabled = not Network.authed
			if item.n > 1:
				b = _button(row, "Все · %s" % (price * int(item.n)), func(): action.emit("sell_stack", {"idx": index, "n": int(item.n)})); b.set_meta("sell_stack", item.id); b.disabled = not Network.authed

func _character(list):
	var preview = load("res://scripts/character_preview.gd").new(); preview.profile = profile; list.add_child(preview)
	_label(list, "%s · %s · Уровень %s" % [profile.name, GameData.catalog.CLASSES[profile.cls].name, int(profile.lvl)], 22)
	_label(list, "Родной город: " + _home_name())
	_label(list, "HP %s / %s · MP %s / %s" % [int(profile.hp), int(current_stats.maxHp), int(profile.mp), int(current_stats.maxMp)])
	_label(list, "Опыт: %s / %s · %.1f%%" % [int(profile.xp), GameData.xp_next(int(profile.lvl)), 100.0 * profile.xp / GameData.xp_next(int(profile.lvl))])
	var b = _button(list, "PvP: ВКЛЮЧЁН" if pvp_enabled else "PvP: выключен", func(): action.emit("pvp", null)); b.set_meta("pvp", true)
	var grid = GridContainer.new(); grid.columns = 2; list.add_child(grid)
	for pair in [["str", "STR · Сила"], ["dex", "DEX · Ловкость"], ["con", "CON · Выносливость"], ["int", "INT · Интеллект"], ["wit", "WIT · Мудрость"], ["men", "MEN · Дух"]]:
		_label(grid, "%s: %s" % [pair[1], int(current_stats.attr[pair[0]])]).size_flags_horizontal = Control.SIZE_EXPAND_FILL
	for key in ["patk", "matk", "pdef", "mdef", "acc", "eva", "crit", "aspd", "cast", "speed", "range"]:
		_label(grid, "%s: %s" % [STAT_NAMES[key], "%.1f%%" % (current_stats[key] * 100) if key == "crit" else "%.2f" % current_stats[key]])
	_label(list, "Вес: %.1f / %s · Убийств мобов: %s" % [current_stats.load, int(current_stats.cap), int(profile.get("kills", 0))])
	_label(list, "Карма: %s · PvP: %s · PK: %s" % [ceili(profile.get("karma", 0)), int(profile.get("pvp", 0)), int(profile.get("pk", 0))])
	if current_stats.sets.is_empty(): _label(list, "Комплекты: нет надетых частей")
	for st in current_stats.sets:
		_wrapped(list, "%s · %s/%s · %s\n%s" % [st.name, int(st.have), st.parts.size(), "Бонус активен" if st.have == st.parts.size() else "Неполный комплект", _bonus_text(st.bonus)])

func _inventory_grid(parent):
	if current_stats.load > current_stats.cap * 0.7: _wrapped(parent, "Перегруз: скорость −40%, восстановление −50%. Освободите сумку.", 13).modulate = Color("f3b37d")
	if enchant_scroll != "":
		_wrapped(parent, "Выберите вещь для усиления. После +3 неудача уничтожает вещь. Шанс успеха: 66%.", 13)
		_button(parent, "Отменить усиление", func(): enchant_scroll = ""; show_window("inventory"))
	var columns = VBoxContainer.new(); parent.add_child(columns)
	var worn = VBoxContainer.new(); columns.add_child(worn); _label(worn, "Снаряжение", 12)
	var equip_grid = GridContainer.new(); equip_grid.columns = 4; worn.add_child(equip_grid)
	for slot in GameData.catalog.SLOTS:
		var id = profile.equip.get(slot.id)
		var payload = {"source": "inventory", "slot": slot.id, "id": id, "e": profile.get("enc", {}).get(slot.id, 0)} if id != null else {}
		var b = _slot(equip_grid, payload, slot.name); b.slot_type = slot.type
		if slot.id == "shield" and GameData.catalog.ITEMS.get(profile.equip.get("weapon"), {}).get("twoHand", false): b.text = "Двуручное"; b.tooltip_text = "Посох занимает обе руки. Надевание щита снимет посох."
		if slot.id == "legs" and GameData.catalog.ITEMS.get(profile.equip.get("armor"), {}).get("full", false): b.text = "Доспех"; b.tooltip_text = "Полный доспех занимает этот слот. Надевание поножей снимет доспех."
		b.item_dropped.connect(func(item): action.emit("equip_slot", {"idx": item.idx, "slot": slot.id}))
	var bag = VBoxContainer.new(); bag.size_flags_horizontal = Control.SIZE_EXPAND_FILL; columns.add_child(bag)
	_label(bag, "Предметы   ·   %s ячеек" % profile.inv.size(), 12)
	var filters = _row(bag)
	for i in 4:
		var index = i
		var b = _button(filters, ["Все", "Экип.", "Расход.", "Добыча"][i], func(): bag_filter = index; show_window("inventory", true))
		b.toggle_mode = true; b.button_pressed = bag_filter == i; b.set_meta("bag_filter", i)
	var tools = _row(bag)
	var search = LineEdit.new(); bag_search = search; search.placeholder_text = "Найти предмет…"; search.text = bag_query; search.size_flags_horizontal = Control.SIZE_EXPAND_FILL; tools.add_child(search); search.set_meta("bag_search", true)
	search.text_changed.connect(func(value): bag_query = value; _fill_bag())
	var sort_menu = OptionButton.new(); sort_menu.add_item("Порядок"); sort_menu.add_item("Имя"); sort_menu.add_item("Ранг"); sort_menu.select(bag_sort); tools.add_child(sort_menu)
	sort_menu.item_selected.connect(func(index): bag_sort = index; _fill_bag())
	var scroll = ScrollContainer.new(); scroll.custom_minimum_size = Vector2(0, 156); scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL; bag.add_child(scroll)
	bag_grid = GridContainer.new(); bag_grid.columns = 6; scroll.add_child(bag_grid); _fill_bag()
	var selected: Dictionary = {}
	var selected_index = int(selected_item.get("idx", -1))
	if selected_index >= 0 and selected_index < profile.inv.size() and profile.inv[selected_index].id == selected_item.get("id"):
		selected = profile.inv[selected_index].duplicate(); selected.idx = selected_index; selected.source = "inventory"
	if selected_item.has("slot"):
		var slot = selected_item.slot; var id = profile.equip.get(slot)
		if id != null: selected = {"source": "inventory", "slot": slot, "id": id, "e": profile.get("enc", {}).get(slot, 0)}
	item_details = VBoxContainer.new(); item_details.custom_minimum_size.y = 70; parent.add_child(item_details)
	if not selected.is_empty(): _select_item(selected)
	else: selected_item = {}; _wrapped(item_details, "Выберите предмет для просмотра.", 14)

	# Fixed wallet stays visible even when the inventory contents scroll.
	var wallet = VBoxContainer.new(); window_body.add_child(wallet)
	wallet_label = _label(wallet, "●  %s  монет" % _money(int(profile.coins)), 17); wallet_label.modulate = Color("e5c779")
	wallet_label.tooltip_text = "Монеты зачисляются сервером после подбора. Z — ближайшая добыча."
	var weight = ProgressBar.new(); weight.custom_minimum_size.y = 14; weight.max_value = current_stats.cap; weight.value = current_stats.load; wallet.add_child(weight)
	weight.tooltip_text = "Вес: %.1f / %s" % [current_stats.load, int(current_stats.cap)]

func _money(value: int) -> String:
	var digits = str(value); var result = ""
	for i in digits.length():
		if i > 0 and (digits.length() - i) % 3 == 0: result += " "
		result += digits[i]
	return result

func _fill_bag():
	if not is_instance_valid(bag_grid): return
	for child in bag_grid.get_children(): child.free()
	var entries: Array = []
	for i in profile.inv.size():
		var payload = profile.inv[i].duplicate(); var it = GameData.catalog.ITEMS[payload.id]
		if not bag_query.is_empty() and not str(it.name).to_lower().contains(bag_query.to_lower()): continue
		if bag_filter == 1 and not it.has("slot"): continue
		if bag_filter == 2 and not it.has("use"): continue
		if bag_filter == 3 and (it.has("slot") or it.has("use")): continue
		payload.idx = i; payload.source = "inventory"; entries.append(payload)
	if bag_sort > 0:
		entries.sort_custom(func(a, b):
			var ia = GameData.catalog.ITEMS[a.id]; var ib = GameData.catalog.ITEMS[b.id]
			if bag_sort == 2 and ia.get("grade", "none") != ib.get("grade", "none"):
				return ["none", "d", "c", "b", "a", "s"].find(ia.get("grade", "none")) > ["none", "d", "c", "b", "a", "s"].find(ib.get("grade", "none"))
			return str(ia.name).naturalnocasecmp_to(ib.name) < 0)
	for i in maxi(24, entries.size()):
		var b = _slot(bag_grid, entries[i] if i < entries.size() else {}, ""); b.accept_equipped = true
		b.item_dropped.connect(func(item): action.emit("unequip", item.slot))

func _slot(parent, payload: Dictionary, empty_name: String) -> Button:
	var b = load("res://scripts/item_slot.gd").new(); b.payload = payload
	b.custom_minimum_size = Vector2(52 if not touch else 57, 46 if not touch else 51); b.expand_icon = true; b.add_theme_constant_override("icon_max_width", 34); parent.add_child(b)
	if payload.is_empty(): b.text = empty_name; b.add_theme_font_size_override("font_size", 10)
	else:
		b.icon = GameData.icon(payload.id); b.tooltip_text = _item_description(payload.id, int(payload.get("e", 0)))
		b.text = "×%s" % int(payload.n) if payload.get("n", 1) > 1 else ("+%s" % int(payload.e) if payload.get("e", 0) > 0 else "")
		if enchant_scroll != "": b.modulate = Color("ffe0a0") if GameData.enchant_error(payload.id, int(payload.get("e", 0)), enchant_scroll).is_empty() else Color("727d86")
		b.pressed.connect(func(): _select_item(payload)); b.activated.connect(func(): _activate_item(payload))
	return b

func _activate_item(item: Dictionary):
	if enchant_scroll != "":
		var reason = GameData.enchant_error(item.id, int(item.get("e", 0)), enchant_scroll)
		if not reason.is_empty(): log_line(reason); return
		var ref = {"slot": item.slot} if item.has("slot") else {"bag": item.idx}
		action.emit("enchant", {"scroll": enchant_scroll, "ref": ref}); return
	if item.has("slot"): action.emit("unequip", item.slot); return
	var it = GameData.catalog.ITEMS[item.id]
	if it.has("slot"): action.emit("equip", item.idx)
	elif it.get("use") == "ench": enchant_scroll = item.id; show_window("inventory", true)
	elif it.has("use"): action.emit("use", item.id)

func _select_item(item: Dictionary):
	selected_item = item.duplicate()
	for child in item_details.get_children(): item_details.remove_child(child); child.queue_free()
	var it = GameData.catalog.ITEMS[item.id]
	_wrapped(item_details, _item_description(item.id, int(item.get("e", 0))).replace("\n", " · "), 13)
	var actions = _row(item_details)
	var title = "Усилить" if enchant_scroll != "" else ("Снять" if item.has("slot") else ("Надеть" if it.has("slot") else ("Усиление…" if it.get("use") == "ench" else "Использовать")))
	if it.has("slot") or it.has("use"):
		var b = _button(actions, title, func(): _activate_item(item))
		var reason = GameData.enchant_error(item.id, int(item.get("e", 0)), enchant_scroll) if enchant_scroll != "" else (GameData.wear_error(profile, it) if it.has("slot") and not item.has("slot") else "")
		b.disabled = not reason.is_empty() or not Network.authed; b.tooltip_text = reason; b.set_meta("item_action", item.id)
	if item.has("idx"):
		var b = _button(actions, "Продать · %s мон." % GameData.sell_price(item.id), func(): action.emit("sell", item.idx)); b.tooltip_text = "Подойдите к торговцу"

func _skill_description(id: String) -> String:
	var sk = GameData.catalog.SKILLS[id]
	var result = "%s · Уровень %s\nМана: %s · Перезарядка: %s с" % [sk.name, int(sk.lvl), int(sk.mp), sk.cd]
	if sk.has("cast"): result += "\nПодготовка: %.2f с" % (sk.cast / maxf(0.1, current_stats.get("cast", 1)))
	if sk.has("mul"): result += "\nСила: ×%s" % sk.mul
	if sk.has("radius"): result += "\nРадиус: %s" % sk.radius
	if sk.has("range"): result += "\nДальность: %s" % sk.range
	if sk.has("dur"): result += "\nДлительность: %s с" % sk.dur
	if sk.kind == "heal": result += "\nВосстанавливает %s%% здоровья" % int(sk.amount * 100)
	return result

func _skills(list):
	for i in GameData.catalog.CLASSES[profile.cls].skills.size():
		var id = GameData.catalog.CLASSES[profile.cls].skills[i]; var sk = GameData.catalog.SKILLS[id]
		var row = _item_row(list, id, _skill_description(id))
		var b = _button(row, "Применить · %s" % (i + 1), func(): action.emit("hotbar", i))
		b.disabled = profile.lvl < sk.lvl or not Network.authed or profile.get("dead", false)

func _settings(list):
	_label(list, "Чат", 20)
	for entry in [["sys", "Системные сообщения"], ["trade", "Торговый чат во вкладке «Все»"], ["near", "Ближний чат во вкладке «Все»"], ["bubbles", "Сообщения над персонажами"]]:
		var b = CheckButton.new(); b.text = entry[1]; b.button_pressed = chat.preferences[entry[0]]; list.add_child(b)
		b.toggled.connect(func(value): chat.set_preference(entry[0], value))
	var row = _row(list); _label(row, "Размер текста чата")
	var font_size = SpinBox.new(); font_size.min_value = 10; font_size.max_value = 18; font_size.step = 1; font_size.value = chat.preferences.size; row.add_child(font_size)
	font_size.value_changed.connect(func(value): chat.set_preference("size", int(value)))
	_label(list, "Изображение", 20)
	_button(list, "Полный экран / окно", func(): action.emit("fullscreen", null))
	_button(list, "Вернуть камеру за спину", func(): action.emit("camera", null))
	_wrapped(list, "Настройки чата сохраняются на этом устройстве. Персонаж и весь игровой прогресс сохраняются на сервере.", 14)
