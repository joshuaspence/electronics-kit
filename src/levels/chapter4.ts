import type { Level } from '../core/levels';
import { battery, halfBoard as board, hole, part, rail } from './halfBoard';

// Chapter 4: LEDs and polarity (docs/design.md §3). Each LED's path already has a resistor in it,
// since without one an LED pops; why it needs one is chapter 5.

// From the + rail into column 3, a resistor from 3 to 6, and a wire from column 8 back to the −
// rail: an LED from 6 to 8 completes it, its long leg (anode) on column 6.
const ledPath = [
  part('plus', 'wire', rail('top+', 3), hole('a', 3), true),
  part('r', 'resistor', hole('b', 3), hole('b', 6), true),
  part('minus', 'wire', hole('d', 8), rail('top-', 8), true),
];
const forwards = part('led', 'led', hole('c', 6), hole('c', 8));
const backwards = part('led', 'led', hole('c', 8), hole('c', 6));

export const chapter4: readonly Level[] = [
  {
    id: 'led-1',
    chapter: 4,
    board,
    parts: [battery, ...ledPath],
    goal: { kind: 'light-up', lights: 1 },
    tray: [{ kind: 'led', count: 1 }],
    par: 1,
    solution: { place: [forwards] },
  },
  {
    id: 'led-2',
    chapter: 4,
    board,
    parts: [battery, ...ledPath, backwards],
    goal: { kind: 'light-up', lights: 1 },
    tray: [{ kind: 'led', count: 1 }],
    par: 1,
    solution: { remove: ['led'], place: [{ ...forwards, id: 'turned' }] },
  },
  {
    id: 'led-3',
    chapter: 4,
    board,
    // A bulb from column 12 to 10 and an LED from 8 to 6, both "backwards": only the LED minds.
    parts: [
      battery,
      ...ledPath,
      backwards,
      part('bulb-plus', 'wire', rail('top+', 10), hole('a', 10), true),
      part('bulb', 'bulb', hole('b', 12), hole('b', 10)),
      part('bulb-minus', 'wire', hole('c', 12), rail('top-', 12), true),
    ],
    goal: { kind: 'light-up', lights: 2 },
    tray: [
      { kind: 'led', count: 1 },
      { kind: 'bulb', count: 1 },
    ],
    par: 1,
    solution: { remove: ['led'], place: [{ ...forwards, id: 'turned' }] },
  },
];
