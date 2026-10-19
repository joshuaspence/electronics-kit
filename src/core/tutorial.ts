import type { Build, PlacedPart } from './build';
import { toCircuit } from './build';
import { hintFor } from './hints';
import { checkGoal, type Level } from './levels';

/**
 * The guided tutorial (docs/design.md §6): on a level marked `tutorial`, Volty walks a child
 * through its solution one step at a time, showing where each part goes. It is worked out afresh
 * from the build after every change, so a child who goes their own way is guided back from
 * wherever they are, and any circuit that meets the goal finishes it.
 */
export type TutorialStep =
  /** Place this part where it is shown. `wiresPlaced` tells the first wire from the next. */
  | { readonly kind: 'place'; readonly part: PlacedPart; readonly wiresPlaced: number }
  /** This part is in the way of the solution: take it away (or Undo). */
  | { readonly kind: 'remove'; readonly part: PlacedPart }
  /** Every part is in place but the goal isn't met yet, such as a switch still off. */
  | { readonly kind: 'try-it' }
  /** The goal is met. */
  | { readonly kind: 'done' };

export function tutorialStep(level: Level, build: Build): TutorialStep {
  if (checkGoal(level.goal, toCircuit(level.board, build)).met) {
    return { kind: 'done' };
  }
  // Past the first nudge, a hint is one step of the solution: the same steps the tutorial shows.
  const hint = hintFor(level, build, 1);
  switch (hint.kind) {
    case 'show-part': {
      const placed = new Set(level.parts.map((part) => part.id));
      const wiresPlaced = build.parts.filter(
        (part) => part.spec.kind === 'wire' && !placed.has(part.id),
      ).length;
      return { kind: 'place', part: hint.part, wiresPlaced };
    }
    case 'remove-part':
      return { kind: 'remove', part: hint.part };
    case 'nudge':
      return { kind: 'try-it' };
  }
}
