extends Node3D
## Server-owned reward. Visuals never credit inventory or create local rewards.
var data: Dictionary = {}
var label: Label3D
var body: Node3D
var age = 0.0

func setup(entry: Dictionary):
	data = entry.duplicate()
	position = GameData.position_at(entry.x, entry.z)
	body = Node3D.new(); add_child(body)
	var mat = StandardMaterial3D.new(); mat.albedo_color = Color("d5ad51"); mat.metallic = 0.8; mat.roughness = 0.32
	if entry.item == "coins":
		for i in 9:
			var coin = MeshInstance3D.new(); var mesh = CylinderMesh.new()
			mesh.top_radius = 0.13; mesh.bottom_radius = 0.13; mesh.height = 0.035; mesh.radial_segments = 16
			coin.mesh = mesh; coin.material_override = mat
			coin.position = Vector3(sin(i * 2.4) * 0.21, 0.05 + (i % 3) * 0.045, cos(i * 2.4) * 0.21)
			coin.rotation.z = sin(i) * 0.22; body.add_child(coin)
	else:
		# A textured inventory token above a leather satchel makes small drops readable.
		var pouch = MeshInstance3D.new(); var mesh = SphereMesh.new(); mesh.radius = 0.26; mesh.height = 0.38
		pouch.mesh = mesh; pouch.position.y = 0.19
		var leather = StandardMaterial3D.new(); leather.albedo_color = Color("86623e"); leather.roughness = 0.95
		leather.albedo_texture = load("res://generated/tex/leather.png"); pouch.material_override = leather; body.add_child(pouch)
		var icon = Sprite3D.new(); icon.texture = GameData.icon(entry.item); icon.pixel_size = 0.012
		icon.billboard = BaseMaterial3D.BILLBOARD_ENABLED; icon.position.y = 0.65; body.add_child(icon)
	var ring = MeshInstance3D.new(); var ring_mesh = TorusMesh.new(); ring_mesh.inner_radius = 0.36; ring_mesh.outer_radius = 0.39; ring_mesh.rings = 24; ring_mesh.ring_segments = 6
	ring.mesh = ring_mesh; ring.position.y = 0.04
	var glow = StandardMaterial3D.new(); glow.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; glow.albedo_color = Color("c9b16c")
	glow.emission_enabled = true; glow.emission = Color("90733d"); ring.material_override = glow; add_child(ring)
	label = Label3D.new(); label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.font_size = 32; label.pixel_size = 0.018; label.outline_size = 7; label.no_depth_test = false
	label.position.y = 1.0 if entry.item == "coins" else 1.45; add_child(label)
	refresh(entry)

func refresh(entry: Dictionary):
	data = entry
	var title = "Монеты" if data.item == "coins" else str(GameData.catalog.ITEMS[data.item].name)
	label.text = "%s ×%s" % [title, int(data.n)]
	if not data.available: label.text += "\n" + data.ownerName
	label.modulate = Color("f6dc8b") if data.available else Color("a6a39b")

func _process(dt):
	age += dt
	if is_instance_valid(body): body.position.y = maxf(0, sin(minf(age / 0.55, 1) * PI) * 0.9)
