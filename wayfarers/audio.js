// Soft, short sounds made on the fly (no audio files). Quiet by design.
let ctx = null, master = null, enabled = true;
const lastAt = {};

export function setSound(on) { enabled = on; if (master) master.gain.value = on ? 0.5 : 0; }
export function unlockAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = enabled ? 0.5 : 0;
  master.connect(ctx.destination);
}

function tone(freq, dur, { type = 'sine', vol = 0.2, at = 0, slide = 0 } = {}) {
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, { vol = 0.2, freq = 800, at = 0 } = {}) {
  const t = ctx.currentTime + at;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = ctx.createBufferSource(); s.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
  const g = ctx.createGain(); g.gain.value = vol;
  s.connect(f); f.connect(g); g.connect(master);
  s.start(t);
}

const NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
let coinStep = 0, coinReset = 0;

export function play(name) {
  if (!ctx || !enabled) return;
  const now = performance.now();
  const gap = { throw: 70, tick: 60, coin: 45, bump: 70, pop: 50 }[name] || 0;
  if (gap && now - (lastAt[name] || 0) < gap) return;
  lastAt[name] = now;
  switch (name) {
    case 'throw': noise(0.05, { vol: 0.03, freq: 1800 }); break;
    case 'tick': tone(980, 0.05, { vol: 0.05, type: 'triangle' }); break;
    case 'coin': {
      if (now - coinReset > 600) coinStep = 0;
      coinReset = now;
      tone(NOTES[coinStep % NOTES.length] * 1.5, 0.12, { vol: 0.07, type: 'triangle' });
      coinStep++;
      break;
    }
    case 'gate': tone(523, 0.12, { vol: 0.12 }); tone(784, 0.18, { vol: 0.1, at: 0.07 }); break;
    case 'gateLow': tone(330, 0.2, { vol: 0.08, slide: 0.8 }); break;
    case 'bump': tone(160, 0.08, { vol: 0.08, type: 'triangle', slide: 0.7 }); break;
    case 'pop': tone(420, 0.07, { vol: 0.05, type: 'triangle', slide: 0.6 }); break;
    case 'crate': noise(0.18, { vol: 0.14, freq: 1400 }); tone(660, 0.1, { vol: 0.06, at: 0.05 }); break;
    case 'crumble': noise(0.35, { vol: 0.22, freq: 600 }); tone(110, 0.25, { vol: 0.1, slide: 0.6 }); break;
    case 'go': tone(440, 0.1, { vol: 0.08 }); tone(660, 0.14, { vol: 0.08, at: 0.08 }); break;
    case 'finish': [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, { vol: 0.1, at: i * 0.09 })); break;
    case 'win': [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, 0.3, { vol: 0.09, at: i * 0.1, type: 'triangle' })); break;
    case 'rest': tone(392, 0.3, { vol: 0.07 }); tone(330, 0.4, { vol: 0.07, at: 0.18 }); break;
    case 'buy': tone(660, 0.08, { vol: 0.1, type: 'triangle' }); tone(990, 0.14, { vol: 0.09, at: 0.06, type: 'triangle' }); break;
    case 'tap': tone(700, 0.04, { vol: 0.05, type: 'triangle' }); break;
  }
}
