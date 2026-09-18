extends Node
## Read-only probe through the actual game transport, including its heartbeat.
var deadline = 0
var require_loot = false
var require_native = false
var require_party = false
var seconds = 0
var greeting: Dictionary = {}
var opened_at = 0
var initial_reconnects = 0
var pongs = 0
var finished = false

func _ready():
	for arg in OS.get_cmdline_user_args():
		if arg == "--require-party": require_party = true
		if arg == "--require-native": require_native = true
		if arg == "--require-loot": require_loot = true
		if arg.begins_with("--seconds="): seconds = clampi(int(arg.trim_prefix("--seconds=")), 0, 300)
	deadline = Time.get_ticks_msec() + 15000
	initial_reconnects = Network.reconnect_count
	Network.message.connect(_message)
	Network.start()

func _message(message: Dictionary):
	if message.get("t") == "pong": pongs += 1
	if message.get("t") != "hi": return
	greeting = message; opened_at = Time.get_ticks_msec(); deadline = opened_at + (seconds + 5) * 1000
	if require_party and message.get("features", {}).get("party", 0) < 1: _fail("Server has no party support")
	if require_loot and message.get("features", {}).get("groundLoot", 0) < 1: _fail("Server has no ground-loot support")
	if require_native and (message.get("features", {}).get("progression", 0) < 1 or message.get("features", {}).get("nativeOnly", 0) < 1): _fail("Server has no native progression support")

func _process(_dt):
	if finished: return
	if Network.reconnect_count != initial_reconnects:
		_fail("Connection interrupted: " + JSON.stringify(Network.last_disconnect)); return
	if not greeting.is_empty() and Time.get_ticks_msec() - opened_at >= seconds * 1000:
		if seconds >= 15 and Network.heartbeat_supported and pongs < 1: _fail("No heartbeat reply"); return
		print("SERVER_PROBE_OK ", JSON.stringify({"endpoint": Network.endpoint, "online": greeting.get("online", 0), "features": greeting.get("features", {}), "tls": Network.endpoint.begins_with("wss://"), "stable_seconds": seconds, "reconnects": 0, "pongs": pongs}))
		finished = true; Network.stopped = true
		if Network.socket: Network.socket.close()
		get_tree().quit(0); return
	if Time.get_ticks_msec() > deadline: _fail("No stable server connection")

func _fail(reason: String):
	finished = true; push_error("SERVER_PROBE_FAILED " + reason); get_tree().quit(1)
