import {
  type Battery,
  type Bulb,
  type Circuit,
  CONDUCTOR_OHMS,
  conducts,
  type Part,
} from './circuit';
import { type CircuitSolution, type Norton, OPEN, type PartReading, solveNodal } from './mna';

export type { PartReading };
export type DcSolution = CircuitSolution;

/**
 * A battery is shorted when it delivers more than this fraction of its short-circuit current
 * (volts / internalOhms), that is, when what it is connected to has less resistance than the
 * battery itself.
 */
const SHORT_CIRCUIT_FRACTION = 0.5;

/** Solves the circuit's DC operating point, with capacitors open. */
export function solveDc(circuit: Circuit): DcSolution {
  return solveNodal(circuit, (part) => (part.kind === 'capacitor' ? OPEN : stampResistive(part)));
}

/**
 * The stamp of every part except a capacitor, whose stamp depends on how it is being solved.
 * Inside a battery current flows from − to +, so through it from pins[0] (+) to pins[1] (−) it is
 * negative while the battery is delivering power.
 */
export function stampResistive(part: Exclude<Part, { kind: 'capacitor' }>): Norton {
  if (!conducts(part)) {
    return OPEN;
  }
  switch (part.kind) {
    case 'battery':
      return { conductance: 1 / part.internalOhms, amps: part.volts / part.internalOhms };
    case 'resistor':
    case 'bulb':
      return { conductance: 1 / part.ohms, amps: 0 };
    case 'wire':
    case 'switch':
    case 'button':
      return { conductance: 1 / CONDUCTOR_OHMS, amps: 0 };
  }
}

/** How bright a bulb is, from 0 (dark) to 1 (full brightness or more). */
export function bulbBrightness(part: Bulb, reading: PartReading): number {
  return Math.min(1, reading.power / part.ratedWatts);
}

/** Whether a battery is shorted out: connected across something with almost no resistance. */
export function isShorted(part: Battery, reading: PartReading): boolean {
  const shortCircuitAmps = Math.abs(part.volts) / part.internalOhms;
  return Math.abs(reading.current) > SHORT_CIRCUIT_FRACTION * shortCircuitAmps;
}
