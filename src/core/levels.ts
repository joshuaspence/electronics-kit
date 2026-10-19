import type { Board, PlacedPart } from './build';
import { type Circuit, type Part, type PartKind } from './circuit';
import { bulbBrightness, isShorted, solveDc } from './dc';

/** A bulb counts as lit at a quarter of full brightness or more. */
export const LIT_BRIGHTNESS = 0.25;

/**
 * What a level asks for. Goals are checked against the simulated circuit, never a fixed layout,
 * so any correct circuit wins (docs/design.md §3). No goal is met while a battery is shorted.
 */
export type Goal =
  /** At least `bulbs` bulbs are lit with every switch closed and every button pressed. */
  | { readonly kind: 'light-bulbs'; readonly bulbs: number }
  /**
   * At least `bulbs` bulbs are lit with every switch closed and every button pressed, and none is
   * lit with every switch open and every button released. The circuit needs a switch or button.
   */
  | { readonly kind: 'control-bulbs'; readonly bulbs: number }
  /**
   * As `control-bulbs`, and also none is lit with any one switch open or button released and the
   * rest on: the bulbs need every control at once.
   */
  | { readonly kind: 'every-control'; readonly bulbs: number };

export interface PartAllowance {
  readonly kind: PartKind;
  readonly count: number;
}

export interface Level {
  readonly id: string;
  readonly chapter: number;
  readonly board: Board;
  /**
   * Parts on the board when the level starts: fixed ones (usually the battery) can't be moved, and
   * others count against the tray as if the child had placed them.
   */
  readonly parts: readonly PlacedPart[];
  readonly goal: Goal;
  /** The parts the child may place, on top of any the level places for them. */
  readonly tray: readonly PartAllowance[];
  /** The fewest parts the child needs to place; placing no more earns a star. */
  readonly par: number;
  /**
   * One way to finish at par: the parts the child places, on top of the starting ones they keep.
   * Tests check that every level can be finished this way; hints can show its parts.
   */
  readonly solution: Solution;
}

export interface Solution {
  /** Ids of starting parts the child removes. */
  readonly remove?: readonly string[];
  readonly place: readonly PlacedPart[];
}

export type GoalResult =
  { readonly met: true } | { readonly met: false; readonly reason: GoalFailure };

/** Why a goal is not met, so hints can say something useful. */
export type GoalFailure =
  'short-circuit' | 'too-few-lit' | 'not-controlled' | 'no-control' | 'not-every-control';

export function checkGoal(goal: Goal, circuit: Circuit): GoalResult {
  const on = withControls(circuit, true);
  const onResult = litBulbs(on);
  if (onResult.shorted) {
    return { met: false, reason: 'short-circuit' };
  }
  if (onResult.lit < goal.bulbs) {
    return { met: false, reason: 'too-few-lit' };
  }

  switch (goal.kind) {
    case 'light-bulbs':
      return { met: true };
    case 'control-bulbs':
    case 'every-control': {
      const controls = circuit.parts.filter(isControl);
      if (controls.length === 0) {
        return { met: false, reason: 'no-control' };
      }
      const offs: [Circuit, GoalFailure][] = [[withControls(circuit, false), 'not-controlled']];
      if (goal.kind === 'every-control') {
        for (const control of controls) {
          offs.push([withControls(circuit, true, control.id), 'not-every-control']);
        }
      }
      for (const [off, failure] of offs) {
        const offResult = litBulbs(off);
        if (offResult.shorted) {
          return { met: false, reason: 'short-circuit' };
        }
        if (offResult.lit > 0) {
          return { met: false, reason: failure };
        }
      }
      return { met: true };
    }
  }
}

function isControl(part: Part): boolean {
  return part.kind === 'switch' || part.kind === 'button';
}

/**
 * How many bulbs are lit with every switch and button as the child left them. A level finishes only
 * when its goal is met and this many bulbs are glowing, so the child sees the light come on.
 */
export function litNow(circuit: Circuit): number {
  const { lit, shorted } = litBulbs(circuit);
  return shorted ? 0 : lit;
}

/**
 * Stars for a finished level, 1 to 3: one for finishing, one for placing no more than par parts
 * and one for using no hints. Speed never counts.
 */
export function starsFor(level: Level, partsPlaced: number, hintsUsed: number): 1 | 2 | 3 {
  const stars = 1 + (partsPlaced <= level.par ? 1 : 0) + (hintsUsed === 0 ? 1 : 0);
  return stars as 1 | 2 | 3;
}

/**
 * Every switch closed and button pressed (`on`), or every switch open and button released, except
 * the control with id `except`, which is set the other way.
 */
function withControls(circuit: Circuit, on: boolean, except?: string): Circuit {
  return {
    parts: circuit.parts.map((part): Part => {
      const state = part.id === except ? !on : on;
      switch (part.kind) {
        case 'switch':
          return { ...part, closed: state };
        case 'button':
          return { ...part, pressed: state };
        default:
          return part;
      }
    }),
  };
}

function litBulbs(circuit: Circuit): { lit: number; shorted: boolean } {
  const solution = solveDc(circuit);
  let lit = 0;
  let shorted = false;
  for (const part of circuit.parts) {
    const reading = solution.parts.get(part.id)!;
    if (part.kind === 'bulb' && bulbBrightness(part, reading) >= LIT_BRIGHTNESS) {
      lit++;
    } else if (part.kind === 'battery' && isShorted(part, reading)) {
      shorted = true;
    }
  }
  return { lit, shorted };
}
