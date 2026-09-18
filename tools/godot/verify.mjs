// Repeatable client/server acceptance pipeline. Production is only probed;
// gameplay uses the actual Node server with its own temporary SQLite database.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { godotBinary, root } from './runtime.mjs';
const args = process.argv.slice(2);
const target = args.find(a => a.startsWith('--build='))?.slice(8);
const directory = path.join(root, '.native-run', 'verification');
fs.mkdirSync(directory, { recursive: true });
const capture = (cmd, argv) => spawnSync(cmd, argv, { cwd: root, encoding: 'utf8' }).stdout?.trim();
const report = {
  started: new Date().toISOString(), commit: capture('git', ['rev-parse', 'HEAD']),
  dirty: Boolean(capture('git', ['status', '--porcelain'])), node: process.version,
  godot: capture(godotBinary(), ['--version']), platform: process.platform, arch: process.arch,
  target: target || null, rendered: !args.includes('--headless'), steps: [], inputs: {}, outputs: {},
};
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
const inputFiles = capture('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--', '.nvmrc', 'package.json', 'package-lock.json', 'godot/project.godot', 'godot/export_presets.cfg', 'godot/scripts', 'godot/scenes', 'godot/resources', 'godot/shaders', 'godot/assets', 'godot/tests', 'tools/godot', 'deploy', 'tests', 'src', 'server', 'public/assets'])?.split('\n') || [];
for (const file of new Set(inputFiles)) if (file && fs.existsSync(path.join(root, file))) report.inputs[file] = digest(file);
function save() { fs.writeFileSync(path.join(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n'); }
async function step(name, command, argv, timeout = 300000) {
  console.log(`\n[${name}]`);
  const started = Date.now(); let output = '';
  const child = spawn(command, argv, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { output += chunk; process.stdout.write(chunk); });
  const code = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill('SIGTERM'); reject(new Error(`${name} timed out`)); }, timeout);
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('exit', code => { clearTimeout(timer); resolve(code); });
  });
  fs.writeFileSync(path.join(directory, `${name}.log`), output);
  const ok = code === 0 && !/SCRIPT ERROR:|^ERROR:|FAIL:/m.test(output);
  report.steps.push({ name, command, args: argv, ok, seconds: (Date.now() - started) / 1000 }); save();
  if (!ok) throw new Error(`Failed: ${name}; see .native-run/verification/${name}.log`);
}
try {
  if (!report.godot?.startsWith('4.7.2.stable')) throw new Error('Pipeline requires Godot 4.7.2 stable and matching export templates.');
  if (!process.version.startsWith('v22.')) throw new Error('Pipeline requires Node.js 22; see .nvmrc.');
  if (target && !['macos', 'windows', 'android', 'ios'].includes(target)) throw new Error('Build target must be macos, windows, android, or ios.');
  await step('rules', process.execPath, ['--test', 'tests/unit.test.js']);
  await step('server', process.execPath, ['--no-warnings', '--test', 'tests/server.test.js']);
  await step('client-server', process.execPath, ['tools/godot/test.mjs', ...(args.includes('--headless') ? ['--headless'] : []), ...(args.includes('--touch') ? ['--touch'] : [])]);
  for (const file of ['godot/generated/catalog.json', 'godot/generated/world.json', 'godot/generated/heights.bin']) report.outputs[file] = digest(file);
  await step('weapons', godotBinary(), [...(args.includes('--headless') ? ['--headless'] : []), '--path', 'godot', '--script', 'res://tests/weapons.gd', '--', '--test-mode', `--output=${directory}/weapons.png`]);
  if (!args.includes('--offline')) await step('main-server', process.execPath, ['tools/godot/probe.mjs']);
  if (args.includes('--web')) {
    await step('web-build', process.execPath, ['node_modules/vite/bin/vite.js', 'build']);
    await step('web-browser', process.execPath, ['tests/e2e.mjs'], 600000);
    for (const file of fs.readdirSync(path.join(root, 'dist'), { recursive: true })) {
      const name = `dist/${file}`;
      if (fs.statSync(path.join(root, name)).isFile()) report.outputs[name] = digest(name);
    }
  }
  if (target) {
    await step(`build-${target}`, process.execPath, ['tools/godot/build.mjs', target, ...(args.includes('--debug') ? ['--debug'] : [])]);
    const files = { macos: 'macos/Хроники Глубин.zip', windows: 'windows/Хроники Глубин.exe', android: 'android/khroniki-glubin.apk', ios: 'ios/khroniki-glubin.zip' };
    const file = `godot/builds/${files[target]}`; report.outputs[file] = digest(file);
  }
  report.ok = true;
} catch (error) {
  report.ok = false; report.error = error.message; process.exitCode = 1; console.error(error.message);
} finally { report.finished = new Date().toISOString(); save(); console.log('Report: .native-run/verification/report.json'); }
