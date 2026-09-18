extends Button
signal item_dropped(payload: Dictionary)
signal activated
var payload: Dictionary = {}
var slot_type = ""
var accept_equipped = false

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
