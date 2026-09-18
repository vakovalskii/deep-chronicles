extends Control
var player_position = Vector3.ZERO
var compact = false
var mob_markers: Array = []
var player_markers: Array = []
var target_position = Vector3.INF
static var terrain_map: ImageTexture
var origin = Vector2(-800,-800)
var extent = Vector2(1600,1600)

func _ready():
	custom_minimum_size = Vector2(164, 124) if compact else Vector2(600, 410)
	mouse_filter = Control.MOUSE_FILTER_IGNORE; clip_contents = true
	if not terrain_map: _bake_terrain()

func _bake_terrain():
	var image = Image.create(400,400,false,Image.FORMAT_RGB8)
	for z in 400:
		for x in 400:
			var p = Vector3(x*4-800,0,z*4-800)
			var h = GameData.height_at(p.x,p.z)
			var zone = GameData.zone_at(p)
			var color = Color("677e48")
			match zone.id:
				"forest": color = Color("344e39")
				"waste": color = Color("aa9365")
				"harbor", "ford": color = Color("929073")
			var slope = GameData.height_at(p.x-3,p.z-3)-GameData.height_at(p.x+3,p.z+3)
			color *= clampf(.94+slope*.035,.6,1.18)
			color = color.lerp(Color("9d9b85"),smoothstep(35,65,h))
			color = color.lerp(Color("e2e1d1"),smoothstep(70,95,h))
			if h < -6.4: color = Color("52838e")
			if h > 12 and fmod(h,12)<.6: color *= .86
			image.set_pixel(x,z,color)
	terrain_map = ImageTexture.create_from_image(image)

func point(x: float, z: float) -> Vector2:
	return (Vector2(x,z)-origin)/extent*size

func update_entities(mobs: Dictionary, players: Dictionary, target):
	mob_markers.clear(); player_markers.clear()
	for actor in mobs.values():
		if actor.visible and not actor.dead and Time.get_ticks_msec() - actor.seen < 1500:
			mob_markers.append(actor.position)
	for actor in players.values():
		if actor.visible and not actor.dead and Time.get_ticks_msec() - actor.seen < 1500:
			player_markers.append({"pos": actor.position, "status": actor.status})
	target_position = target.position if is_instance_valid(target) and target.visible and not target.dead else Vector3.INF
	queue_redraw()

func _draw():
	origin = Vector2(player_position.x,player_position.z)-size if compact else Vector2(-800,-800)
	extent = size*2 if compact else Vector2(1600,1600)
	if not compact and player_position.x > 2100:
		var d = GameData.world.dungeon
		origin = Vector2(d.x0 - d.cell, d.z0 - d.cell); extent = Vector2.ONE * d.cell * (d.n + 2)
	draw_rect(Rect2(Vector2.ZERO,size),Color("182925"))
	if terrain_map and player_position.x < 2100:
		var source = Rect2((origin+Vector2(800,800))*.25,extent*.25)
		draw_texture_rect_region(terrain_map,Rect2(Vector2.ZERO,size),source)
	var font = ThemeDB.fallback_font
	for r in GameData.world.get("modelPlacements", []):
		if r[0] in ["oak","pine","bush","rock_a","rock_b","dead_tree"]: continue
		var p=point(r[1],r[3]);var sz=Vector2(r[5],r[7])/extent*size
		draw_rect(Rect2(p-sz*.5,sz),Color("463e32"));draw_rect(Rect2(p-sz*.4,sz*.8),Color("c5b085"))
	for t in GameData.world.towns:
		var p=point(t.x,t.z);var scale_map=size.x/extent.x
		draw_arc(p,t.r*scale_map,0,TAU,48,Color("d8cba6"),2,true)
		if not compact: draw_string(font,p+Vector2(10,-10),t.name,HORIZONTAL_ALIGNMENT_LEFT,-1,16,Color("fff0bb"))
	if player_position.x>2100:
		for row in GameData.world.shapes:
			if row[9]!="dbrick":continue
			var p=point(row[2],row[4]);var sz=Vector2(row[6],row[8])/extent*size
			draw_rect(Rect2(p-sz*.5,sz),Color("827087"))
	for n in GameData.world.npcs:
		if compact and n.role!="guard":draw_circle(point(n.x,n.z),3,Color("e9c471"))
	for t in GameData.world.teleports:
		draw_circle(point(t.x,t.z),2 if compact else 3,Color("98d9e6"))
	if not compact and player_position.x < 2100:
		for z in GameData.world.zones:
			var p=point(z.x,z.z)
			draw_string(font,p+Vector2(-50,0),z.name,HORIZONTAL_ALIGNMENT_LEFT,-1,15,Color("f6ebcd"))
			draw_string(font,p+Vector2(-50,20),"Уровни "+z.lv,HORIZONTAL_ALIGNMENT_LEFT,-1,13,Color("d8d5ba"))
	var crypt=point(150,250);draw_circle(crypt,4,Color("c899f4"))
	if not compact:draw_string(font,crypt+Vector2(10,4),"Катакомбы",HORIZONTAL_ALIGNMENT_LEFT,-1,14)
	for pos in mob_markers:
		var marker = point(pos.x, pos.z)
		draw_circle(marker, 3.5 if compact else 3, Color("311e1d"))
		draw_circle(marker, 2.5 if compact else 2, Color("ff7965"))
	for entry in player_markers:
		var marker = point(entry.pos.x, entry.pos.z)
		draw_circle(marker, 3, Color("ff5353") if entry.status == 2 else (Color("d99aff") if entry.status == 1 else Color("89bbff")))
	if target_position != Vector3.INF:
		draw_arc(point(target_position.x, target_position.z), 6, 0, TAU, 16, Color("ffe188"), 1.5, true)
	var player=point(player_position.x,player_position.z)
	draw_circle(player,7,Color("23352e"));draw_circle(player,4,Color("91ffe1"))
	if compact:draw_string(font,Vector2(size.x*.5-4,14),"С",HORIZONTAL_ALIGNMENT_LEFT,-1,12,Color("eee0b9"))
	elif player_position.x>2100:draw_string(font,Vector2(20,35),"Вы в катакомбах",HORIZONTAL_ALIGNMENT_LEFT,-1,22,Color("bf92ff"))
