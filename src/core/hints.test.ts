import { describe, expect, it } from 'vitest';
import type { Build, PlacedPart } from './build';
import { hintFor } from './hints';
import type { Level } from './levels';

const post = (row: number, column: number) => ({ kind: 'snap', row, column }) as const;
const part = (
  id: string,
  kind: 'battery' | 'bulb' | 'wire' | 'switch',
  at: PlacedPart['at'],
): PlacedPart => {
  const spec =
    kind === 'battery'
      ? ({ kind, volts: 3, internalOhms: 0.5 } as const)
      : kind === 'bulb'
        ? ({ kind, ohms: 10, ratedWatts: 0.5 } as const)
        : kind === 'switch'
          ? ({ kind, closed: false } as const)
          : ({ kind } as const);
  return { id, spec, at, fixed: kind === 'battery' };
};

const battery = part('battery', 'battery', [post(1, 1), post(1, 2)]);
const shortWire = part('short', 'wire', [post(1, 1), post(1, 2)]);
const level: Level = {
  id: 'test',
  chapter: 1,
  board: { kind: 'snap', rows: 2, columns: 3 },
  parts: [battery, shortWire],
  goal: { kind: 'light-bulbs', bulbs: 1 },
  tray: [
    { kind: 'bulb', count: 1 },
    { kind: 'wire', count: 3 },
  ],
  par: 3,
  solution: {
    remove: ['short'],
    place: [
      part('b', 'bulb', [post(2, 1), post(2, 2)]),
      part('w1', 'wire', [post(1, 1), post(2, 1)]),
      part('w2', 'wire', [post(1, 2), post(2, 2)]),
    ],
  },
};
const start: Build = { parts: level.parts };

describe('hintFor', () => {
  it('starts with a nudge that says what is wrong', () => {
    expect(hintFor(level, start, 0)).toEqual({ kind: 'nudge', reason: 'short-circuit' });
    const noShort = { parts: [battery] };
    expect(hintFor(level, noShort, 0)).toEqual({ kind: 'nudge', reason: 'too-few-lit' });
  });

  it('then shows the solution a step at a time, removals first', () => {
    expect(hintFor(level, start, 1)).toEqual({ kind: 'remove-part', part: shortWire });
    expect(hintFor(level, { parts: [battery] }, 2)).toEqual({
      kind: 'show-part',
      part: level.solution.place[0],
    });
  });

  it('skips parts already in place, either way round, whatever their id', () => {
    const withBulb = { parts: [battery, part('my-bulb', 'bulb', [post(2, 2), post(2, 1)])] };
    expect(hintFor(level, withBulb, 1)).toEqual({
      kind: 'show-part',
      part: level.solution.place[1],
    });
  });

  it('nudges to switch on a circuit that only needs switching on', () => {
    const switchLevel: Level = {
      ...level,
      parts: [battery],
      goal: { kind: 'control-bulbs', bulbs: 1 },
      solution: { place: [] },
    };
    const build = {
      parts: [
        battery,
        part('s', 'switch', [post(1, 2), post(2, 2)]),
        part('b', 'bulb', [post(2, 2), post(2, 1)]),
        part('w', 'wire', [post(2, 1), post(1, 1)]),
      ],
    };
    expect(hintFor(switchLevel, build, 0)).toEqual({ kind: 'nudge', reason: 'switch-off' });
    // With nothing left to show, later hints nudge too.
    expect(hintFor(switchLevel, build, 3)).toEqual({ kind: 'nudge', reason: 'switch-off' });
  });
});
