import { type Build, locationKey, type PartSpec, type PlacedPart, toCircuit } from './build';
import { checkGoal, type GoalFailure, type Level, litNow } from './levels';

/**
 * Volty's hints escalate (docs/design.md §6): first a nudge saying what is wrong, then one step of
 * the level's solution at a time. A hint never builds anything itself.
 */
export type Hint =
  | { readonly kind: 'nudge'; readonly reason: GoalFailure | 'switch-off' }
  | { readonly kind: 'remove-part'; readonly part: PlacedPart }
  | { readonly kind: 'show-part'; readonly part: PlacedPart };

/**
 * The hint for the child's `step`th request (0 for the first) on this build. Later steps show one
 * difference from the solved build at a time: first a part to take away (a starting part the
 * solution removes, or one the child put where the solution has none), then a part to place. Once
 * the build matches, it nudges again.
 */
export function hintFor(level: Level, build: Build, step: number): Hint {
  if (step > 0) {
    const removed = new Set(level.solution.remove ?? []);
    const missing = [
      ...level.parts.filter((part) => !removed.has(part.id)),
      ...level.solution.place,
    ];
    const extras: PlacedPart[] = [];

    // One to one, so a second part in a solution part's place is an extra holding back the tray.
    for (const part of build.parts) {
      const match = missing.findIndex((wanted) => samePlace(part, wanted));
      if (match >= 0) {
        missing.splice(match, 1);
      } else if (!part.fixed) {
        extras.push(part);
      }
    }
    if (extras[0]) {
      return { kind: 'remove-part', part: extras[0] };
    }
    if (missing[0]) {
      return { kind: 'show-part', part: missing[0] };
    }
  }
  const circuit = toCircuit(level.board, build);
  const result = checkGoal(level.goal, circuit);
  if (!result.met) {
    return { kind: 'nudge', reason: result.reason };
  }
  return {
    kind: 'nudge',
    reason: litNow(circuit) < level.goal.lights ? 'switch-off' : 'too-few-lit',
  };
}

/**
 * The same part with its legs in the same two places: either way round, unless the part has a +
 * and a − (a battery or an LED), when the way round is what matters.
 */
function samePlace(a: PlacedPart, b: PlacedPart): boolean {
  if (!sameSpec(a.spec, b.spec)) {
    return false;
  }
  const [a0, a1] = a.at.map(locationKey);
  const [b0, b1] = b.at.map(locationKey);
  const polarised = a.spec.kind === 'led' || a.spec.kind === 'battery';
  return (a0 === b0 && a1 === b1) || (!polarised && a0 === b1 && a1 === b0);
}

/**
 * The same part: the same kind and value, such as a resistor's ohms, or an LED that hasn't
 * popped. Whether a switch is on, a button pressed or a light sensor lit is the child playing, not
 * a difference.
 */
function sameSpec(a: PartSpec, b: PartSpec): boolean {
  const comparable = (spec: PartSpec) =>
    JSON.stringify(
      Object.entries(spec)
        .filter(([key]) => key !== 'closed' && key !== 'pressed' && key !== 'light')
        .sort(([x], [y]) => x.localeCompare(y)),
    );
  return comparable(a) === comparable(b);
}
