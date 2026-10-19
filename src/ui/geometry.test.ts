import { describe, expect, it } from 'vitest';
import type { Location } from '../core/build';
import { geometryFor, legsFrom, quarterTurn, turned } from './geometry';

const geometry = geometryFor({
  kind: 'breadboard',
  layout: { columns: 10, centreGap: false, rails: 'none' },
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

describe('nearest', () => {
  // A half-size board's rows: the top rails, a blank row, a–e, the centre gap, f–j.
  const half = geometryFor({
    kind: 'breadboard',
    layout: { columns: 15, centreGap: true, rails: 'top' },
  });
  const at = (name: string) => half.position(half.locations.find((l) => half.name(l) === name)!);
  const near = (x: number, y: number) => {
    const location = half.nearest({ x, y });
    return location && half.name(location);
  };
  const { pitch } = half;

  it('snaps to the hole a point is on or beside', () => {
    const c3 = at('c3');
    expect(near(c3.x, c3.y)).toBe('c3');
    expect(near(c3.x + pitch * 0.4, c3.y - pitch * 0.3)).toBe('c3');
  });

  it('snaps diagonally between four holes, where a fingertip often lands', () => {
    const c3 = at('c3');
    expect(near(c3.x + pitch * 0.48, c3.y + pitch * 0.49)).not.toBeNull();
  });

  it('snaps from the centre gap and the blank row under the rails to the nearest row of holes', () => {
    const e5 = at('e5');
    expect(near(e5.x, e5.y + pitch * 0.9)).toBe('e5');
    const a5 = at('a5');
    expect(near(a5.x, a5.y - pitch * 0.9)).toBe('a5');
  });

  it('snaps to nothing well off the board', () => {
    const a1 = at('a1');
    expect(near(a1.x - pitch * 1.5, a1.y)).toBeNull();
    expect(near(at('j15').x + pitch * 1.5, at('j15').y)).toBeNull();
  });
});

describe('legsFrom', () => {
  it('puts the second leg where the first leg’s spacing says', () => {
    expect(names(legsFrom(geometry, hole('e3'), 0, 2))).toEqual(['e3', 'e5']);
  });

  it('slides a part dropped at the board’s edge back onto it', () => {
    expect(names(legsFrom(geometry, hole('e10'), 0, 2))).toEqual(['e8', 'e10']);
    expect(names(legsFrom(geometry, hole('a3'), -2, 0))).toEqual(['c3', 'a3']);
  });
});
