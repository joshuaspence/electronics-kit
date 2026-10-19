import type { Level } from '../core/levels';
import { battery, halfBoard as board, hole, part, rail } from './halfBoard';

// Chapter 3: series and parallel (docs/design.md §3).

export const chapter3: readonly Level[] = [
  {
    id: 'pair-1',
    chapter: 3,
    board,
    parts: [battery],
    goal: { kind: 'light-up', lights: 2, bright: true },
    tray: [
      { kind: 'bulb', count: 2 },
      { kind: 'wire', count: 4 },
    ],
    par: 4,
    // Both bulbs from column 3 to column 5: side by side, each gets the battery's whole push.
    solution: {
      place: [
        part('plus', 'wire', rail('top+', 3), hole('a', 3)),
        part('b1', 'bulb', hole('b', 3), hole('b', 5)),
        part('b2', 'bulb', hole('d', 3), hole('d', 5)),
        part('minus', 'wire', hole('e', 5), rail('top-', 5)),
      ],
    },
  },
  {
    id: 'pair-2',
    chapter: 3,
    board,
    parts: [battery],
    goal: { kind: 'light-up', lights: 3 },
    tray: [
      { kind: 'bulb', count: 3 },
      { kind: 'wire', count: 4 },
    ],
    par: 5,
    // Three in a row share the push so thinly that none lights; side by side, all three do.
    solution: {
      place: [
        part('plus', 'wire', rail('top+', 3), hole('a', 3)),
        part('b1', 'bulb', hole('b', 3), hole('b', 5)),
        part('b2', 'bulb', hole('c', 3), hole('c', 5)),
        part('b3', 'bulb', hole('d', 3), hole('d', 5)),
        part('minus', 'wire', hole('e', 5), rail('top-', 5)),
      ],
    },
  },
  {
    id: 'pair-3',
    chapter: 3,
    board,
    // Two bulbs one after the other, from column 3 through 5 to 7: lit, but dim.
    parts: [
      battery,
      part('plus', 'wire', rail('top+', 3), hole('a', 3), true),
      part('b1', 'bulb', hole('b', 3), hole('b', 5)),
      part('b2', 'bulb', hole('c', 5), hole('c', 7)),
      part('minus', 'wire', hole('d', 7), rail('top-', 7), true),
    ],
    goal: { kind: 'light-up', lights: 2, bright: true },
    tray: [
      { kind: 'bulb', count: 2 },
      { kind: 'wire', count: 1 },
    ],
    par: 2,
    // Moving the second bulb beside the first and joining column 5 to − puts them side by side.
    solution: {
      remove: ['b2'],
      place: [
        part('b', 'bulb', hole('c', 3), hole('c', 5)),
        part('w', 'wire', hole('e', 5), rail('top-', 5)),
      ],
    },
  },
];
