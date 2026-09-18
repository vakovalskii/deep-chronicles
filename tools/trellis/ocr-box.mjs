// The shared GPU box belongs to production OCR. Never stop OCR for game art.
// node --env-file=.env tools/trellis/ocr-box.mjs --status|--restore|--smoke
import fs from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
const mode = process.argv[2] || '--status';
if (process.argv.length > 3 || !['--status', '--restore', '--smoke'].includes(mode)) throw Error('Use --status, --restore or --smoke');
if (!process.env.TRELLIS_SSH) throw Error('TRELLIS_SSH is required; the address must stay in .env');
const parsed = spawnSync('python3', ['-c', 'import sys,shlex,json; print(json.dumps(shlex.split(sys.stdin.read())))'], { input: process.env.TRELLIS_SSH, encoding: 'utf8' });
if (parsed.status !== 0) throw Error('Cannot parse SSH configuration');
const child = spawn('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', ...JSON.parse(parsed.stdout), `python3 -u - ${mode}`], { stdio: ['pipe', 'pipe', 'pipe'] });
child.stdin.end(fs.readFileSync(new URL('./ocr_box.py', import.meta.url)));
const safe = data => String(data).replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[host]');
child.stdout.on('data', data => process.stdout.write(safe(data)));
child.stderr.on('data', data => process.stderr.write(safe(data)));
child.on('error', () => { console.error('Cannot launch GPU SSH connection'); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code === 0 ? 0 : 1; });
