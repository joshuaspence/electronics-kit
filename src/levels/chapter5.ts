import type { Level } from '../core/levels';
import { battery, halfBoard as board, hole, part, rail } from './halfBoard';

// Chapter 5: resistors, and why LEDs need them (docs/design.md §3). Each path runs from the +
// rail into a column, through a resistor and an LED, and back to the − rail; without the
// resistor, the LED pops.

/** A path's fixed wires: + rail into column `from`, and column `from + 5` back to the − rail. */
const pathWires = (id: string, from: number) => [
  part(`${id}-plus`, 'wire', rail('top+', from), hole('a', from), true),
  part(`${id}-minus`, 'wire', hole('d', from + 5), rail('top-', from + 5), true),
];

/** The resistor and LED that complete a path: resistor from `from` to `from + 3`, then the LED. */
const pathParts = (id: string, from: number) => [
  part(`${id}-r`, 'resistor', hole('b', from), hole('b', from + 3)),
  part(`${id}-led`, 'led', hole('c', from + 3), hole('c', from + 5)),
];

export const chapter5: readonly Level[] = [
  {
    id: 'res-1',
    chapter: 5,
    board,
    parts: [battery, ...pathWires('a', 3)],
    goal: { kind: 'light-up', lights: 1 },
    // The wire is the tempting shortcut: with it in place of the resistor, the LED pops.
    tray: [
      { kind: 'led', count: 1 },
      { kind: 'resistor', count: 1 },
      { kind: 'wire', count: 1 },
    ],
    par: 2,
    solution: { place: pathParts('a', 3) },
  },
  {
    id: 'res-2',
    chapter: 5,
    board,
    parts: [battery, ...pathWires('a', 3), ...pathWires('b', 9)],
    goal: { kind: 'light-up', lights: 2 },
    tray: [
      { kind: 'led', count: 2 },
      { kind: 'resistor', count: 2 },
    ],
    par: 4,
    solution: { place: [...pathParts('a', 3), ...pathParts('b', 9)] },
  },
  {
    id: 'res-3',
    chapter: 5,
    board,
    // A 10 Ω resistor is too little: the LED behind it would take 49 mA and pop. The tray's
    // resistor is the kit's 100 Ω, which the child tells apart by its bands.
    parts: [
      battery,
      ...pathWires('a', 3),
      {
        id: 'small',
        spec: { kind: 'resistor', ohms: 10 },
        at: [hole('b', 3), hole('b', 6)],
        fixed: false,
      },
    ],
    goal: { kind: 'light-up', lights: 1 },
    tray: [
      { kind: 'led', count: 1 },
      { kind: 'resistor', count: 1 },
    ],
    par: 2,
    solution: { remove: ['small'], place: pathParts('a', 3) },
  },
];
