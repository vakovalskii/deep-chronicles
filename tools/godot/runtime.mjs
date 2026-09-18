import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export function godotBinary() {
  const candidates = [process.env.GODOT_BIN, '/Applications/Godot.app/Contents/MacOS/Godot', path.join(os.homedir(), 'Applications/Godot.app/Contents/MacOS/Godot')].filter(Boolean);
  for (const file of candidates) if (fs.existsSync(file)) return file;
  for (const name of ['godot', 'godot4', 'Godot.exe']) if (spawnSync(name, ['--version'], { stdio: 'ignore' }).status === 0) return name;
  throw new Error('Godot 4.7.2 не найден. Установите Godot или задайте GODOT_BIN.');
}
export function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: 'inherit', ...options });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${command}: exit ${code}`)));
  });
}
