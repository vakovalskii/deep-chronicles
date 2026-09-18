extends SceneTree
## Read-only native TLS/protocol probe. Never logs in or changes game data.
var socket = WebSocketPeer.new()
var deadline = 0
var endpoint = "wss://realms.neuraldeep.ru/ws"
func _initialize():
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--server="): endpoint = arg.trim_prefix("--server=")
	deadline = Time.get_ticks_msec() + 15000
	if socket.connect_to_url(endpoint) != OK: _fail("connect_to_url failed")
func _process(_dt):
	socket.poll()
	if socket.get_ready_state() == WebSocketPeer.STATE_OPEN:
		while socket.get_available_packet_count() > 0:
			var message = JSON.parse_string(socket.get_packet().get_string_from_utf8())
			if message is Dictionary and message.get("t") == "hi":
				print("SERVER_PROBE_OK ", JSON.stringify({"endpoint": endpoint, "online": message.get("online", 0), "protocol": "hi", "tls": endpoint.begins_with("wss://")}))
				socket.close(); quit(0); return false
	if Time.get_ticks_msec() > deadline or socket.get_ready_state() == WebSocketPeer.STATE_CLOSED: _fail("No server greeting")
	return false
func _fail(reason: String):
	push_error("SERVER_PROBE_FAILED " + reason); quit(1)
