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
    goal: { kind: 'light-up', lights: 1 },
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
    // Both legs in column 1, the battery's + column: they are joined to the same end of the
    // battery, so there is nothing to push electricity through the bulb.
    parts: [battery, part('bulb', 'bulb', hole('d', 1), hole('f', 1))],
    goal: { kind: 'light-up', lights: 1 },
    tray: [
      { kind: 'bulb', count: 1 },
      { kind: 'wire', count: 3 },
    ],
    par: 1,
    solution: { remove: ['bulb'], place: [part('b', 'bulb', hole('e', 1), hole('e', 3))] },
  },
  {
    id: 'strips-3',
    chapter: 2,
    board,
    // The wire from the battery's column 1 lands in column 4, one short of the bulb's column 5.
    parts: [
      battery,
      part('bulb', 'bulb', hole('f', 5), hole('f', 7), true),
      part('back', 'wire', hole('j', 7), hole('j', 3), true),
      part('off', 'wire', hole('h', 1), hole('h', 4)),
    ],
    goal: { kind: 'light-up', lights: 1 },
    tray: [{ kind: 'wire', count: 1 }],
    par: 1,
    solution: { remove: ['off'], place: [part('w', 'wire', hole('h', 1), hole('h', 5))] },
  },
  {
    id: 'switch-1',
    chapter: 2,
    board,
    parts: [battery],
    goal: { kind: 'control-lights', lights: 1 },
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
    goal: { kind: 'control-lights', lights: 1 },
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
    goal: { kind: 'control-lights', lights: 2 },
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
  {
    id: 'switch-3',
    chapter: 2,
    board,
    // The bulb is lit through the wire, while the switch sits off in columns 7 and 9, joined to
    // nothing: flicking it changes nothing until it takes the wire's place in the loop.
    parts: [
      battery,
      part('bulb', 'bulb', hole('f', 3), hole('f', 5), true),
      part('wire', 'wire', hole('j', 5), hole('j', 1)),
      part('switch', 'switch', hole('e', 7), hole('e', 9)),
    ],
    goal: { kind: 'control-lights', lights: 1 },
    tray: [
      { kind: 'switch', count: 1 },
      { kind: 'wire', count: 1 },
    ],
    par: 1,
    solution: {
      remove: ['wire', 'switch'],
      place: [part('s', 'switch', hole('e', 1), hole('e', 5))],
    },
  },
  {
    id: 'switch-4',
    chapter: 2,
    board,
    parts: [battery],
    goal: { kind: 'every-control', lights: 1 },
    tray: [
      { kind: 'bulb', count: 1 },
      { kind: 'switch', count: 2 },
      { kind: 'wire', count: 3 },
    ],
    par: 4,
    // Switches rather than buttons, so a mouse or touchpad can have both on at once. In the one
    // loop, one after the other, either switch off makes a gap.
    solution: {
      place: [
        part('s1', 'switch', hole('e', 3), hole('e', 5)),
        part('s2', 'switch', hole('f', 5), hole('f', 7)),
        part('b', 'bulb', hole('g', 7), hole('g', 9)),
        part('w', 'wire', hole('j', 9), hole('j', 1)),
      ],
    },
  },
];
