import type { Capacitor, Circuit, Part } from './circuit';
import { CONDUCTOR_OHMS } from './circuit';
import { stampResistive } from './dc';
import { type CircuitSolution, type Norton, solveNodal } from './mna';

/** The fixed simulated time step, in seconds (docs/design.md §4). */
export const TIME_STEP_SECONDS = 0.001;

/**
 * A change a child makes while the circuit runs. Unlike an edit, an input keeps capacitor state,
 * so a timer or a charged capacitor carries on as it would in a real circuit.
 */
export type Input =
  | { readonly kind: 'switch'; readonly partId: string; readonly closed: boolean }
  | { readonly kind: 'button'; readonly partId: string; readonly pressed: boolean };

/**
 * A circuit running through time in fixed steps.
 *
 * Every edit (adding, moving, rotating or removing a part or wire) starts a new simulation from
 * t = 0 with every capacitor discharged; inputs go through `applyInput`. An uncharged capacitor
 * conducts like a wire at t = 0, so the t = 0 solution shows the inrush current. Without
 * capacitors, every step gives the DC operating point.
 *
 * Steps are counted as an integer, so the same circuit and the same inputs at the same steps
 * always give the same result.
 */
export class TransientSimulation {
  private circuitNow: Circuit;
  private steps = 0;
  private readonly capacitorVolts = new Map<string, number>();
  private latest: CircuitSolution;

  constructor(circuit: Circuit) {
    this.circuitNow = circuit;
    for (const part of circuit.parts) {
      if (part.kind === 'capacitor') {
        this.capacitorVolts.set(part.id, 0);
      }
    }
    this.latest = this.solve((part) => chargedCapacitor(this.capacitorVolts.get(part.id)!));
  }

  get circuit(): Circuit {
    return this.circuitNow;
  }

  /** Simulated time since the last edit, in seconds. */
  get time(): number {
    return this.steps * TIME_STEP_SECONDS;
  }

  get stepCount(): number {
    return this.steps;
  }

  /** The solution at the current time. */
  get solution(): CircuitSolution {
    return this.latest;
  }

  /** The voltage across a capacitor (pins[0] minus pins[1]), in volts. */
  capacitorVoltage(partId: string): number {
    const volts = this.capacitorVolts.get(partId);
    if (volts === undefined) {
      throw new RangeError(`No capacitor ${partId}`);
    }
    return volts;
  }

  /** Advances one time step and returns the new solution. */
  step(): CircuitSolution {
    this.latest = this.solve((part) => backwardEuler(part, this.capacitorVolts.get(part.id)!));
    for (const id of this.capacitorVolts.keys()) {
      this.capacitorVolts.set(id, this.latest.parts.get(id)!.voltage);
    }
    this.steps++;
    return this.latest;
  }

  /** Advances `count` time steps and returns the final solution. */
  run(count: number): CircuitSolution {
    for (let i = 0; i < count; i++) {
      this.step();
    }
    return this.latest;
  }

  /** Flips a switch or presses or releases a button, keeping capacitor state and the time. */
  applyInput(input: Input): void {
    if (!this.circuitNow.parts.some((part) => part.id === input.partId)) {
      throw new RangeError(`No part ${input.partId}`);
    }
    const parts = this.circuitNow.parts.map((part): Part => {
      if (part.id !== input.partId) {
        return part;
      }
      if (part.kind !== input.kind) {
        throw new RangeError(`${input.partId} is a ${part.kind}, not a ${input.kind}`);
      }
      return input.kind === 'switch'
        ? { ...part, kind: 'switch', closed: input.closed }
        : { ...part, kind: 'button', pressed: input.pressed };
    });
    this.circuitNow = { parts };
  }

  private solve(capacitor: (part: Capacitor) => Norton): CircuitSolution {
    return solveNodal(this.circuitNow, (part) =>
      part.kind === 'capacitor' ? capacitor(part) : stampResistive(part),
    );
  }
}

/** A capacitor holding `volts`, treated for an instant as that voltage source. */
function chargedCapacitor(volts: number): Norton {
  return { conductance: 1 / CONDUCTOR_OHMS, amps: volts / CONDUCTOR_OHMS };
}

/**
 * Backward-Euler companion model: i = C · (v − v_prev) / Δt, a conductance C / Δt in parallel
 * with a source of C · v_prev / Δt. It is stable at any step size, so it never rings numerically.
 */
function backwardEuler(part: Capacitor, previousVolts: number): Norton {
  const conductance = part.farads / TIME_STEP_SECONDS;
  return { conductance, amps: conductance * previousVolts };
}
