extends TextureRect
var skill_id = ""
var learned = false

func _get_drag_data(_position):
	if not learned: return null
	var preview = TextureRect.new(); preview.texture = texture
	preview.custom_minimum_size = Vector2(40, 40)
	preview.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	preview.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	set_drag_preview(preview)
	return {"skill_id": skill_id}
