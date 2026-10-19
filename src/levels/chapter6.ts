import type { Level } from '../core/levels';
import { battery, halfBoard as board, hole, part, rail } from './halfBoard';

// Chapter 6: short circuits (docs/design.md §3). Each level has a bulb's path from the + rail to
// the − rail and something that gives the electricity an easier way round: a wire across the
// rails, a wire beside the bulb, a switch beside the bulb.

/** The bulb's path: + rail into column 3, and column `to` back to the − rail. */
const pathWires = (to: number) => [
  part('plus', 'wire', rail('top+', 3), hole('a', 3), true),
  part('minus', 'wire', hole('a', to), rail('top-', to), true),
];

export const chapter6: readonly Level[] = [
  {
    id: 'short-1',
    chapter: 6,
    board,
    // A wire straight from the + rail to the − rail, far from the bulb's path.
    parts: [battery, ...pathWires(5), part('short', 'wire', rail('top+', 11), rail('top-', 11))],
    goal: { kind: 'light-up', lights: 1 },
    tray: [
      { kind: 'bulb', count: 1 },
      { kind: 'wire', count: 1 },
    ],
    par: 1,
    solution: { remove: ['short'], place: [part('b', 'bulb', hole('c', 3), hole('c', 5))] },
  },
  {
    id: 'short-2',
    chapter: 6,
    board,
    // The bulb is in its path, but a wire joins its two columns, so the electricity goes round it.
    parts: [
      battery,
      ...pathWires(5),
      part('bulb', 'bulb', hole('c', 3), hole('c', 5), true),
      part('round', 'wire', hole('e', 3), hole('e', 5)),
    ],
    goal: { kind: 'light-up', lights: 1 },
    tray: [{ kind: 'wire', count: 1 }],
    par: 0,
    solution: { remove: ['round'], place: [] },
  },
  {
    id: 'short-3',
    chapter: 6,
    board,
    // The bulb is lit through the wire from column 3 to 5, and the switch sits beside the bulb:
    // switched on, it shorts the battery. It has to take the wire's place, in the bulb's path.
    parts: [
      battery,
      ...pathWires(7),
      part('bulb', 'bulb', hole('c', 5), hole('c', 7), true),
      part('wire', 'wire', hole('b', 3), hole('b', 5)),
      part('switch', 'switch', hole('e', 5), hole('e', 7)),
    ],
    goal: { kind: 'control-lights', lights: 1 },
    tray: [
      { kind: 'switch', count: 1 },
      { kind: 'wire', count: 1 },
    ],
    par: 1,
    solution: {
      remove: ['wire', 'switch'],
      place: [part('s', 'switch', hole('e', 3), hole('e', 5))],
    },
  },
];
