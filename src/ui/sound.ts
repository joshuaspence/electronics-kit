// Sound effects synthesised with the Web Audio API: no audio files to download (docs/design.md §7).
// The audio context is created on first use, which is always in response to the child's own action,
// so browsers allow it to play.

let context: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') {
      void context.resume();
    }
    return context;
  } catch {
    return null;
  }
}

function tone(frequency: number, seconds: number, type: OscillatorType, volume: number, delay = 0) {
  const ctx = audio();
  if (!ctx) {
    return;
  }
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  const start = ctx.currentTime + delay;
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + seconds);
}

/** A short click as a part snaps into the board. */
export function playSnap() {
  tone(1200, 0.05, 'square', 0.08);
}

/** A low buzz when the battery is shorted. */
export function playWarning() {
  tone(110, 0.4, 'sawtooth', 0.1);
}

/** A rising chime when a level is finished: C, E and G, a major chord played a note at a time. */
export function playChime() {
  [523, 659, 784].forEach((frequency, i) => tone(frequency, 0.5, 'triangle', 0.12, i * 0.12));
}
