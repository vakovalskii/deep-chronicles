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
	var bronze = Color("a69772")
	var center = size.x * 0.5
	for sign_x in [-1, 1]:
		var points = PackedVector2Array([Vector2(center + sign_x * 35, 2), Vector2(center + sign_x * 15, 2), Vector2(center + sign_x * 7, 6), Vector2(center, 2)])
		draw_polyline(points, bronze, 1, true)
	draw_line(Vector2(9, 32), Vector2(size.x - 9, 32), Color(0.62, 0.55, 0.4, 0.4))
