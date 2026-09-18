// Only committed server code and its shared rules may enter the public snapshot.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { root, run } from '../godot/runtime.mjs';
const args = process.argv.slice(2);
for (const arg of args) if (!['--server', '--push'].includes(arg)) throw Error(`Unknown option: ${arg}; use --server [--push]`);
if (!args.includes('--server')) throw Error('Select --server explicitly. Whole-project OSS publication is retired. No files were published.');
const git = argv => execFileSync('git', argv, { cwd: root, encoding: 'utf8' });
const commit = git(['rev-parse', 'HEAD']).trim();
const tracked = git(['ls-tree', '-r', '--name-only', 'HEAD']).trim().split('\n');
const shared = ['data', 'stats', 'sim', 'progression', 'pvp', 'world-core', 'loot'].map(name => `src/${name}.js`);
const allow = ['LICENSE', '.nvmrc', 'tests/server.test.js', ...shared, ...tracked.filter(file => /^server\/(?:sim\/)?[a-z-]+\.js$/.test(file))];
const output = path.join(root, '.native-run/oss-server');
fs.rmSync(output, { recursive: true, force: true }); fs.mkdirSync(output, { recursive: true });
const write = (file, content) => { fs.mkdirSync(path.dirname(path.join(output, file)), { recursive: true }); fs.writeFileSync(path.join(output, file), content); };
for (const file of allow) {
  const content = git(['show', `${commit}:${file}`]);
  if (/-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----|\b(?:ghp_|gho_|github_pat_|sk-or-v1-)[A-Za-z0-9_\-]{20,}/.test(content)) throw Error(`Secret pattern in ${file}`);
  write(file, content);
}
const lock = JSON.parse(git(['show', `${commit}:package-lock.json`]));
const ws = lock.packages['node_modules/ws'].version;
write('package.json', JSON.stringify({ name: 'khroniki-glubin-server', private: true, type: 'module', license: 'AGPL-3.0-only', engines: { node: '22.x' }, scripts: { start: 'node --no-warnings server/server.js', test: 'node --no-warnings --test tests/server.test.js' }, dependencies: { ws } }, null, 2) + '\n');
write('.gitignore', 'node_modules/\nserver/data/\n.env\n*.db\n*.db-wal\n*.db-shm\n');
write('README.md', `# Хроники Глубин — сервер\n\nОткрытый авторитетный сервер: Node.js 22 + WebSocket + SQLite. Клиент отправляет намерения; прогресс, бой, чат, SP, экипировку, автолут и крафт рассчитывает сервер. Godot-клиент и графика не входят в эту публикацию.\n\n```sh\nnpm ci\nnpm test\nnpm start\n```\n\nПорт: PORT (по умолчанию 8790). База: DB (по умолчанию server/data/realms.db). Для внешнего доступа нужен TLS reverse proxy. DEV_CMD предназначен только для изолированных тестов; не включать в рабочем мире. Сейвы v3 сохраняют существующих персонажей.\n\nОбновления приходят из проверенного server-only экспорта. Исходный commit: ${commit}. Лицензия: AGPL-3.0, см. LICENSE.\n`);
write('.github/workflows/server.yml', `name: Server\non: [push, pull_request, workflow_dispatch]\npermissions:\n  contents: read\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262\n      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020\n        with:\n          node-version-file: .nvmrc\n          cache: npm\n      - run: npm ci\n      - run: npm test\n`);
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
await run(npm, ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: output, shell: process.platform === 'win32' });
await run(npm, ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: output, shell: process.platform === 'win32' });
await run(process.execPath, ['--no-warnings', '--test', 'tests/server.test.js'], { cwd: output });
if (!args.includes('--push')) { console.log('OSS_SERVER_PREPARED .native-run/oss-server (nothing published)'); process.exit(0); }
const repo = 'vakovalskii/khroniki-glubin';
const info = JSON.parse(execFileSync('gh', ['repo', 'view', repo, '--json', 'visibility,defaultBranchRef'], { encoding: 'utf8' }));
if (info.visibility !== 'PUBLIC') throw Error('Expected the public OSS repository; refusing a different publication target');
const clone = fs.mkdtempSync(path.join(os.tmpdir(), 'chronicles-oss-publish-'));
try {
  await run('git', ['clone', '--single-branch', '--branch', info.defaultBranchRef.name, `https://github.com/${repo}`, clone]);
  await run('git', ['rm', '-r', '--ignore-unmatch', '.'], { cwd: clone });
  for (const file of fs.readdirSync(output)) if (file !== 'node_modules') fs.cpSync(path.join(output, file), path.join(clone, file), { recursive: true });
  await run('git', ['add', '-A'], { cwd: clone });
  const diff = execFileSync('git', ['diff', '--cached', '--name-only'], { cwd: clone, encoding: 'utf8' }).trim();
  if (diff) {
    await run('git', ['commit', '-m', `Publish standalone server from ${commit.slice(0, 12)}`], { cwd: clone });
    await run('git', ['push', 'origin', `HEAD:${info.defaultBranchRef.name}`], { cwd: clone });
  }
  console.log('OSS_SERVER_PUBLISHED', repo, execFileSync('git', ['rev-parse', 'HEAD'], { cwd: clone, encoding: 'utf8' }).trim());
} finally { fs.rmSync(clone, { recursive: true, force: true }); }
