import type { PartSpec } from './build';
import type { PartKind } from './circuit';

/**
 * The parts in the kit: what each starts as when taken from the tray. A 3 V battery pack (two AA
 * cells) and small bulbs rated so that one bulb across the pack is at full brightness.
 */
export function newSpec(kind: PartKind): PartSpec {
  switch (kind) {
    case 'battery':
      return { kind, volts: 3, internalOhms: 0.5 };
    case 'bulb':
      return { kind, ohms: 10, ratedWatts: 0.5 };
    case 'resistor':
      return { kind, ohms: 100 };
    case 'capacitor':
      return { kind, farads: 0.001 };
    case 'switch':
      return { kind, closed: false };
    case 'button':
      return { kind, pressed: false };
    case 'wire':
      return { kind };
  }
}
