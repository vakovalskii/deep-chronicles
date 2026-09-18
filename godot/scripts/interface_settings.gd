extends RefCounted
## Merge sections so chat, minimap and action bar never overwrite each other.
static var test_values: Dictionary = {}

static func read_value(section: String, key: String, fallback):
	if "--test-mode" in OS.get_cmdline_user_args(): return test_values.get(section + "/" + key, fallback)
	var config = ConfigFile.new()
	config.load("user://interface.cfg")
	return config.get_value(section, key, fallback)

static func write_value(section: String, key: String, value):
	if "--test-mode" in OS.get_cmdline_user_args():
		test_values[section + "/" + key] = value; return
	var config = ConfigFile.new()
	config.load("user://interface.cfg")
	config.set_value(section, key, value)
	config.save("user://interface.cfg")
