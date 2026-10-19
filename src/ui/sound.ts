// Sound effects synthesised with the Web Audio API: no audio files to download (docs/design.md §7).
// The audio context is created on first use, which is always in response to the child's own action,
// so browsers allow it to play. The buzzer is the one sound a render can start (a shared circuit can
// open with a buzzer already sounding), so it waits for the child's first action.

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

let buzz: { oscillator: OscillatorNode; gain: GainNode } | null = null;
let wantBuzz = false;

/**
 * Starts or stops the buzzers' sound, a steady square-wave tone that lasts as long as any buzzer
 * on the board is sounding (docs/design.md §7). Before the child's first action it starts nothing
 * and waits for that action instead.
 */
export function setBuzzing(on: boolean) {
  wantBuzz = on;
  if (!on) {
    buzz?.gain.gain.setTargetAtTime(0, buzz.oscillator.context.currentTime, 0.01);
    buzz?.oscillator.stop(buzz.oscillator.context.currentTime + 0.05);
    buzz = null;
    return;
  }
  if (buzz) {
    return;
  }
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) {
    // A touch activates the page on lifting, not landing, so wait for pointerup.
    window.addEventListener('pointerup', () => setBuzzing(wantBuzz), { once: true });
    return;
  }
  const ctx = audio();
  if (!ctx) {
    return;
  }
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = 'square';
  oscillator.frequency.value = 2300;
  gain.gain.value = 0.03;
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start();
  buzz = { oscillator, gain };
}

/** A comic pop when an LED takes too much current: a quick drop in pitch. */
export function playPop() {
  tone(900, 0.08, 'square', 0.1);
  tone(300, 0.12, 'triangle', 0.12, 0.04);
}

/** A rising chime when a level is finished: C, E and G, a major chord played a note at a time. */
export function playChime() {
  [523, 659, 784].forEach((frequency, i) => tone(frequency, 0.5, 'triangle', 0.12, i * 0.12));
}
