import path from 'node:path';
import { godotBinary, root, run } from './runtime.mjs';
const built = process.argv.includes('--built');
const binary = built ? path.join(root, process.platform === 'win32' ? 'godot/builds/windows/Хроники Глубин.exe' : 'godot/builds/macos/Хроники Глубин.app/Contents/MacOS/Хроники Глубин') : godotBinary();
await run(binary, ['--headless', ...(!built ? ['--path', 'godot'] : []), '--', '--test-mode', '--network-probe', ...process.argv.slice(2)]);
