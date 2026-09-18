// Reproducible single-EXE Windows distribution (fixed ZIP timestamps/order).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { root, run } from './runtime.mjs';
const dir = path.join(root, 'godot/builds/windows');
const exe = path.join(dir, 'Хроники Глубин.exe');
if (!fs.existsSync(exe)) throw Error('Build the Windows export first');
const hash = crypto.createHash('sha256').update(fs.readFileSync(exe)).digest('hex');
const info = 'Хроники Глубин — самостоятельный клиент Godot\r\n\r\nРаспакуйте весь ZIP в папку и откройте «Хроники Глубин.exe».\r\nИгра подключается к основному серверу. Войдите в существующий аккаунт.\r\nI — сумка, K — навыки, F — атака, Z — подбор, Enter — чат.\r\n«Панель…» — настройка быстрых действий. Автолут переключается рядом.\r\nРесурсы встроены в EXE. Установка Godot не нужна.\r\n';
await run('python3', ['-c', `import zipfile,sys,os
folder,sha,readme=sys.argv[1:]
with zipfile.ZipFile(os.path.join(folder,'khroniki-glubin-windows.zip'),'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for name,data in [('Хроники Глубин.exe',open(os.path.join(folder,'Хроники Глубин.exe'),'rb').read()),('README.txt',readme.encode('utf-8')),('SHA256.txt',(sha+'  Хроники Глубин.exe\\n').encode('utf-8'))]:
  entry=zipfile.ZipInfo(name,(1980,1,1,0,0,0));entry.compress_type=zipfile.ZIP_DEFLATED;entry.external_attr=0o100644<<16;z.writestr(entry,data)
with zipfile.ZipFile(os.path.join(folder,'khroniki-glubin-windows.zip')) as z:
 assert z.testzip() is None
 assert sorted(z.namelist())==sorted(['Хроники Глубин.exe','README.txt','SHA256.txt'])
print('WINDOWS_ZIP_OK')`, dir, hash, info]);
console.log('ZIP:', path.join(dir, 'khroniki-glubin-windows.zip'));
