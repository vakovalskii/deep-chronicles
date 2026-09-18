import { godotBinary, run } from './runtime.mjs';
await run(godotBinary(), ['--headless', '--path', 'godot', '--editor', '--import', '--quit']);
await run(godotBinary(), ['--path', 'godot', '--script', 'res://tests/weapons.gd', '--', '--test-mode', ...process.argv.slice(2)]);
