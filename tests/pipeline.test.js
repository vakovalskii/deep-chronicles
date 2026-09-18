import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { digest, snapshotInputs, validateRelease, releaseSteps } from '../tools/godot/release-contract.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'native-release-contract-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (file, content) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), content); };
  execFileSync('git', ['init', '-q'], { cwd: root });
  write('.gitignore', 'dist/\nserver/data/\n');
  write('src/data.js', 'export const v = 1;'); write('server/server.js', 'server'); write('godot/scripts/main.gd', 'extends Node');
  const manifest = { commit: 'test', files: {} }, outputs = {};
  for (const target of ['windows', 'macos']) {
    const file = `dist/downloads/khroniki-glubin-${target}.zip`; write(file, 'PK fixture');
    outputs[file] = digest(root, file);
    manifest.files[target] = { url: file.slice(4), bytes: 10, sha256: outputs[file] };
  }
  write('dist/release.json', JSON.stringify(manifest)); outputs['dist/release.json'] = digest(root, 'dist/release.json');
  const report = { ok: true, commit: 'test', steps: releaseSteps.map(name => ({ name, ok: true })), inputs: snapshotInputs(root), outputs };
  return { root, write, report };
}
test('release accepts unchanged tested inputs and downloads', t => {
  const { root, report } = fixture(t); assert.doesNotThrow(() => validateRelease(root, report));
});
test('release rejects a new Godot source, even outside uploaded server directories', t => {
  const { root, report, write } = fixture(t); write('godot/scripts/untested.gd', 'extends Node');
  assert.throws(() => validateRelease(root, report), /file set changed/);
});
test('release rejects changed and removed source files', t => {
  const { root, report, write } = fixture(t); write('src/data.js', 'changed');
  assert.throws(() => validateRelease(root, report), /Changed after/);
  fs.rmSync(path.join(root, 'src/data.js')); assert.throws(() => validateRelease(root, report), /file set changed/);
});
test('release rejects replaced downloads and incomplete verification', t => {
  const { root, report, write } = fixture(t);
  assert.throws(() => validateRelease(root, { ...report, steps: report.steps.slice(1) }), /complete passing/);
  write('dist/downloads/khroniki-glubin-windows.zip', 'other'); assert.throws(() => validateRelease(root, report), /Changed after/);
});
test('release rejects a manifest with the wrong commit or hash even if included in the report', t => {
  const { root, report, write } = fixture(t);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'dist/release.json')));
  manifest.commit = 'different'; write('dist/release.json', JSON.stringify(manifest)); report.outputs['dist/release.json'] = digest(root, 'dist/release.json');
  assert.throws(() => validateRelease(root, report), /commit differ/);
  manifest.commit = 'test'; manifest.files.windows.sha256 = 'bad'; write('dist/release.json', JSON.stringify(manifest)); report.outputs['dist/release.json'] = digest(root, 'dist/release.json');
  assert.throws(() => validateRelease(root, report), /manifest mismatch/);
});
test('local player databases and unrelated art experiments are not release inputs', t => {
  const { root, report, write } = fixture(t); write('server/data/world.db', 'local'); write('tools/trellis/texture.py', 'user changes');
  assert.doesNotThrow(() => validateRelease(root, report));
});
