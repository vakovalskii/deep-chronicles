extends PanelContainer
## Small movable desktop window, with the same native controls on touch screens.
var dragging = false
var drag_offset = Vector2.ZERO
func drag_title(event: InputEvent):
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		dragging = event.pressed; drag_offset = get_global_mouse_position() - global_position
		accept_event()
func _process(_dt):
	if dragging:
		if not Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT): dragging = false; return
		var viewport = get_viewport_rect().size
		global_position = (get_global_mouse_position() - drag_offset).clamp(Vector2(4, 4), (viewport - size - Vector2(4, 4)).max(Vector2(4, 4)))
func _draw():
	draw_line(Vector2(2, 2), Vector2(size.x - 2, 2), Color("a89c78"))
	draw_line(Vector2(2, 2), Vector2(2, size.y - 2), Color("766f5c"))
	draw_line(Vector2(2, size.y - 2), size - Vector2(2, 2), Color("090b0e"))
