// Минимальные звуки на WebAudio (без ассетов).
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
  drop: () => blip(240, 0.08, 'sine', 0.04),
  // выше тир — выше и звонче слияние
  merge: (tier: number) => {
    const base = 300 + tier * 60;
    blip(base, 0.1, 'triangle', 0.05);
    setTimeout(() => blip(base * 1.5, 0.12, 'triangle', 0.045), 70);
  },
  over: () => {
    [440, 330, 247, 165].forEach((f, i) => setTimeout(() => blip(f, 0.2, 'sawtooth', 0.045), i * 120));
  },
};
