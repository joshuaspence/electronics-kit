import {
  type Battery,
  type Bulb,
  type Circuit,
  CONDUCTOR_OHMS,
  conducts,
  type Part,
  type PointId,
  validateCircuit,
} from './circuit';
import { solveLinearSystem } from './linear';

/**
 * A tiny conductance from every point to an implicit ground. It gives each separate piece of a
 * circuit a reference voltage, so a loose part or a circuit with no battery still solves, and is
 * far too small to change any reading.
 */
const GMIN = 1e-9;

/**
 * A battery is shorted when it delivers more than this fraction of its short-circuit current
 * (volts / internalOhms), that is, when what it is connected to has less resistance than the
 * battery itself.
 */
const SHORT_CIRCUIT_FRACTION = 0.5;

export interface PartReading {
  /** Conventional current through the part from pins[0] to pins[1], in amps. */
  readonly current: number;
  /** Voltage of pins[0] minus pins[1], in volts. */
  readonly voltage: number;
  /** Power the part dissipates (a battery's internal resistance included), in watts. */
  readonly power: number;
}

export interface DcSolution {
  /** Voltage of each point relative to the circuit's implicit ground. */
  readonly pointVolts: ReadonlyMap<PointId, number>;
  readonly parts: ReadonlyMap<string, PartReading>;
}

/** Solves the circuit's DC operating point. */
export function solveDc(circuit: Circuit): DcSolution {
  validateCircuit(circuit);

  const index = new Map<PointId, number>();
  for (const part of circuit.parts) {
    for (const point of part.pins) {
      if (!index.has(point)) {
        index.set(point, index.size);
      }
    }
  }

  const n = index.size;
  const g = new Float64Array(n * n);
  const rhs = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    g[i * n + i] = GMIN;
  }

  const stampConductance = (a: number, b: number, conductance: number) => {
    if (a === b) {
      return;
    }
    g[a * n + a] = g[a * n + a]! + conductance;
    g[b * n + b] = g[b * n + b]! + conductance;
    g[a * n + b] = g[a * n + b]! - conductance;
    g[b * n + a] = g[b * n + a]! - conductance;
  };
  // A current source pushing `amps` into point `into` and out of point `from`.
  const stampCurrent = (into: number, from: number, amps: number) => {
    rhs[into] = rhs[into]! + amps;
    rhs[from] = rhs[from]! - amps;
  };

  for (const part of circuit.parts) {
    const a = index.get(part.pins[0])!;
    const b = index.get(part.pins[1])!;
    const conductance = partConductance(part);
    if (conductance === 0) {
      continue;
    }
    stampConductance(a, b, conductance);
    if (part.kind === 'battery') {
      // Norton equivalent of a voltage source in series with its internal resistance.
      stampCurrent(a, b, part.volts / part.internalOhms);
    }
  }

  const volts = n === 0 ? new Float64Array(0) : solveLinearSystem(g, rhs);
  const pointVolts = new Map<PointId, number>();
  for (const [point, i] of index) {
    pointVolts.set(point, volts[i]!);
  }

  const parts = new Map<string, PartReading>();
  for (const part of circuit.parts) {
    const voltage = volts[index.get(part.pins[0])!]! - volts[index.get(part.pins[1])!]!;
    parts.set(part.id, readPart(part, voltage));
  }
  return { pointVolts, parts };
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

function partConductance(part: Part): number {
  if (!conducts(part)) {
    return 0;
  }
  switch (part.kind) {
    case 'battery':
      return 1 / part.internalOhms;
    case 'resistor':
    case 'bulb':
      return 1 / part.ohms;
    case 'wire':
    case 'switch':
    case 'button':
      return 1 / CONDUCTOR_OHMS;
  }
}

function readPart(part: Part, voltage: number): PartReading {
  if (part.kind === 'battery') {
    // Inside the battery current flows from − to +, so through it from pins[0] (+) to pins[1] (−)
    // it is negative while the battery is delivering power.
    const current = (voltage - part.volts) / part.internalOhms;
    return { current, voltage, power: current * current * part.internalOhms };
  }
  const conductance = partConductance(part);
  const current = voltage * conductance;
  return { current, voltage, power: voltage * current };
}
