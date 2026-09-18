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
let air = 0;
const breeze = (t, duration, gain) => {
  air += (noise() - air) * .06;
  const seam = Math.min(1, t / .3, (duration-t) / .3);
  return air * gain * seam * (.7 + .3 * Math.sin(tau*t/duration));
};
const bird = (t, start) => {
  const u = t-start;
  return u > 0 && u < .45 ? tone(2100, u) * Math.sin(28*u+6*Math.sin(12*u)) * Math.sin(Math.PI*u/.45)**2 * .035 : 0;
};
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
  // Короткое затухание шума на стыке исключает щелчки при повторе.
  wind: [16, t => breeze(t,16,.24) + bird(t,3) + bird(t,10.5)],
  town: [16, t => breeze(t,16,.3) + (t > 5 ? tone(440,t-5)*Math.exp(-(t-5)*1.2)*.035 : 0)],
  forest: [16, t => breeze(t,16,.38) + bird(t,2) + bird(t,2.8) + bird(t,11)],
  crypt: [16, t => breeze(t,16,.11) + tone(48,t)*.025 + tone(71,t)*.012 + (t > 7 ? tone(930,t-7)*Math.exp(-(t-7)*5)*.045 : 0)],
  waste: [16, t => breeze(t,16,.5) + tone(39,t)*.008],
  step_stone: [.18, t => noise()*Math.exp(-t*65)*.25 + tone(620,t)*Math.exp(-t*60)*.18 + tone(150,t)*Math.exp(-t*36)*.22],
  step_earth: [.2, t => noise()*Math.exp(-t*27)*.16 + tone(95,t)*Math.exp(-t*35)*.23],
};
const dir = path.join(root, 'godot/assets/audio'); fs.mkdirSync(dir, { recursive: true });
for (const [id, [seconds, sample]] of Object.entries(specs)) {
  seed = 19421; air = 0;
  const count = Math.round(seconds * rate), wav = Buffer.alloc(44 + count * 2);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(count * 2, 40);
  for (let i = 0; i < count; i++) {
    const t = i / rate;
    const envelope = ['wind','town','forest','crypt','waste'].includes(id) ? 1 : Math.min(1, t / .004, (seconds - t) / .025);
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
