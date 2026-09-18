extends Control
## Capture the entire drag, including movement outside the chat rectangle.
signal dragged(delta_y: float)
signal finished
var dragging = false
var last_y = 0.0
var touch_index = -1

func _ready():
	custom_minimum_size.y = 12
	mouse_default_cursor_shape = Control.CURSOR_VSIZE
	mouse_filter = Control.MOUSE_FILTER_STOP
	mouse_force_pass_scroll_events = false
	tooltip_text = "Потяните вверх или вниз, чтобы изменить высоту этой области"

func _draw():
	var c = Color("a99c7e") if dragging else Color(0.66, 0.61, 0.49, 0.65)
	for y in [4, 7]: draw_line(Vector2(size.x * 0.5 - 18, y), Vector2(size.x * 0.5 + 18, y), c)

func _gui_input(event):
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
		dragging = true; last_y = global_position.y + event.position.y; touch_index = -1; accept_event(); queue_redraw()
	elif event is InputEventScreenTouch and event.pressed:
		dragging = true; last_y = global_position.y + event.position.y; touch_index = event.index; accept_event(); queue_redraw()

func _input(event):
	if not dragging: return
	if event is InputEventMouseMotion and touch_index == -1:
		dragged.emit(last_y - event.position.y); last_y = event.position.y
	elif event is InputEventScreenDrag and event.index == touch_index:
		dragged.emit(last_y - event.position.y); last_y = event.position.y
	elif (event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and not event.pressed and touch_index == -1) or (event is InputEventScreenTouch and not event.pressed and event.index == touch_index):
		dragging = false; finished.emit(); queue_redraw()
	get_viewport().set_input_as_handled()

func _notification(what):
	if what == NOTIFICATION_APPLICATION_FOCUS_OUT and dragging:
		dragging = false; finished.emit(); queue_redraw()
