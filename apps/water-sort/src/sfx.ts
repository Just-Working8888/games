// Минимальные звуки на WebAudio (без ассетов). Уважает настройку sound.
let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(v: boolean) {
  enabled = v;
}

function ac(): AudioContext | null {
  if (!enabled) return null;
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function blip(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.05) {
  const c = ac();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  osc.connect(g).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + dur);
}

export const sfx = {
  select: () => blip(520, 0.06, 'triangle', 0.04),
  pour: () => blip(320, 0.12, 'sine', 0.05),
  complete: () => {
    blip(660, 0.12, 'triangle', 0.05);
    setTimeout(() => blip(880, 0.16, 'triangle', 0.05), 90);
  },
  win: () => {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.18, 'triangle', 0.05), i * 110));
  },
  error: () => blip(160, 0.12, 'sawtooth', 0.04),
};
