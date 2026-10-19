import type { Board, Location, PartSpec, PlacedPart } from '../core/build';
import type { Rail, TerminalRow } from '../core/breadboard';
import { newSpec } from '../core/catalogue';
import type { Level } from '../core/levels';

// Chapter 3: series and parallel, on a slice of a half-size board with rails (docs/design.md §3,
// §5). Fifteen columns keep the holes a comfortable size on a tablet.

const board: Board = {
  kind: 'breadboard',
  layout: { columns: 15, centreGap: true, rails: true },
};
const hole = (row: TerminalRow, column: number): Location => ({ kind: 'terminal', row, column });
const rail = (name: Rail, position: number): Location => ({ kind: 'rail', rail: name, position });

function part(
  id: string,
  kind: PartSpec['kind'],
  from: Location,
  to: Location,
  fixed = false,
): PlacedPart {
  return { id, spec: newSpec(kind), at: [from, to], fixed };
}

// The battery is plugged into the top rails, so the + rail and − rail run the length of the board.
const battery = part('battery', 'battery', rail('top+', 1), rail('top-', 1), true);

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
