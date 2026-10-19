import type { Location, PartSpec, PlacedPart } from '../core/build';
import { newSpec } from '../core/catalogue';
import type { Level } from '../core/levels';

// Chapter 1: a complete loop, on a snap board (docs/design.md §3, §5).

const post = (row: number, column: number): Location => ({ kind: 'snap', row, column });

function part(id: string, spec: PartSpec, from: Location, to: Location, fixed = false): PlacedPart {
  return { id, spec, at: [from, to], fixed };
}

const battery = part('battery', newSpec('battery'), post(1, 1), post(1, 2), true);
const wire = (id: string, from: Location, to: Location, fixed = false) =>
  part(id, newSpec('wire'), from, to, fixed);
const bulb = (id: string, from: Location, to: Location, fixed = false) =>
  part(id, newSpec('bulb'), from, to, fixed);

export const chapter1: readonly Level[] = [
  {
    id: 'loop-1',
    chapter: 1,
    board: { kind: 'snap', rows: 2, columns: 3 },
    parts: [battery],
    goal: { kind: 'light-up', lights: 1 },
    tray: [
      { kind: 'bulb', count: 1 },
      { kind: 'wire', count: 2 },
    ],
    par: 3,
    solution: {
      place: [
        bulb('b', post(2, 1), post(2, 2)),
        wire('w1', post(1, 1), post(2, 1)),
        wire('w2', post(1, 2), post(2, 2)),
      ],
    },
  },
  {
    id: 'loop-2',
    chapter: 1,
    board: { kind: 'snap', rows: 3, columns: 4 },
    parts: [battery, bulb('bulb', post(3, 3), post(3, 4), true)],
    goal: { kind: 'light-up', lights: 1 },
    tray: [{ kind: 'wire', count: 4 }],
    par: 2,
    solution: {
      place: [wire('w1', post(1, 1), post(3, 3)), wire('w2', post(1, 2), post(3, 4))],
    },
  },
  {
    id: 'loop-3',
    chapter: 1,
    board: { kind: 'snap', rows: 3, columns: 4 },
    parts: [
      battery,
      bulb('bulb', post(2, 3), post(2, 4), true),
      wire('wire', post(1, 2), post(2, 3), true),
    ],
    goal: { kind: 'light-up', lights: 1 },
    tray: [{ kind: 'wire', count: 1 }],
    par: 1,
    solution: { place: [wire('w', post(1, 1), post(2, 4))] },
  },
  {
    id: 'loop-4',
    chapter: 1,
    board: { kind: 'snap', rows: 3, columns: 4 },
    parts: [battery],
    goal: { kind: 'light-up', lights: 2 },
    tray: [
      { kind: 'bulb', count: 2 },
      { kind: 'wire', count: 4 },
    ],
    par: 4,
    solution: {
      // Both bulbs in one loop: each gets half the battery, still bright enough to count as lit.
      place: [
        bulb('b1', post(2, 1), post(2, 2)),
        bulb('b2', post(2, 2), post(2, 3)),
        wire('w1', post(1, 1), post(2, 1)),
        wire('w2', post(1, 2), post(2, 3)),
      ],
    },
  },
  {
    id: 'loop-5',
    chapter: 1,
    board: { kind: 'snap', rows: 3, columns: 4 },
    // Two wires already join the battery's posts through post 2-1: a short circuit to undo.
    parts: [
      battery,
      bulb('bulb', post(3, 3), post(3, 4), true),
      wire('short-1', post(1, 1), post(2, 1)),
      wire('short-2', post(2, 1), post(1, 2)),
    ],
    goal: { kind: 'light-up', lights: 1 },
    tray: [{ kind: 'wire', count: 4 }],
    par: 2,
    solution: {
      remove: ['short-2'],
      place: [wire('w1', post(2, 1), post(3, 3)), wire('w2', post(1, 2), post(3, 4))],
    },
  },
  {
    id: 'loop-6',
    chapter: 1,
    board: { kind: 'snap', rows: 3, columns: 4 },
    // One gap on each side of the bulb: closing just one still lights nothing.
    parts: [
      battery,
      bulb('bulb', post(3, 3), post(3, 4), true),
      wire('plus', post(1, 1), post(2, 1), true),
      wire('minus', post(1, 2), post(2, 4), true),
    ],
    goal: { kind: 'light-up', lights: 1 },
    tray: [{ kind: 'wire', count: 2 }],
    par: 2,
    solution: {
      place: [wire('w1', post(2, 1), post(3, 3)), wire('w2', post(2, 4), post(3, 4))],
    },
  },
];
