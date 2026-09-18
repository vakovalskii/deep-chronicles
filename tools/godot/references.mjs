// Download visual research separately from shipped game assets.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { root } from './runtime.mjs';
const entries = JSON.parse(await fs.readFile(path.join(root, 'docs/references/lineage-c4.json'), 'utf8'));
const output = path.join(root, '.native-run/references'); await fs.mkdir(output, { recursive: true });
const report = [];
for (const entry of entries) {
  const response = await fetch(entry.image, { signal: AbortSignal.timeout(30000) });
  if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error(`Reference unavailable: ${entry.id} (${response.status})`);
  const data = Buffer.from(await response.arrayBuffer());
  const sha256 = crypto.createHash('sha256').update(data).digest('hex');
  if (entry.sha256 && sha256 !== entry.sha256) throw new Error(`Reference changed: ${entry.id}`);
  await fs.writeFile(path.join(output, entry.file), data);
  report.push({ ...entry, sha256, bytes: data.length }); console.log(`${entry.id}: ${data.length} bytes`);
}
await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify(report, null, 2) + '\n');
