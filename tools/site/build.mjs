import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { root } from '../godot/runtime.mjs';
const source = { windows: 'godot/builds/windows/khroniki-glubin-windows.zip', macos: 'godot/builds/macos/Хроники Глубин.zip' };
for (const file of Object.values(source)) if (!fs.existsSync(path.join(root,file))) throw Error(`Missing ${file}; build both native targets first`);
const output = path.join(root, 'dist');
fs.rmSync(output, { recursive: true, force: true }); fs.mkdirSync(path.join(output,'downloads'), { recursive: true });
for (const file of ['index.html','style.css','site.js']) fs.copyFileSync(path.join(root,'site',file),path.join(output,file));
const release = { commit: execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(), files: {} };
for (const [target,file] of Object.entries(source)) {
  const url = `downloads/khroniki-glubin-${target}.zip`, bytes = fs.readFileSync(path.join(root,file));
  fs.writeFileSync(path.join(output,url),bytes);
  release.files[target] = { url:`/${url}`, bytes:bytes.length, sha256:crypto.createHash('sha256').update(bytes).digest('hex') };
}
fs.writeFileSync(path.join(output,'release.json'),JSON.stringify(release,null,2)+'\n');
console.log('NATIVE_SITE_BUILT (no browser game)');
