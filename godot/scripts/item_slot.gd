extends Button
signal item_dropped(payload: Dictionary)
signal activated
var payload: Dictionary = {}
var slot_type = ""
var accept_equipped = false

func _draw():
	if not payload.is_empty() or slot_type.is_empty(): return
	# Original small equipment silhouettes, drawn in the same 24 px grid.
	var tint = Color("555548")
	var origin = (size - Vector2(24, 24)) * 0.5
	draw_set_transform(origin)
	match slot_type:
		"ring":
			draw_arc(Vector2(12, 14), 7, 0, TAU, 20, tint, 2, true)
			draw_colored_polygon(PackedVector2Array([Vector2(9, 5), Vector2(12, 2), Vector2(15, 5), Vector2(12, 8)]), tint)
		"ear":
			draw_arc(Vector2(12, 14), 6, -1.5, 4.2, 20, tint, 2, true); draw_line(Vector2(12, 8), Vector2(12, 3), tint, 2, true)
		"neck":
			draw_polyline(PackedVector2Array([Vector2(4, 4), Vector2(6, 14), Vector2(12, 20), Vector2(18, 14), Vector2(20, 4)]), tint, 2, true)
			draw_circle(Vector2(12, 20), 3, tint)
		"head":
			draw_arc(Vector2(12, 12), 8, PI, TAU, 12, tint, 2, true)
			draw_polyline(PackedVector2Array([Vector2(4, 12), Vector2(5, 21), Vector2(10, 18), Vector2(10, 11), Vector2(14, 11), Vector2(14, 18), Vector2(19, 21), Vector2(20, 12)]), tint, 2, true)
		"armor":
			draw_polyline(PackedVector2Array([Vector2(9, 3), Vector2(3, 6), Vector2(5, 12), Vector2(8, 10), Vector2(7, 21), Vector2(17, 21), Vector2(16, 10), Vector2(19, 12), Vector2(21, 6), Vector2(15, 3)]), tint, 2, true)
		"legs":
			draw_polyline(PackedVector2Array([Vector2(6, 3), Vector2(18, 3), Vector2(19, 21), Vector2(14, 21), Vector2(12, 10), Vector2(10, 21), Vector2(5, 21), Vector2(6, 3)]), tint, 2, true)
		"feet":
			draw_polyline(PackedVector2Array([Vector2(8, 3), Vector2(16, 3), Vector2(15, 16), Vector2(21, 18), Vector2(21, 21), Vector2(5, 21), Vector2(8, 3)]), tint, 2, true)
		"shield":
			draw_polyline(PackedVector2Array([Vector2(4, 4), Vector2(12, 2), Vector2(20, 4), Vector2(19, 15), Vector2(12, 22), Vector2(5, 15), Vector2(4, 4)]), tint, 2, true)
		"gloves":
			draw_polyline(PackedVector2Array([Vector2(6, 20), Vector2(4, 11), Vector2(7, 9), Vector2(9, 13), Vector2(9, 3), Vector2(18, 4), Vector2(19, 13), Vector2(15, 21), Vector2(6, 20)]), tint, 2, true)
		"weapon":
			draw_line(Vector2(5, 21), Vector2(19, 3), tint, 3, true); draw_line(Vector2(5, 13), Vector2(13, 19), tint, 2, true)
	draw_set_transform(Vector2.ZERO)

func _get_drag_data(_at):
	if payload.is_empty(): return null
	var preview = TextureRect.new(); preview.texture = icon; preview.custom_minimum_size = Vector2(48, 48)
	preview.expand_mode = TextureRect.EXPAND_IGNORE_SIZE; set_drag_preview(preview)
	return payload

func _can_drop_data(_at, data):
	if not data is Dictionary or data.get("source") != "inventory": return false
	if accept_equipped: return data.has("slot")
	return data.has("idx") and GameData.catalog.ITEMS.get(data.get("id"), {}).get("slot") == slot_type

func _drop_data(_at, data):
	item_dropped.emit(data)

func _gui_input(event):
	if event is InputEventMouseButton and event.pressed and event.double_click: activated.emit(); accept_event()
