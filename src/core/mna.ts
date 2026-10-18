import { type Circuit, type Part, type PointId, validateCircuit } from './circuit';
import { solveLinearSystem } from './linear';

/**
 * A tiny conductance from every point to an implicit ground. It gives each separate piece of a
 * circuit a reference voltage, so a loose part or a circuit with no battery still solves, and is
 * far too small to change any reading.
 */
const GMIN = 1e-9;

/**
 * How a part is stamped into the nodal equations: a conductance between its pins in parallel with
 * a current source pushing `amps` out of pins[1] and into pins[0]. Every part is linear in this
 * form for one solve, so the current through it from pins[0] to pins[1] is
 * `conductance × voltage − amps`. A resistor has no source; a battery is its Norton equivalent; a
 * capacitor in a time step is its backward-Euler companion model.
 */
export interface Norton {
  readonly conductance: number;
  readonly amps: number;
}

export const OPEN: Norton = { conductance: 0, amps: 0 };

export interface PartReading {
  /** Conventional current through the part from pins[0] to pins[1], in amps. */
  readonly current: number;
  /** Voltage of pins[0] minus pins[1], in volts. */
  readonly voltage: number;
  /** Power the part dissipates (a battery's internal resistance included), in watts. */
  readonly power: number;
}

export interface CircuitSolution {
  /** Voltage of each point relative to the circuit's implicit ground. */
  readonly pointVolts: ReadonlyMap<PointId, number>;
  readonly parts: ReadonlyMap<string, PartReading>;
}

/** Solves the nodal equations with each part stamped as `stamp` says. */
export function solveNodal(circuit: Circuit, stamp: (part: Part) => Norton): CircuitSolution {
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

  const norton = new Map<string, Norton>();
  for (const part of circuit.parts) {
    const { conductance, amps } = stamp(part);
    norton.set(part.id, { conductance, amps });
    const a = index.get(part.pins[0])!;
    const b = index.get(part.pins[1])!;
    if (a === b) {
      continue;
    }
    g[a * n + a] = g[a * n + a]! + conductance;
    g[b * n + b] = g[b * n + b]! + conductance;
    g[a * n + b] = g[a * n + b]! - conductance;
    g[b * n + a] = g[b * n + a]! - conductance;
    rhs[a] = rhs[a]! + amps;
    rhs[b] = rhs[b]! - amps;
  }

  const volts = n === 0 ? new Float64Array(0) : solveLinearSystem(g, rhs);
  const pointVolts = new Map<PointId, number>();
  for (const [point, i] of index) {
    pointVolts.set(point, volts[i]!);
  }

  const parts = new Map<string, PartReading>();
  for (const part of circuit.parts) {
    const voltage = volts[index.get(part.pins[0])!]! - volts[index.get(part.pins[1])!]!;
    const { conductance, amps } = norton.get(part.id)!;
    const current = conductance * voltage - amps;
    const power =
      part.kind === 'battery' ? current * current * part.internalOhms : voltage * current;
    parts.set(part.id, { current, voltage, power });
  }
  return { pointVolts, parts };
}
