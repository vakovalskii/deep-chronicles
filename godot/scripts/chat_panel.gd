extends VBoxContainer
signal submitted(text: String)
signal settings_requested
const Settings = preload("res://scripts/interface_settings.gd")
var system_view: RichTextLabel
var system_box: VBoxContainer
var system_frame: PanelContainer
var system_history: Array = []
var panes: VBoxContainer
var player_frame: PanelContainer
var system_grip: Control
var player_grip: Control
var height_budget = 520.0
var log_view: RichTextLabel
var input: LineEdit
var channel: OptionButton
var recipient: LineEdit
var tabs: Array = []
var history: Array = []
var unread = {"all": 0, "trade": 0, "near": 0, "pm": 0, "party": 0}
var active = "all"
var preferences = {"sys": true, "trade": true, "near": true, "bubbles": true, "size": 11, "combat": true, "rewards": true, "info": true, "system_height": 100, "player_height": 164}
const CHANNELS = ["all", "trade", "near", "party", "pm"]
const TITLES = ["Все", "+Торг", "Рядом", "Пати", "ЛС"]

func _ready():
	# Preserve the previous total height when upgrading from the split-container UI.
	preferences.player_height = maxi(70, int(Settings.read_value("chat", "height", 320)) - 156)
	for key in preferences: preferences[key] = Settings.read_value("chat", key, preferences[key])
	add_theme_constant_override("separation", 2)
	mouse_filter = Control.MOUSE_FILTER_STOP; mouse_force_pass_scroll_events = false
	panes = VBoxContainer.new(); panes.add_theme_constant_override("separation", 2); add_child(panes)
	system_frame = PanelContainer.new(); panes.add_child(system_frame)
	system_frame.add_theme_stylebox_override("panel", _chat_style())
	system_box = VBoxContainer.new(); system_frame.add_child(system_box)
	system_box.add_theme_constant_override("separation", 1)
	system_grip = _grip(system_box, "system_height", "Система")
	system_view = RichTextLabel.new(); system_view.custom_minimum_size.y = 24; system_view.size_flags_vertical = Control.SIZE_EXPAND_FILL
	system_view.scroll_following = true; system_view.selection_enabled = true; system_view.mouse_force_pass_scroll_events = false; system_box.add_child(system_view)
	var row = HBoxContainer.new(); add_child(row); row.add_theme_constant_override("separation", 3)
	for i in CHANNELS.size():
		var key = CHANNELS[i]
		var button = Button.new(); button.text = TITLES[i]; button.toggle_mode = true; button.add_theme_font_size_override("font_size", 11)
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL; row.add_child(button); tabs.append(button)
		button.pressed.connect(func(): select_channel(key))
	var settings = Button.new(); settings.text = "⚙"; settings.tooltip_text = "Настройки чата"; row.add_child(settings); var tabs_row = row; settings.pressed.connect(func(): settings_requested.emit())
	log_view = RichTextLabel.new(); log_view.custom_minimum_size = Vector2(252, 36); log_view.size_flags_vertical = Control.SIZE_EXPAND_FILL
	log_view.bbcode_enabled = false; log_view.scroll_following = true; log_view.selection_enabled = true; player_frame = PanelContainer.new(); panes.add_child(player_frame)
	player_frame.add_theme_stylebox_override("panel", _chat_style())
	var player_box = VBoxContainer.new(); player_box.add_theme_constant_override("separation", 0); player_frame.add_child(player_box)
	player_grip = _grip(player_box, "player_height", "Чат")
	player_box.add_child(log_view); log_view.mouse_force_pass_scroll_events = false
	move_child(tabs_row, 1)
	log_view.meta_clicked.connect(func(peer): recipient.text = str(peer); select_channel("pm"); input.grab_focus())
	recipient = LineEdit.new(); recipient.placeholder_text = "Кому: имя персонажа"; recipient.max_length = 16; add_child(recipient); recipient.hide()
	row = HBoxContainer.new(); row.add_theme_constant_override("separation", 3); add_child(row)
	channel = OptionButton.new()
	for title in ["Мир", "Рядом", "Торг", "ЛС", "Пати"]: channel.add_item(title)
	channel.add_theme_font_size_override("font_size", 12); row.add_child(channel)
	channel.item_selected.connect(func(i): select_channel(["all", "near", "trade", "pm", "party"][i]))
	input = LineEdit.new(); input.placeholder_text = "Enter — чат"; input.max_length = 160; input.size_flags_horizontal = Control.SIZE_EXPAND_FILL; row.add_child(input)
	input.text_submitted.connect(func(_text): submit())
	var send = Button.new(); send.text = "→"; send.tooltip_text = "Отправить"; row.add_child(send); send.pressed.connect(submit)
	input.gui_input.connect(func(event):
		if event is InputEventKey and event.pressed and event.keycode == KEY_ESCAPE: input.release_focus(); input.accept_event())
	select_channel("all")

func _grip(parent: Control, key: String, title: String) -> Control:
	var grip = preload("res://scripts/chat_resize_grip.gd").new(); parent.add_child(grip)
	var label = Label.new(); label.text = title; label.add_theme_font_size_override("font_size", 10)
	label.modulate = Color("a99c7e"); label.mouse_filter = Control.MOUSE_FILTER_IGNORE; grip.add_child(label)
	grip.dragged.connect(func(delta):
		var frame = system_frame if key == "system_height" else player_frame
		var other = player_frame.size.y if key == "system_height" else (system_frame.size.y if preferences.sys else 0.0)
		preferences[key] = roundi(clampf(frame.size.y + delta, 54 if key == "system_height" else 70, maxf(70, height_budget - _chrome_height() - other)))
		fit_height(height_budget))
	grip.finished.connect(func(): Settings.write_value("chat", key, preferences[key]))
	return grip

