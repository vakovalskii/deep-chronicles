// Запрос к OpenRouter. Идёт через curl: в некоторых сетях прокси режет запросы Node
// (403 «Access denied by security policy»), а curl проходит.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);

const env = fs.existsSync('.env') ? Object.fromEntries(fs.readFileSync('.env', 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => l.split(/=(.*)/s).slice(0, 2))) : {};
export const KEY = process.env.OPENROUTER_API_KEY || env.OPENROUTER_API_KEY;
export const MODEL = process.env.IMG_MODEL || 'google/gemini-3.1-flash-image';

// Возвращает { png: Buffer, cost } — картинку и её стоимость.
// refs — картинки-образцы (Buffer или путь): модель дорисовывает по ним, а не с нуля.
// Нужно для видов сзади и сбоку: персонаж обязан остаться тем же самым.
export async function drawImage(prompt, { model = MODEL, ratio = '1:1', refs = [] } = {}) {
  if (!KEY) throw new Error('нет OPENROUTER_API_KEY в .env');
  const parts = refs.map((r) => ({
    type: 'image_url',
    image_url: { url: 'data:image/png;base64,' + (Buffer.isBuffer(r) ? r : fs.readFileSync(r)).toString('base64') },
  }));
  const content = parts.length ? [...parts, { type: 'text', text: prompt }] : prompt;
  const body = JSON.stringify({ model, modalities: ['image', 'text'], image_config: { aspect_ratio: ratio }, messages: [{ role: 'user', content }] });
  // тело запроса — через файл: асинхронный execFile не умеет писать в stdin, и curl висел бы вечно
  const tmp = path.join(os.tmpdir(), `or-${process.pid}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(tmp, body);
  let stdout;
  try {
    ({ stdout } = await run('curl', ['-sS', '--max-time', '300', '-X', 'POST', 'https://openrouter.ai/api/v1/chat/completions',
      '-H', `Authorization: Bearer ${KEY}`, '-H', 'Content-Type: application/json', '--data-binary', `@${tmp}`],
      { maxBuffer: 64 * 1024 * 1024 }));
  } finally { fs.unlinkSync(tmp); }
  const j = JSON.parse(stdout);
  if (j.error) throw new Error(typeof j.error === 'string' ? j.error : JSON.stringify(j.error).slice(0, 160));
  const url = j.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url) throw new Error('нет изображения: ' + stdout.slice(0, 160));
  return { png: Buffer.from(url.split(',')[1], 'base64'), cost: j.usage?.cost || 0 };
}
