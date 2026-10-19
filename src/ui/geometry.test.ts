import { describe, expect, it } from 'vitest';
import type { Location } from '../core/build';
import { geometryFor, quarterTurn, turned } from './geometry';

const geometry = geometryFor({
  kind: 'breadboard',
  layout: { columns: 10, centreGap: false, rails: false },
});
const hole = (name: string): Location => {
  const location = geometry.locations.find((l) => geometry.name(l) === name);
  if (!location) {
    throw new Error(`No hole ${name}`);
  }
  return location;
};
const names = (at: readonly [Location, Location] | null) => at?.map((l) => geometry.name(l));

describe('quarterTurn', () => {
  it('turns a part about its middle', () => {
    expect(names(quarterTurn(geometry, [hole('e3'), hole('e5')]))).toEqual(['d4', 'f4']);
  });

  it('swaps a part’s legs after two turns, so an LED can be turned round', () => {
    const once = quarterTurn(geometry, [hole('e3'), hole('e5')])!;
    expect(names(quarterTurn(geometry, once))).toEqual(['e5', 'e3']);
  });

  it('brings a part back after four turns, even when its middle falls between holes', () => {
    for (const start of [
      [hole('e3'), hole('e5')],
      [hole('e3'), hole('e6')],
    ] as const) {
      let at: readonly [Location, Location] = start;
      for (let i = 0; i < 4; i++) {
        at = quarterTurn(geometry, at)!;
        expect(geometry.delta(at[0], at[1])).not.toEqual({ rows: 0, columns: 0 });
      }
      expect(names(at)).toEqual(names(start));
    }
  });

  it('gives nothing when a turn would put a leg off the board', () => {
    expect(quarterTurn(geometry, [hole('a3'), hole('a5')])).toBeNull();
  });
});

describe('turned', () => {
  it('goes round clockwise', () => {
    expect((['right', 'down', 'left', 'up'] as const).map(turned)).toEqual([
      'down',
      'left',
      'up',
      'right',
    ]);
  });
});
