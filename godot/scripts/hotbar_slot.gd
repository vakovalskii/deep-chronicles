extends Button
signal swap_requested(from: int, to: int)
var index = 0
var locked = true

func _get_drag_data(_position):
	if locked: return null
	var preview = Label.new(); preview.text = tooltip_text.split("\n")[0]; set_drag_preview(preview)
	return {"hotbar_slot": index}

func _can_drop_data(_position, data):
	return not locked and data is Dictionary and data.has("hotbar_slot")

func _drop_data(_position, data):
	swap_requested.emit(int(data.hotbar_slot), index)
