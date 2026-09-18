extends Node
## Read-only native TLS/protocol probe. Never logs in or changes game data.
var socket = WebSocketPeer.new()
var deadline = 0
var require_loot = false
var require_native = false
var endpoint = "wss://realms.neuraldeep.ru/ws"
var seconds = 0
var greeting: Dictionary = {}
var opened_at = 0
func _ready():
	for arg in OS.get_cmdline_user_args():
		if arg == "--require-native": require_native = true
		if arg == "--require-loot": require_loot = true
		if arg.begins_with("--server="): endpoint = arg.trim_prefix("--server=")
		if arg.begins_with("--seconds="): seconds = clampi(int(arg.trim_prefix("--seconds=")), 0, 300)
	deadline = Time.get_ticks_msec() + 15000
	if socket.connect_to_url(endpoint) != OK: _fail("connect_to_url failed")
func _process(_dt):
	socket.poll()
	if socket.get_ready_state() == WebSocketPeer.STATE_OPEN:
		if opened_at == 0: opened_at = Time.get_ticks_msec()
		while socket.get_available_packet_count() > 0:
			var message = JSON.parse_string(socket.get_packet().get_string_from_utf8())
			if message is Dictionary and message.get("t") == "hi":
				if require_loot and message.get("features", {}).get("groundLoot", 0) < 1: _fail("Server has no ground-loot support"); return
				if require_native and (message.get("features", {}).get("progression", 0) < 1 or message.get("features", {}).get("nativeOnly", 0) < 1): _fail("Server has no native progression support"); return
				greeting = message; deadline = Time.get_ticks_msec() + (seconds + 5) * 1000
		if not greeting.is_empty() and Time.get_ticks_msec() - opened_at >= seconds * 1000:
			print("SERVER_PROBE_OK ", JSON.stringify({"endpoint": endpoint, "online": greeting.get("online", 0), "protocol": "hi", "features": greeting.get("features", {}), "tls": endpoint.begins_with("wss://"), "stable_seconds": seconds}))
			socket.close(); get_tree().quit(0); return
	if Time.get_ticks_msec() > deadline or socket.get_ready_state() == WebSocketPeer.STATE_CLOSED: _fail("No stable server connection; close code %s" % socket.get_close_code())
func _fail(reason: String):
	push_error("SERVER_PROBE_FAILED " + reason); get_tree().quit(1)
