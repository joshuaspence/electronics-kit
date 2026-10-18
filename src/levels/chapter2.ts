import type { Board, Location, PartSpec, PlacedPart } from '../core/build';
import type { TerminalRow } from '../core/breadboard';
import { newSpec } from '../core/catalogue';
import type { Level } from '../core/levels';

// Chapter 2: switches and buttons, on a mini breadboard whose columns are joined strips
// (docs/design.md §3, §5).

const board: Board = {
  kind: 'breadboard',
  layout: { columns: 10, centreGap: false, rails: false },
};
const hole = (row: TerminalRow, column: number): Location => ({ kind: 'terminal', row, column });

function part(
  id: string,
  kind: PartSpec['kind'],
  from: Location,
  to: Location,
  fixed = false,
): PlacedPart {
  return { id, spec: newSpec(kind), at: [from, to], fixed };
}

// The battery's legs are in columns 1 and 3, so everything in those columns is joined to it.
const battery = part('battery', 'battery', hole('a', 1), hole('a', 3), true);

export const chapter2: readonly Level[] = [
  {
    id: 'strips-1',
    chapter: 2,
    board,
    parts: [battery],
    goal: { kind: 'light-bulbs', bulbs: 1 },
    tray: [
      { kind: 'bulb', count: 1 },
      { kind: 'wire', count: 2 },
    ],
    par: 1,
    // Legs in the battery's two columns: the strips do the wiring.
    solution: { place: [part('b', 'bulb', hole('e', 1), hole('e', 3))] },
  },
  {
    id: 'strips-2',
    chapter: 2,
    board,
    // Both legs in column 6: the strip joins them, so electricity goes around the bulb, not
    // through it.
    parts: [battery, part('bulb', 'bulb', hole('d', 6), hole('f', 6))],
    goal: { kind: 'light-bulbs', bulbs: 1 },
    tray: [
      { kind: 'bulb', count: 1 },
      { kind: 'wire', count: 3 },
    ],
    par: 1,
    solution: { remove: ['bulb'], place: [part('b', 'bulb', hole('e', 1), hole('e', 3))] },
  },
  {
    id: 'switch-1',
    chapter: 2,
    board,
    parts: [battery],
    goal: { kind: 'control-bulbs', bulbs: 1 },
    tray: [
      { kind: 'bulb', count: 1 },
      { kind: 'switch', count: 1 },
      { kind: 'wire', count: 3 },
    ],
    par: 3,
    solution: {
      place: [
        part('s', 'switch', hole('e', 3), hole('e', 5)),
        part('b', 'bulb', hole('f', 5), hole('f', 7)),
        part('w', 'wire', hole('j', 7), hole('j', 1)),
      ],
    },
  },
  {
    id: 'button-1',
    chapter: 2,
    board,
    parts: [battery],
    goal: { kind: 'control-bulbs', bulbs: 1 },
    tray: [
      { kind: 'bulb', count: 1 },
      { kind: 'button', count: 1 },
      { kind: 'wire', count: 3 },
    ],
    par: 3,
    solution: {
      place: [
        part('p', 'button', hole('e', 3), hole('e', 5)),
        part('b', 'bulb', hole('f', 5), hole('f', 7)),
        part('w', 'wire', hole('j', 7), hole('j', 1)),
      ],
    },
  },
  {
    id: 'switch-2',
    chapter: 2,
    board,
    parts: [battery],
    goal: { kind: 'control-bulbs', bulbs: 2 },
    tray: [
      { kind: 'bulb', count: 2 },
      { kind: 'switch', count: 1 },
      { kind: 'wire', count: 4 },
    ],
    par: 4,
    // One switch in the only loop controls everything in it.
    solution: {
      place: [
        part('s', 'switch', hole('e', 3), hole('e', 5)),
        part('b1', 'bulb', hole('f', 5), hole('f', 7)),
        part('b2', 'bulb', hole('g', 7), hole('g', 9)),
        part('w', 'wire', hole('j', 9), hole('j', 1)),
      ],
    },
  },
];
