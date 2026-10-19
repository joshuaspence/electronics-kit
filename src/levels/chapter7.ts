import type { Level } from '../core/levels';
import { battery, halfBoard as board, hole, part, rail } from './halfBoard';

// Chapter 7: inputs and outputs (docs/design.md §3). Buzzers and motors work like bulbs that make
// a sound or turn, and switches, buttons and light sensors control them the same way.

/**
 * A loop from the + rail through a control in columns 3 to 5 and an output in 5 to 7, back to the
 * − rail.
 */
const loop = (
  control: 'switch' | 'button' | 'light-sensor',
  output: 'buzzer' | 'motor' | 'bulb',
) => [
  part('w1', 'wire', rail('top+', 3), hole('a', 3)),
  part('c', control, hole('b', 3), hole('b', 5)),
  part('o', output, hole('c', 5), hole('c', 7)),
  part('w2', 'wire', hole('a', 7), rail('top-', 7)),
];

export const chapter7: readonly Level[] = [
  {
    id: 'out-1',
    chapter: 7,
    board,
    parts: [battery],
    goal: { kind: 'control-lights', lights: 1 },
    tray: [
      { kind: 'button', count: 1 },
      { kind: 'buzzer', count: 1 },
      { kind: 'wire', count: 2 },
    ],
    par: 4,
    solution: { place: loop('button', 'buzzer') },
  },
  {
    id: 'out-2',
    chapter: 7,
    board,
    parts: [battery],
    goal: { kind: 'control-lights', lights: 1 },
    tray: [
      { kind: 'switch', count: 1 },
      { kind: 'motor', count: 1 },
      { kind: 'wire', count: 2 },
    ],
    par: 4,
    solution: { place: loop('switch', 'motor') },
  },
  {
    id: 'out-3',
    chapter: 7,
    board,
    parts: [battery],
    // Side by side after the switch, so one switch controls both and each gets the whole push.
    goal: { kind: 'control-lights', lights: 2 },
    tray: [
      { kind: 'switch', count: 1 },
      { kind: 'bulb', count: 1 },
      { kind: 'buzzer', count: 1 },
      { kind: 'wire', count: 2 },
    ],
    par: 5,
    solution: {
      place: [...loop('switch', 'buzzer'), part('bulb', 'bulb', hole('d', 5), hole('d', 7))],
    },
  },
  {
    id: 'out-4',
    chapter: 7,
    board,
    parts: [battery],
    // A light sensor counts as a control: lit in full light, dark in the dark.
    goal: { kind: 'control-lights', lights: 1 },
    tray: [
      { kind: 'light-sensor', count: 1 },
      { kind: 'bulb', count: 1 },
      { kind: 'wire', count: 2 },
    ],
    par: 4,
    solution: { place: loop('light-sensor', 'bulb') },
  },
  {
    id: 'out-5',
    chapter: 7,
    board,
    parts: [battery],
    goal: { kind: 'control-lights', lights: 1 },
    tray: [
      { kind: 'light-sensor', count: 1 },
      { kind: 'buzzer', count: 1 },
      { kind: 'wire', count: 2 },
    ],
    par: 4,
    solution: { place: loop('light-sensor', 'buzzer') },
  },
  {
    id: 'out-6',
    chapter: 7,
    board,
    parts: [battery],
    // The capacitor beside the bulb, after the button: it charges while the button is held, then
    // keeps the bulb glowing, fading, once it is let go.
    goal: { kind: 'keep-glowing', lights: 1, seconds: 1 },
    tray: [
      { kind: 'button', count: 1 },
      { kind: 'bulb', count: 1 },
      { kind: 'capacitor', count: 1 },
      { kind: 'wire', count: 2 },
    ],
    par: 5,
    solution: {
      place: [...loop('button', 'bulb'), part('cap', 'capacitor', hole('d', 5), hole('d', 7))],
    },
  },
];
