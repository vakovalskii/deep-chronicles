// Install the pinned official engine + desktop templates without machine-specific paths.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { spawnSync } from 'node:child_process';
import { root, run } from './runtime.mjs';
const lock = JSON.parse(fs.readFileSync(path.join(root, 'tools/godot/toolchain.json')));
const suffix = { darwin: 'macos.universal.zip', win32: 'win64.exe.zip', linux: 'linux.x86_64.zip' }[process.platform];
if (!suffix || (process.platform !== 'darwin' && process.arch !== 'x64')) throw Error('Bootstrap supports macOS universal, Windows x64 and Linux x64');
const cache = path.join(root, '.native-run/toolchain'); fs.mkdirSync(cache, { recursive: true });
async function sha(file) { const h = crypto.createHash('sha512'); for await (const chunk of fs.createReadStream(file)) h.update(chunk); return h.digest('hex'); }
async function download(name) {
  const file = path.join(cache, name), expected = lock.files[name];
  if (!expected) throw Error('Toolchain checksum missing');
  if (!fs.existsSync(file) || await sha(file) !== expected) {
    console.log(`Download ${name}`);
    const response = await fetch(lock.release + name, { signal: AbortSignal.timeout(600000) });
    if (!response.ok) throw Error(`Download failed: HTTP ${response.status}`);
    await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(file + '.part'));
    if (await sha(file + '.part') !== expected) throw Error(`Checksum mismatch: ${name}`);
    fs.renameSync(file + '.part', file);
  }
  return file;
}
const python = ['python3', 'python'].find(cmd => spawnSync(cmd, ['--version'], { stdio: 'ignore' }).status === 0);
if (!python) throw Error('Python 3 is required to extract archives');
const engine = await download(`Godot_v${lock.version}-stable_${suffix}`);
if (process.platform === 'darwin') await run('ditto', ['-x', '-k', engine, cache]);
else await run(python, ['-m', 'zipfile', '-e', engine, cache]);
const binary = path.join(cache, process.platform === 'darwin' ? 'Godot.app/Contents/MacOS/Godot' : `Godot_v${lock.version}-stable_${process.platform === 'win32' ? 'win64_console.exe' : 'linux.x86_64'}`);
if (process.platform !== 'win32') fs.chmodSync(binary, 0o755);
const data = process.platform === 'darwin' ? path.join(os.homedir(), 'Library/Application Support/Godot') : process.platform === 'win32' ? path.join(process.env.APPDATA, 'Godot') : path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local/share'), 'godot');
const templates = await download(`Godot_v${lock.version}-stable_export_templates.tpz`);
await run(python, ['-c', `import zipfile,sys,os
with zipfile.ZipFile(sys.argv[1]) as z:
 for name in z.namelist():
  base=os.path.basename(name)
  if base in ('macos.zip','version.txt','icudt_godot.dat') or base.startswith(('windows_debug_x86_64','windows_release_x86_64','linux_debug.x86_64','linux_release.x86_64')):
   os.makedirs(sys.argv[2],exist_ok=True)
   with open(os.path.join(sys.argv[2],base),'wb') as f:f.write(z.read(name))
`, templates, path.join(data, 'export_templates', `${lock.version}.stable`)]);
await run(binary, ['--headless', '--version']);
if (process.env.GITHUB_ENV) fs.appendFileSync(process.env.GITHUB_ENV, `GODOT_BIN=${binary}\n`);
fs.writeFileSync(path.join(cache, 'binary.txt'), binary + '\n');
console.log(`GODOT_BIN=${binary}`);
