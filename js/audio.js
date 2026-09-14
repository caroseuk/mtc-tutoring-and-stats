// Tiny synthesised sound effects with the Web Audio API. No audio files.

export function createAudio() {
  let ctx = null;
  let enabled = true;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
    }
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  function tone(freq, { start = 0, dur = 0.12, type = 'sine', gain = 0.12 } = {}) {
    if (!enabled) return;
    const c = ensure();
    if (!c) return;
    try {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.value = freq;
      const t0 = c.currentTime + start;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(c.destination);
      o.start(t0);
      o.stop(t0 + dur + 0.05);
    } catch { /* audio is optional */ }
  }

  return {
    get enabled() { return enabled; },
    set enabled(v) { enabled = !!v; },
    unlock: ensure,
    tap: () => tone(700, { dur: 0.05, gain: 0.05, type: 'triangle' }),
    correct: () => { tone(660, { dur: 0.12 }); tone(880, { start: 0.1, dur: 0.2 }); },
    wrong: () => tone(160, { dur: 0.3, type: 'square', gain: 0.05 }),
    fanfare: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, { start: i * 0.11, dur: 0.28 })),
    go: () => tone(520, { dur: 0.15, type: 'triangle' }),
  };
}
