import type { PartSpec } from './build';
import type { PartKind } from './circuit';

/**
 * The parts in the kit: what each starts as when taken from the tray. A 3 V battery pack (two AA
 * cells) and small bulbs rated so that one bulb across the pack is at full brightness. An LED
 * straight across the pack takes about 95 mA and pops; behind a 100 Ω resistor it takes about 9 mA
 * and glows. A buzzer sounds from 2 V, so in a row with a bulb it still sounds, but behind a
 * 100 Ω resistor it doesn't. A motor takes about 0.55 A on its own, turning at full speed, and
 * turns slowly in a row with a bulb. A light sensor in a row with a bulb lights it in full light
 * (5 Ω) and leaves it dark in the dark (10 kΩ). It starts at half light, a dim room where neither a
 * bulb nor a buzzer in a row with it works, so the child turns the light up to see it work. A
 * capacitor is a big 0.2 F one, so beside a bulb it keeps the bulb lit for over a second once the
 * battery is cut off, fading as it empties (a time constant of 2.2 s through the bulb's 10 Ω and its own 1 Ω).
 */
export function newSpec(kind: PartKind): PartSpec {
  switch (kind) {
    case 'battery':
      return { kind, volts: 3, internalOhms: 0.5 };
    case 'bulb':
      return { kind, ohms: 10, ratedWatts: 0.5 };
    case 'led':
      return { kind, forwardVolts: 2, ohms: 10, ratedAmps: 0.02, blown: false };
    case 'resistor':
      return { kind, ohms: 100 };
    case 'capacitor':
      return { kind, farads: 0.2 };
    case 'buzzer':
      return { kind, ohms: 150, onVolts: 2 };
    case 'motor':
      return { kind, ohms: 5, startAmps: 0.15, ratedAmps: 0.5 };
    case 'light-sensor':
      return { kind, brightOhms: 5, darkOhms: 10_000, light: 0.5 };
    case 'switch':
      return { kind, closed: false };
    case 'button':
      return { kind, pressed: false };
    case 'wire':
      return { kind };
  }
}
