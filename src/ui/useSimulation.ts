import { useEffect, useReducer, useRef } from 'react';
import type { Circuit } from '../core/circuit';
import { solveDc } from '../core/dc';
import type { CircuitSolution } from '../core/mna';
import { inputsBetween, TIME_STEP_SECONDS, TransientSimulation } from '../core/transient';

/**
 * The most simulated steps run in one frame. A frame that would need more (a slow device, or a
 * tab coming back from the background) runs these and lets the rest of the time go, so the step
 * count adapts down rather than dropping frames (docs/design.md §4).
 */
const MAX_STEPS_PER_FRAME = 100;

/** Whether a circuit changes over time, so it needs the transient run rather than the DC point. */
export function changesOverTime(circuit: Circuit): boolean {
  return circuit.parts.some((part) => part.kind === 'capacitor' || part.kind === 'blinker');
}

/**
 * What the board shows for `circuit`: its DC operating point, or for a circuit that changes over
 * time, a transient run kept going in real time multiplied by `speed`. An edit starts the run
 * again from t = 0; an input (a switch, a button, a light sensor) carries on with it.
 */
export function useSimulation(circuit: Circuit, speed: number): CircuitSolution {
  const timed = changesOverTime(circuit);
  const sim = useRef<TransientSimulation | null>(null);
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  if (!timed) {
    sim.current = null;
  } else {
    const inputs = sim.current && inputsBetween(sim.current.circuit, circuit);
    if (!sim.current || !inputs) {
      sim.current = new TransientSimulation(circuit);
    } else {
      inputs.forEach((input) => sim.current!.applyInput(input));
    }
  }

  useEffect(() => {
    if (!timed) {
      return;
    }
    let frame = 0;
    let last: number | null = null;
    let owed = 0;
    const tick = (now: number) => {
      if (last !== null && sim.current) {
        owed = Math.min(
          owed + ((now - last) / 1000) * speed,
          MAX_STEPS_PER_FRAME * TIME_STEP_SECONDS,
        );
        const steps = Math.floor(owed / TIME_STEP_SECONDS);
        if (steps > 0) {
          sim.current.run(steps);
          owed -= steps * TIME_STEP_SECONDS;
          rerender();
        }
      }
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [timed, speed]);

  return sim.current ? sim.current.solution : solveDc(circuit);
}
