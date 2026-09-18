// Original deterministic sound design. No downloads or external audio licenses.
// Rebuild: npm run native:audio; verify byte-for-byte: npm run native:audio -- --check
import fs from 'node:fs';
import path from 'node:path';
import { root } from './runtime.mjs';
const rate = 24000, tau = Math.PI * 2;
let seed = 19421;
const noise = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 2147483648 - 1; };
const tone = (hz, t) => Math.sin(tau * hz * t);
const notes = (t, frequencies) => frequencies.reduce((v, hz, i) => v + tone(hz, t) * Math.exp(-Math.max(0, t - i * .12) * 3) * (t > i * .12 ? 1 : 0), 0) / frequencies.length;
const specs = {
  swing: [.32, t => noise() * Math.sin(Math.PI * t / .32) ** 2 * .6 + tone(170 - t * 210, t) * .12],
  impact: [.36, t => noise() * Math.exp(-t * 26) * .6 + tone(126, t) * Math.exp(-t * 17) * .45 + tone(1860, t) * Math.exp(-t * 35) * .1],
  critical: [.65, t => noise() * Math.exp(-t * 17) * .4 + tone(78, t) * Math.exp(-t * 9) * .5 + notes(t, [430, 645, 860]) * .12],
  charge: [1.2, t => (tone(190 + t * 95, t) + tone(285 + t * 143, t) * .35) * Math.sin(Math.PI * t / 1.2) * .28 + noise() * .035],
  fire: [.65, t => noise() * Math.sin(Math.PI * t / .65) * .36 + tone(100 - 45 * t, t) * Math.exp(-t * 6) * .4],
  frost: [1.0, t => noise() * Math.exp(-t * 10) * .3 + notes(t, [1175, 1568, 2349]) * .48],
  heal: [1.5, t => notes(t, [392, 493.88, 587.33, 783.99]) * .65],
  buff: [.95, t => (tone(146.83, t) + tone(220, t) * .6 + tone(293.66, t) * .3) * Math.sin(Math.PI * t / .95) * .25],
  step: [.16, t => noise() * Math.exp(-t * 40) * .3 + tone(120, t) * Math.exp(-t * 40) * .25],
  death: [.8, t => (tone(84 - t * 32, t) * .4 + noise() * .2) * Math.exp(-t * 6)],
  loot: [.5, t => notes(t, [1568, 2093]) * .45],
  level: [2.0, t => notes(t, [293.66, 369.99, 440, 587.33, 739.99]) * .8],
  // Integer-cycle layers make these low-key environmental beds seamless.
  wind: [8, t => (tone(43, t) * .1 + tone(71, t) * .045 + tone(173, t) * .015) * (.7 + .3 * tone(.25, t))],
};
const dir = path.join(root, 'godot/assets/audio'); fs.mkdirSync(dir, { recursive: true });
for (const [id, [seconds, sample]] of Object.entries(specs)) {
  seed = 19421;
  const count = Math.round(seconds * rate), wav = Buffer.alloc(44 + count * 2);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(count * 2, 40);
  for (let i = 0; i < count; i++) {
    const t = i / rate;
    const envelope = id === 'wind' ? 1 : Math.min(1, t / .004, (seconds - t) / .025);
    const value = sample(t) * envelope;
    if (!Number.isFinite(value) || Math.abs(value) >= 1) throw Error(`Clipping in ${id}`);
    wav.writeInt16LE(Math.round(value * 32767), 44 + i * 2);
  }
  const file = path.join(dir, `${id}.wav`);
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(file) || !fs.readFileSync(file).equals(wav)) throw Error(`Audio differs: ${id}`);
  } else fs.writeFileSync(file, wav);
}
console.log(`AUDIO_OK ${Object.keys(specs).length} original PCM sounds, ${rate} Hz, deterministic`);
