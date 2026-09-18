extends Node
signal message(data: Dictionary)
signal status_changed(text: String)
signal connected
var socket: WebSocketPeer
var endpoint = "wss://realms.neuraldeep.ru/ws"
var online = false
var authed = false
var retry_at = 0
var retry_delay = 1000
var stopped = false
var session: Dictionary = {}
var sessions: Dictionary = {}
var online_count = 0
var connecting_at = 0
var test_mode = false
var last_packet_at = 0

func _ready():
	process_mode = Node.PROCESS_MODE_ALWAYS
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--server="): endpoint = a.trim_prefix("--server=")
		if a == "--test-mode": test_mode = true
	if not test_mode and FileAccess.file_exists("user://sessions.json"):
		var saved = JSON.parse_string(FileAccess.get_file_as_string("user://sessions.json"))
		if saved is Dictionary: sessions = saved
	elif not test_mode and FileAccess.file_exists("user://session.json"):
		var saved = JSON.parse_string(FileAccess.get_file_as_string("user://session.json"))
		if saved is Dictionary and saved.has("endpoint"): sessions[saved.endpoint] = saved
	session = sessions.get(endpoint, {})

func start(url = ""):
	if not url.is_empty():
		if not url.begins_with("ws://") and not url.begins_with("wss://"):
			status_changed.emit("Адрес сервера должен начинаться с ws:// или wss://"); return
		endpoint = url
	session = sessions.get(endpoint, {})
	if socket: socket.close()
	online = false; authed = false; stopped = false; online_count = 0
	connecting_at = Time.get_ticks_msec(); retry_at = 0
	socket = WebSocketPeer.new()
	socket.inbound_buffer_size = 1048576
	var error = socket.connect_to_url(endpoint)
	status_changed.emit("Подключение…")
	if error != OK: _disconnected()

func _process(_dt):
	if stopped: return
	if socket == null:
		if retry_at > 0 and Time.get_ticks_msec() >= retry_at: start()
		return
	socket.poll()
	var state = socket.get_ready_state()
	if state == WebSocketPeer.STATE_OPEN:
		if not online:
			online = true; retry_delay = 1000; last_packet_at = Time.get_ticks_msec()
			status_changed.emit("Подключено · %s" % endpoint); connected.emit()
		while socket.get_available_packet_count() > 0:
			var data = JSON.parse_string(socket.get_packet().get_string_from_utf8())
			if not data is Dictionary: continue
			last_packet_at = Time.get_ticks_msec()
			if data.get("t") == "authok":
				authed = true
				if data.has("token"):
					session = {"endpoint": endpoint, "name": data.name, "token": data.token}
					sessions[endpoint] = session; _save_sessions()
			if data.get("t") in ["hi", "authok"]: online_count = int(data.get("online", 0))
			if data.get("t") == "online": online_count = int(data.n)
			if data.get("t") == "autherr" and data.get("kind") == "auth": forget_session()
			if data.get("t") == "kicked": stopped = true; authed = false
			message.emit(data)
		if authed and Time.get_ticks_msec() - last_packet_at > 35000: socket.close()
	elif state == WebSocketPeer.STATE_CLOSED: _disconnected()
	elif state == WebSocketPeer.STATE_CONNECTING and Time.get_ticks_msec() - connecting_at > 15000:
		socket.close(); _disconnected()

func _disconnected():
	socket = null; online = false; authed = false
	retry_at = Time.get_ticks_msec() + retry_delay
	retry_delay = mini(15000, retry_delay * 2)
	status_changed.emit("Связь потеряна. Переподключение…")

func send(data: Dictionary):
	if online and socket != null and socket.get_ready_state() == WebSocketPeer.STATE_OPEN:
		socket.send_text(JSON.stringify(data))

func resume_session() -> bool:
	if session.get("endpoint") == endpoint and session.has("token"):
		send({"t": "auth", "token": session.token}); return true
	return false

func logout():
	if session.has("token"): send({"t": "logout", "token": session.token})
	forget_session()
	authed = false

func forget_session():
	sessions.erase(endpoint); session = {}; _save_sessions()

func _save_sessions():
	if test_mode: return
	var file = FileAccess.open("user://sessions.json", FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify(sessions)); file.close()
		DirAccess.remove_absolute("user://session.json")

func _notification(what):
	if what == NOTIFICATION_APPLICATION_RESUMED and not stopped:
		if socket and Time.get_ticks_msec() - last_packet_at > 10000: start()
