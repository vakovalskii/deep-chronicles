extends Control
signal changed(direction: Vector2)
var value = Vector2.ZERO
var finger = -1

func _ready():
	custom_minimum_size = Vector2(160, 160)
	mouse_filter = Control.MOUSE_FILTER_STOP

func _gui_input(event):
	if event is InputEventScreenTouch:
		if event.pressed and finger == -1: finger = event.index; _update(event.position)
		elif event.index == finger and not event.pressed: finger = -1; value = Vector2.ZERO; changed.emit(value); queue_redraw()
		accept_event()
	elif event is InputEventScreenDrag and event.index == finger:
		_update(event.position); accept_event()
	elif event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		if event.pressed: finger = -2; _update(event.position)
		else: finger = -1; value = Vector2.ZERO; changed.emit(value); queue_redraw()
		accept_event()
	elif event is InputEventMouseMotion and finger == -2: _update(event.position); accept_event()

func _update(p: Vector2):
	value = ((p - size / 2) / 58).limit_length(); changed.emit(value); queue_redraw()

func _draw():
	draw_circle(size / 2, 70, Color(0.07, 0.12, 0.14, 0.6))
	draw_arc(size / 2, 70, 0, TAU, 64, Color(0.76, 0.67, 0.43, 0.5), 2, true)
	draw_circle(size / 2 + value * 48, 26, Color(0.75, 0.7, 0.52, 0.7))
