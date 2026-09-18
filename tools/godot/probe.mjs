import { godotBinary, run } from './runtime.mjs';
await run(godotBinary(), ['--headless', '--path', 'godot', '--script', 'res://tests/server_probe.gd', '--', '--test-mode', ...process.argv.slice(2)]);
