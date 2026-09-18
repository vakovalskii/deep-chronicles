extends Node3D
## Positional voices are bounded; persistent sliders use the existing merged config.
const Settings = preload("res://scripts/interface_settings.gd")
const SOUND_IDS = ["swing", "impact", "critical", "charge", "fire", "frost", "heal", "buff", "step", "death", "loot", "level", "wind", "town", "forest", "crypt", "waste", "step_stone", "step_earth"]
const MAX_VOICES = 24
var streams: Dictionary = {}
var voices: Array = []
var last_played: Dictionary = {}
var play_counts: Dictionary = {}
var listener: AudioListener3D
var ambience: AudioStreamPlayer
var step_timer = 0.0
var ambience_layers: Dictionary = {}
var ambience_gains: Dictionary = {}
var ambience_id = "wind"

func _ready():
	name = "GameAudio"
	for bus in ["Effects", "Ambience"]:
		if AudioServer.get_bus_index(bus) < 0:
			AudioServer.add_bus(); AudioServer.set_bus_name(AudioServer.bus_count - 1, bus)
		set_volume(bus, float(Settings.read_value("audio", bus, 0.65 if bus == "Effects" else 0.3)), false)
	set_volume("Master", float(Settings.read_value("audio", "Master", 0.75)), false)
	for id in SOUND_IDS: streams[id] = load("res://assets/audio/%s.wav" % id)
	listener = AudioListener3D.new(); add_child(listener)
	for id in ["wind", "town", "forest", "crypt", "waste"]:
		var layer = AudioStreamPlayer.new(); layer.bus = "Ambience"; layer.volume_db = -60
		var loop = streams[id].duplicate(); loop.loop_mode = AudioStreamWAV.LOOP_FORWARD
		loop.loop_begin = 0; loop.loop_end = int(loop.mix_rate * loop.get_length())
		layer.stream = loop; add_child(layer); ambience_layers[id] = layer; ambience_gains[id] = 0.0
	ambience = ambience_layers.wind
	for i in MAX_VOICES:
		var voice = AudioStreamPlayer3D.new(); voice.bus = "Effects"; voice.max_distance = 55; voice.unit_size = 7
		voice.max_db = -3; voice.attenuation_filter_cutoff_hz = 9000; add_child(voice); voices.append(voice)

func set_volume(bus: String, value: float, persist = true):
	var index = AudioServer.get_bus_index(bus)
	if index < 0: return
	value = clampf(value, 0, 1)
	AudioServer.set_bus_mute(index, value <= 0)
	AudioServer.set_bus_volume_db(index, linear_to_db(maxf(value, 0.0001)))
	if persist: Settings.write_value("audio", bus, value)

func follow(hero, camera, dt: float):
	if not is_instance_valid(hero) or not hero.visible:
		clear(); return
	listener.global_position = hero.global_position + Vector3.UP * 1.7
	listener.global_rotation = camera.global_rotation; listener.make_current()
	var zone = GameData.zone_at(hero.global_position)
	ambience_id = "town" if zone.get("town", false) else str(zone.id)
	if not ambience_layers.has(ambience_id): ambience_id = "wind"
	ambience = ambience_layers[ambience_id]
	for id in ambience_layers:
		var layer = ambience_layers[id]
		var gain = move_toward(float(ambience_gains[id]), 1.0 if id == ambience_id else 0.0, dt * 0.7)
		ambience_gains[id] = gain
		layer.volume_db = linear_to_db(maxf(0.001, gain)) - 10
		if gain > 0 and not layer.playing: layer.play()
		elif gain <= 0: layer.stop()
	step_timer -= dt
	if hero.moving and not hero.dead and step_timer <= 0:
		play_at("step_stone" if zone.get("town", false) or zone.id == "crypt" else "step_earth", hero.global_position, -11); step_timer = 0.3

func play_at(id: String, pos: Vector3, gain_db = 0.0):
	if not streams.has(id) or not listener.is_current() or listener.global_position.distance_to(pos) > 55: return
	var now = Time.get_ticks_msec()
	if now - int(last_played.get(id, -1000)) < 55: return
	last_played[id] = now
	for voice in voices:
		if voice.playing: continue
		voice.stream = streams[id]; voice.global_position = pos; voice.volume_db = gain_db - 6
		voice.pitch_scale = randf_range(0.95, 1.05) if id in ["swing", "impact", "step", "step_stone", "step_earth"] else 1.0
		voice.play(); play_counts[id] = int(play_counts.get(id, 0)) + 1; return

func clear():
	for voice in voices: voice.stop()
	for id in ambience_layers:
		ambience_layers[id].stop(); ambience_gains[id] = 0.0
