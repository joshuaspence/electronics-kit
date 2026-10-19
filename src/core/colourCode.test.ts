import { describe, expect, it } from 'vitest';
import { colourBands } from './colourCode';

describe('colourBands', () => {
  it('reads two digits and a multiplier', () => {
    expect(colourBands(100)).toEqual(['brown', 'black', 'brown', 'gold']);
    expect(colourBands(470)).toEqual(['yellow', 'violet', 'brown', 'gold']);
    expect(colourBands(10_000)).toEqual(['brown', 'black', 'orange', 'gold']);
    expect(colourBands(22)).toEqual(['red', 'red', 'black', 'gold']);
  });

  it('uses gold and silver multipliers below 10 Ω', () => {
    expect(colourBands(4.7)).toEqual(['yellow', 'violet', 'gold', 'gold']);
    expect(colourBands(0.22)).toEqual(['red', 'red', 'silver', 'gold']);
  });

  it('rounds to two significant figures, carrying into the multiplier', () => {
    expect(colourBands(1234)).toEqual(['brown', 'red', 'red', 'gold']);
    expect(colourBands(99.6)).toEqual(['brown', 'black', 'brown', 'gold']);
  });

  it('refuses values the code cannot show', () => {
    expect(() => colourBands(0.05)).toThrow(RangeError);
    expect(() => colourBands(1e11)).toThrow(RangeError);
    expect(() => colourBands(Number.NaN)).toThrow(RangeError);
  });
});
