extends VBoxContainer
signal submitted(text: String)
signal settings_requested
var log_view: RichTextLabel
var input: LineEdit
var channel: OptionButton
var recipient: LineEdit
var tabs: Array = []
var history: Array = []
var unread = {"all": 0, "trade": 0, "near": 0, "pm": 0}
var active = "all"
var preferences = {"sys": true, "trade": true, "near": true, "bubbles": true, "size": 12}
const CHANNELS = ["all", "trade", "near", "pm"]
const TITLES = ["Все", "+Торг", "Рядом", "ЛС"]

func _ready():
	if not Network.test_mode:
		var config = ConfigFile.new()
		if config.load("user://interface.cfg") == OK:
			for key in preferences: preferences[key] = config.get_value("chat", key, preferences[key])
	var row = HBoxContainer.new(); add_child(row); row.add_theme_constant_override("separation", 3)
	for i in CHANNELS.size():
		var key = CHANNELS[i]
		var button = Button.new(); button.text = TITLES[i]; button.toggle_mode = true; button.add_theme_font_size_override("font_size", 12)
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL; row.add_child(button); tabs.append(button)
		button.pressed.connect(func(): select_channel(key))
	var settings = Button.new(); settings.text = "⚙"; settings.tooltip_text = "Настройки чата"; row.add_child(settings); var tabs_row = row; settings.pressed.connect(func(): settings_requested.emit())
	log_view = RichTextLabel.new(); log_view.custom_minimum_size = Vector2(280, 130); log_view.size_flags_vertical = Control.SIZE_EXPAND_FILL
	log_view.bbcode_enabled = false; log_view.scroll_following = true; log_view.selection_enabled = true; add_child(log_view)
	move_child(log_view, 0)
	move_child(tabs_row, 1)
	log_view.meta_clicked.connect(func(peer): recipient.text = str(peer); select_channel("pm"); input.grab_focus())
	recipient = LineEdit.new(); recipient.placeholder_text = "Кому: имя персонажа"; recipient.max_length = 16; add_child(recipient); recipient.hide()
	row = HBoxContainer.new(); row.add_theme_constant_override("separation", 3); add_child(row)
	channel = OptionButton.new()
	for title in ["Мир", "Рядом", "Торг", "ЛС"]: channel.add_item(title)
	channel.add_theme_font_size_override("font_size", 12); row.add_child(channel)
	channel.item_selected.connect(func(i): select_channel(["all", "near", "trade", "pm"][i]))
	input = LineEdit.new(); input.placeholder_text = "Enter — чат"; input.max_length = 180; input.size_flags_horizontal = Control.SIZE_EXPAND_FILL; row.add_child(input)
	input.text_submitted.connect(func(_text): submit())
	var send = Button.new(); send.text = "→"; send.tooltip_text = "Отправить"; row.add_child(send); send.pressed.connect(submit)
	input.gui_input.connect(func(event):
		if event is InputEventKey and event.pressed and event.keycode == KEY_ESCAPE: input.release_focus(); input.accept_event())
	select_channel("all")

func submit():
	if input.text.strip_edges().is_empty(): return
	if channel.selected == 3 and recipient.text.strip_edges().is_empty() and not input.text.begins_with("/"):
		recipient.grab_focus(); return
	submitted.emit(input.text); input.clear(); input.release_focus()

func select_channel(key: String):
	active = key; unread[key] = 0
	channel.select(["all", "near", "trade", "pm"].find(key)); recipient.visible = key == "pm"
	_redraw()

func accepts(entry: Dictionary) -> bool:
	if entry.ch == "sys": return active == "all" and preferences.sys
	if active == "all":
		return entry.ch == "all" or (entry.ch in ["trade", "near"] and preferences[entry.ch])
	return entry.ch == active

func add_message(entry: Dictionary):
	history.append(entry)
	if history.size() > 250: history.pop_front()
	if entry.ch in unread and entry.ch != active: unread[entry.ch] += 1
	_redraw()

func set_preference(key: String, value):
	preferences[key] = value
	if not Network.test_mode:
		var config = ConfigFile.new()
		for name in preferences: config.set_value("chat", name, preferences[name])
		config.save("user://interface.cfg")
	_redraw()

func _redraw():
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

func clear_history():
	history.clear(); recipient.clear()
	for key in unread: unread[key] = 0
	_redraw()
