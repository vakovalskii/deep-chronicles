extends VBoxContainer
signal submitted(text: String)
signal settings_requested
const Settings = preload("res://scripts/interface_settings.gd")
var system_view: RichTextLabel
var system_box: VBoxContainer
var system_frame: PanelContainer
var system_history: Array = []
var split: VSplitContainer
var log_view: RichTextLabel
var input: LineEdit
var channel: OptionButton
var recipient: LineEdit
var tabs: Array = []
var history: Array = []
var unread = {"all": 0, "trade": 0, "near": 0, "pm": 0}
var active = "all"
var preferences = {"sys": true, "trade": true, "near": true, "bubbles": true, "size": 12, "combat": true, "rewards": true, "info": true, "height": 320}
const CHANNELS = ["all", "trade", "near", "pm"]
const TITLES = ["Все", "+Торг", "Рядом", "ЛС"]

func _ready():
	for key in preferences: preferences[key] = Settings.read_value("chat", key, preferences[key])
	mouse_filter = Control.MOUSE_FILTER_STOP; mouse_force_pass_scroll_events = false
	split = VSplitContainer.new(); split.custom_minimum_size = Vector2(280, int(preferences.height) - 60); split.size_flags_vertical = Control.SIZE_EXPAND_FILL; add_child(split)
	system_frame = PanelContainer.new(); split.add_child(system_frame)
	system_box = VBoxContainer.new(); system_frame.add_child(system_box)
	var system_title = Label.new(); system_title.text = "Система / бой"; system_title.add_theme_font_size_override("font_size", 11); system_box.add_child(system_title)
	system_view = RichTextLabel.new(); system_view.custom_minimum_size.y = 60; system_view.size_flags_vertical = Control.SIZE_EXPAND_FILL
	system_view.scroll_following = true; system_view.selection_enabled = true; system_view.mouse_force_pass_scroll_events = false; system_box.add_child(system_view)
	split.split_offset = int(Settings.read_value("chat", "split", -50))
	split.dragged.connect(func(offset): Settings.write_value("chat", "split", offset))
	var row = HBoxContainer.new(); add_child(row); row.add_theme_constant_override("separation", 3)
	for i in CHANNELS.size():
		var key = CHANNELS[i]
		var button = Button.new(); button.text = TITLES[i]; button.toggle_mode = true; button.add_theme_font_size_override("font_size", 12)
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL; row.add_child(button); tabs.append(button)
		button.pressed.connect(func(): select_channel(key))
	var settings = Button.new(); settings.text = "⚙"; settings.tooltip_text = "Настройки чата"; row.add_child(settings); var tabs_row = row; settings.pressed.connect(func(): settings_requested.emit())
	log_view = RichTextLabel.new(); log_view.custom_minimum_size = Vector2(280, 90); log_view.size_flags_vertical = Control.SIZE_EXPAND_FILL
	log_view.bbcode_enabled = false; log_view.scroll_following = true; log_view.selection_enabled = true; var player_frame = PanelContainer.new(); split.add_child(player_frame)
	player_frame.add_child(log_view); log_view.mouse_force_pass_scroll_events = false
	move_child(tabs_row, 1)
	log_view.meta_clicked.connect(func(peer): recipient.text = str(peer); select_channel("pm"); input.grab_focus())
	recipient = LineEdit.new(); recipient.placeholder_text = "Кому: имя персонажа"; recipient.max_length = 16; add_child(recipient); recipient.hide()
	row = HBoxContainer.new(); row.add_theme_constant_override("separation", 3); add_child(row)
	channel = OptionButton.new()
	for title in ["Мир", "Рядом", "Торг", "ЛС"]: channel.add_item(title)
	channel.add_theme_font_size_override("font_size", 12); row.add_child(channel)
	channel.item_selected.connect(func(i): select_channel(["all", "near", "trade", "pm"][i]))
	input = LineEdit.new(); input.placeholder_text = "Enter — чат"; input.max_length = 160; input.size_flags_horizontal = Control.SIZE_EXPAND_FILL; row.add_child(input)
	input.text_submitted.connect(func(_text): submit())
	var send = Button.new(); send.text = "→"; send.tooltip_text = "Отправить"; row.add_child(send); send.pressed.connect(submit)
	input.gui_input.connect(func(event):
		if event is InputEventKey and event.pressed and event.keycode == KEY_ESCAPE: input.release_focus(); input.accept_event())
	select_channel("all")

func submit():
	if input.text.strip_edges().is_empty(): return
	if not Network.authed:
		add_message({"ch": "sys", "category": "info", "text": "Сообщение не отправлено: нет связи с сервером. Текст сохранён в поле ввода."}); return
	if channel.selected == 3 and recipient.text.strip_edges().is_empty() and not input.text.begins_with("/") and not input.text.begins_with('"'):
		recipient.grab_focus(); return
	submitted.emit(input.text); input.clear(); input.release_focus()

func select_channel(key: String):
	active = key; unread[key] = 0
	channel.select(["all", "near", "trade", "pm"].find(key)); recipient.visible = key == "pm"
	_redraw()

func accepts(entry: Dictionary) -> bool:
	if entry.ch == "sys": return false
	if active == "all":
		return entry.ch == "all" or (entry.ch in ["trade", "near"] and preferences[entry.ch])
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
	split.custom_minimum_size.y = int(preferences.height) - 60
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
		system_view.push_color({"combat": Color("e1aba0"), "rewards": Color("dcca83")}.get(entry.get("category", "info"), Color("a6b9c5")))
		system_view.add_text(str(entry.text) + "\n"); system_view.pop()
	log_view.clear(); log_view.add_theme_font_size_override("normal_font_size", int(preferences.size))
	for i in tabs.size():
		var count = int(unread[CHANNELS[i]])
		tabs[i].text = TITLES[i] + (" (%s)" % count if count > 0 else "")
		tabs[i].button_pressed = active == CHANNELS[i]
	for entry in history:
		if not accepts(entry): continue
		var color = {"all": Color("e7e0cd"), "trade": Color("f2c680"), "near": Color("99d9ba"), "pm": Color("d8adf4"), "sys": Color("a0b4bf")}.get(entry.ch, Color.WHITE)
		log_view.push_color(color)
		if entry.ch != "sys":
			log_view.add_text("[%s] " % {"all": "Мир", "trade": "Торг", "near": "Рядом", "pm": "ЛС"}[entry.ch])
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
