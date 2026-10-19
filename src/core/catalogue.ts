import type { PartSpec } from './build';
import type { PartKind } from './circuit';

/**
 * The parts in the kit: what each starts as when taken from the tray. A 3 V battery pack (two AA
 * cells) and small bulbs rated so that one bulb across the pack is at full brightness. An LED
 * straight across the pack takes about 95 mA and pops; behind a 100 Ω resistor it takes about 9 mA
 * and glows. A buzzer sounds from 2 V, so in a row with a bulb it still sounds, but behind a
 * 100 Ω resistor it doesn't. A motor takes about 0.55 A on its own, turning at full speed, and
 * turns slowly in a row with a bulb.
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
      return { kind, farads: 0.001 };
    case 'buzzer':
      return { kind, ohms: 150, onVolts: 2 };
    case 'motor':
      return { kind, ohms: 5, startAmps: 0.15, ratedAmps: 0.5 };
    case 'switch':
      return { kind, closed: false };
    case 'button':
      return { kind, pressed: false };
    case 'wire':
      return { kind };
  }
}
