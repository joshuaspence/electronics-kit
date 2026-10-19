import {
  type Battery,
  type Bulb,
  type Buzzer,
  type Capacitor,
  type Circuit,
  CONDUCTOR_OHMS,
  conducts,
  type Led,
  lightSensorOhms,
  type Motor,
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

/** An LED pops above this current (docs/design.md §4). */
export const LED_MAX_AMPS = 0.03;

/**
 * The most rounds of guessing which LEDs conduct. Each round settles at least one LED in all but
 * contrived circuits, so this is far more than a board's worth of LEDs needs.
 */
const MAX_LED_ROUNDS = 32;

/** Solves the circuit's DC operating point, with capacitors open. */
export function solveDc(circuit: Circuit): DcSolution {
  return solveWithLeds(circuit, () => OPEN);
}

/**
 * Solves the circuit with each capacitor stamped as `capacitor` says, finding which LEDs conduct.
 * An LED is piecewise linear: open while off, and a source of `forwardVolts` behind `ohms` while on.
 * Starting with every LED off, each round solves and then turns on exactly the LEDs with more than
 * their forward voltage across them, until no LED changes. That state is consistent: an LED that is
 * on then carries current from anode to cathode, and one that is off has too little voltage to.
 */
export function solveWithLeds(
  circuit: Circuit,
  capacitor: (part: Capacitor) => Norton,
): CircuitSolution {
  const leds = circuit.parts.filter((part): part is Led => part.kind === 'led' && conducts(part));
  let on = new Set<string>();
  let solution: CircuitSolution;
  for (let round = 0; ; round++) {
    solution = solveNodal(circuit, (part) => {
      switch (part.kind) {
        case 'capacitor':
          return capacitor(part);
        case 'led':
          return on.has(part.id) ? stampLitLed(part) : OPEN;
        default:
          return stampResistive(part);
      }
    });
    const next = new Set(
      leds
        .filter((led) => solution.parts.get(led.id)!.voltage > led.forwardVolts)
        .map((led) => led.id),
    );
    if (round + 1 >= MAX_LED_ROUNDS || sameIds(on, next)) {
      return solution;
    }
    on = next;
  }
}

/**
 * The stamp of every part but a capacitor or an LED, whose stamps depend on how and when the circuit
 * is being solved. Inside a battery current flows from − to +, so through it from pins[0] (+) to
 * pins[1] (−) it is negative while the battery is delivering power.
 */
function stampResistive(part: Exclude<Part, { kind: 'capacitor' | 'led' }>): Norton {
  if (!conducts(part)) {
    return OPEN;
  }
  switch (part.kind) {
    case 'battery':
      return { conductance: 1 / part.internalOhms, amps: part.volts / part.internalOhms };
    case 'resistor':
    case 'bulb':
    case 'buzzer':
    case 'motor':
      return { conductance: 1 / part.ohms, amps: 0 };
    case 'light-sensor':
      return { conductance: 1 / lightSensorOhms(part), amps: 0 };
    case 'wire':
    case 'switch':
    case 'button':
      return { conductance: 1 / CONDUCTOR_OHMS, amps: 0 };
  }
}

/** A conducting LED: current (v − forwardVolts) / ohms from anode to cathode. */
function stampLitLed(part: Led): Norton {
  return { conductance: 1 / part.ohms, amps: part.forwardVolts / part.ohms };
}

function sameIds(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  return a.size === b.size && [...a].every((id) => b.has(id));
}

/** How bright a bulb is, from 0 (dark) to 1 (full brightness or more). */
export function bulbBrightness(part: Bulb, reading: PartReading): number {
  return Math.min(1, reading.power / part.ratedWatts);
}

/** How bright an LED is, from 0 (dark) to 1 (its rated current or more). */
export function ledBrightness(part: Led, reading: PartReading): number {
  return Math.max(0, Math.min(1, reading.current / part.ratedAmps));
}

/** Whether a buzzer is sounding: it has at least its `onVolts` across it, either way round. */
export function buzzerSounds(part: Buzzer, reading: PartReading): boolean {
  return Math.abs(reading.voltage) >= part.onVolts;
}

/**
 * How fast a motor turns, from −1 to 1: 0 below its starting current, then rising with the current
 * to full speed at its rated current. It is negative when current flows from pins[1] to pins[0],
 * turning it the other way.
 */
export function motorSpeed(part: Motor, reading: PartReading): number {
  const amps = Math.abs(reading.current);
  if (amps < part.startAmps) {
    return 0;
  }
  return Math.sign(reading.current) * Math.min(1, amps / part.ratedAmps);
}

/** Whether an LED has more current through it than it can take, so it pops. */
export function ledPops(reading: PartReading): boolean {
  return reading.current > LED_MAX_AMPS;
}

/** Whether a battery is shorted out: connected across something with almost no resistance. */
export function isShorted(part: Battery, reading: PartReading): boolean {
  const shortCircuitAmps = Math.abs(part.volts) / part.internalOhms;
  return Math.abs(reading.current) > SHORT_CIRCUIT_FRACTION * shortCircuitAmps;
}
