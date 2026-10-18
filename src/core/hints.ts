import { type Build, locationKey, type PlacedPart, toCircuit } from './build';
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
 * The hint for the child's `step`th request (0 for the first) on this build. Later steps show the
 * next part of the solution the build doesn't have yet: first a starting part to take away, then a
 * part to place. Once the build has every solution part, it nudges again.
 */
export function hintFor(level: Level, build: Build, step: number): Hint {
  if (step > 0) {
    const toRemove = (level.solution.remove ?? [])
      .map((id) => build.parts.find((p) => p.id === id))
      .find((part) => part !== undefined);
    if (toRemove) {
      return { kind: 'remove-part', part: toRemove };
    }
    const toPlace = level.solution.place.find(
      (part) => !build.parts.some((p) => samePlace(p, part)),
    );
    if (toPlace) {
      return { kind: 'show-part', part: toPlace };
    }
  }
  const circuit = toCircuit(level.board, build);
  const result = checkGoal(level.goal, circuit);
  if (!result.met) {
    return { kind: 'nudge', reason: result.reason };
  }
  return {
    kind: 'nudge',
    reason: litNow(circuit) < level.goal.bulbs ? 'switch-off' : 'too-few-lit',
  };
}

/** The same kind of part with its legs in the same two places, either way round. */
function samePlace(a: PlacedPart, b: PlacedPart): boolean {
  if (a.spec.kind !== b.spec.kind) {
    return false;
  }
  const [a0, a1] = a.at.map(locationKey);
  const [b0, b1] = b.at.map(locationKey);
  return (a0 === b0 && a1 === b1) || (a0 === b1 && a1 === b0);
}
