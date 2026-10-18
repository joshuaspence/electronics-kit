/** Below this current (in amps) no flow is shown: a loose part's leak is not a current. */
export const FLOW_THRESHOLD_AMPS = 0.001;

/** Dot speed at the threshold, and how much faster each tenfold increase in current makes it. */
const BASE_SPEED = 20;
const SPEED_PER_DECADE = 20;
const MAX_SPEED = 120;

/**
 * How fast the flowing dots move along a part carrying `amps`, in board units per second, signed
 * like the current: positive flows from pins[0] to pins[1]. Speed grows with the logarithm of the
 * current, so 10 mA through an LED and 300 mA through a bulb both visibly move, and a short
 * circuit races.
 */
export function flowSpeed(amps: number): number {
  const magnitude = Math.abs(amps);
  if (!(magnitude >= FLOW_THRESHOLD_AMPS)) {
    return 0;
  }
  const decades = Math.log10(magnitude / FLOW_THRESHOLD_AMPS);
  return Math.sign(amps) * Math.min(MAX_SPEED, BASE_SPEED + SPEED_PER_DECADE * decades);
}
