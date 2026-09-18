// Offline by default; restore byte-identical source maps from pinned public CC0 archives.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { root } from './runtime.mjs';
const bank = path.join(root, 'godot/assets/materials');
const manifest = JSON.parse(fs.readFileSync(path.join(bank, 'manifest.json')));
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
if (process.argv.includes('--fetch')) {
  const cache = path.join(root, '.native-run/material-sources'); fs.mkdirSync(cache, { recursive: true });
  for (const [key, source] of Object.entries(manifest.sources)) {
    const archive = path.join(cache, source.asset + '.zip');
    if (!fs.existsSync(archive) || sha(fs.readFileSync(archive)) !== source.sha256) {
      const result = spawnSync('curl', ['-fLsS', '--retry', '2', '--max-time', '120', '-A', 'Mozilla/5.0', source.url, '-o', archive], { stdio: 'inherit' });
      if (result.status !== 0) throw Error(`Download failed: ${key}`);
    }
    if (sha(fs.readFileSync(archive)) !== source.sha256) throw Error(`Source changed: ${key}`);
    for (const [file, entry] of Object.entries(manifest.files)) if (entry.source === key) {
      const result = spawnSync(process.platform === 'win32' ? 'python' : 'python3', ['-c', 'import zipfile,sys;sys.stdout.buffer.write(zipfile.ZipFile(sys.argv[1]).read(sys.argv[2]))', archive, entry.entry], { maxBuffer: 16 * 1024 * 1024 });
      if (result.status !== 0 || sha(result.stdout) !== entry.sha256) throw Error(`Extract failed: ${file}`);
      fs.writeFileSync(path.join(bank, file), result.stdout);
    }
  }
}
for (const [file, entry] of Object.entries(manifest.files)) {
  if (path.basename(file) !== file || !manifest.sources[entry.source]) throw Error('Invalid material manifest');
  if (sha(fs.readFileSync(path.join(bank, file))) !== entry.sha256) throw Error(`Material changed: ${file}`);
}
console.log(`MATERIALS_OK ${Object.keys(manifest.files).length} pinned CC0 maps, albedo + normal + roughness`);