func _chrome_height() -> float:
	var height = 2.0 if preferences.sys else 0.0
	var count = 1
	for child in get_children():
		if child is Control and child != panes and child.visible:
			height += child.get_combined_minimum_size().y; count += 1
	return height + (count - 1) * get_theme_constant("separation")

func fit_height(available: float):
	height_budget = maxf(240, available)
	if not is_instance_valid(player_frame): return
	var sys = clampf(float(preferences.system_height), 54, 420) if preferences.sys else 0.0
	var social = clampf(float(preferences.player_height), 70, 420)
	var room = height_budget - _chrome_height()
	# Temporary viewport clamping never overwrites the saved desired dimensions.
	if sys + social > room:
		var excess = sys + social - room
		var reducible = maxf(1, sys + social - (54 if preferences.sys else 0) - 70)
		if preferences.sys: sys -= excess * (sys - 54) / reducible
		social -= excess * (social - 70) / reducible
	system_frame.custom_minimum_size.y = sys
	player_frame.custom_minimum_size.y = social

func _chat_style() -> StyleBoxFlat:
	var s = StyleBoxFlat.new(); s.bg_color = Color(0.035, 0.045, 0.04, 0.42); s.border_color = Color(0.54, 0.48, 0.35, 0.55)
	s.border_width_top = 1; s.border_width_bottom = 1
	s.content_margin_left = 3; s.content_margin_right = 3; s.content_margin_top = 2; s.content_margin_bottom = 2
	return s

func submit():
	if input.text.strip_edges().is_empty(): return
	if not Network.authed:
		add_message({"ch": "sys", "category": "info", "text": "Сообщение не отправлено: нет связи с сервером. Текст сохранён в поле ввода."}); return
	if channel.selected == 3 and recipient.text.strip_edges().is_empty() and not input.text.begins_with("/") and not input.text.begins_with('"'):
		recipient.grab_focus(); return
	submitted.emit(input.text); input.clear(); input.release_focus()

func select_channel(key: String):
	active = key; unread[key] = 0
	channel.select(["all", "near", "trade", "pm", "party"].find(key)); recipient.visible = key == "pm"
	fit_height(height_budget)
	_redraw()

func accepts(entry: Dictionary) -> bool:
	if entry.ch == "sys": return false
	if active == "all":
		return entry.ch in ["all", "party"] or (entry.ch in ["trade", "near"] and preferences[entry.ch])
	return entry.ch == active

func add_message(entry: Dictionary):
	var destination = system_history if entry.ch == "sys" else history
	destination.append(entry)
	if destination.size() > 250: destination.pop_front()
	if entry.ch in unread and entry.ch != active: unread[entry.ch] += 1
	_redraw()

func set_preference(key: String, value):
	preferences[key] = value
	Settings.write_value("chat", key, value)
	fit_height(height_budget)
	_redraw()

func _redraw():
	var chat_scroll = log_view.get_v_scroll_bar(); var old_chat = chat_scroll.value
	var sys_scroll = system_view.get_v_scroll_bar(); var old_sys = sys_scroll.value
	var follow_chat = old_chat >= chat_scroll.max_value - chat_scroll.page - 2
	var follow_sys = old_sys >= sys_scroll.max_value - sys_scroll.page - 2
	log_view.scroll_following = follow_chat; system_view.scroll_following = follow_sys
	system_frame.visible = preferences.sys
	system_view.clear(); system_view.add_theme_font_size_override("normal_font_size", int(preferences.size))
	for entry in system_history:
		if entry.ch != "sys" or not preferences.get(entry.get("category", "info"), true): continue
		system_view.push_color({"combat": Color("a0c998"), "rewards": Color("e0d96d")}.get(entry.get("category", "info"), Color("b9ad91")))
		system_view.add_text(str(entry.text) + "\n"); system_view.pop()
	log_view.clear(); log_view.add_theme_font_size_override("normal_font_size", int(preferences.size))
	for i in tabs.size():
		var count = int(unread[CHANNELS[i]])
		tabs[i].text = TITLES[i] + (" (%s)" % count if count > 0 else "")
		tabs[i].button_pressed = active == CHANNELS[i]
	for entry in history:
		if not accepts(entry): continue
		var color = {"all": Color("d9d2bf"), "trade": Color("c69bc7"), "near": Color("67bfbd"), "party": Color("9fc4ec"), "pm": Color("b8daa0"), "sys": Color("b9ad91")}.get(entry.ch, Color.WHITE)
		log_view.push_color(color)
		if entry.ch != "sys":
			log_view.push_meta(entry.get("peer", entry.get("from", ""))); log_view.add_text(entry.get("from", "")); log_view.pop()
			if entry.has("to"): log_view.add_text(" → " + entry.to)
			log_view.add_text(": ")
		log_view.add_text(str(entry.text) + "\n"); log_view.pop()

	if not follow_chat: chat_scroll.set_deferred("value", old_chat)
	if not follow_sys: sys_scroll.set_deferred("value", old_sys)

func clear_history():
	history.clear(); system_history.clear(); recipient.clear()
	for key in unread: unread[key] = 0
	_redraw()
