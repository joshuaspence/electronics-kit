import { describe, expect, it } from 'vitest';
import { solveLinearSystem } from './linear';

const solve = (a: number[], b: number[]) =>
  Array.from(solveLinearSystem(Float64Array.from(a), Float64Array.from(b)));

describe('solveLinearSystem', () => {
  it('solves a small system', () => {
    // 2x + y = 5, x + 3y = 10
    const [x, y] = solve([2, 1, 1, 3], [5, 10]);
    expect(x).toBeCloseTo(1);
    expect(y).toBeCloseTo(3);
  });

  it('pivots past a zero on the diagonal', () => {
    // y = 2, x + y = 3
    const [x, y] = solve([0, 1, 1, 1], [2, 3]);
    expect(x).toBeCloseTo(1);
    expect(y).toBeCloseTo(2);
  });

  it('solves a three-variable system', () => {
    const [x, y, z] = solve([1, 1, 1, 0, 2, 5, 2, 5, -1], [6, -4, 27]);
    expect(x).toBeCloseTo(5);
    expect(y).toBeCloseTo(3);
    expect(z).toBeCloseTo(-2);
  });

  it('leaves its arguments unchanged', () => {
    const a = Float64Array.from([0, 1, 1, 1]);
    const b = Float64Array.from([2, 3]);
    solveLinearSystem(a, b);
    expect(Array.from(a)).toEqual([0, 1, 1, 1]);
    expect(Array.from(b)).toEqual([2, 3]);
  });

  it('rejects a singular matrix', () => {
    expect(() => solve([1, 2, 2, 4], [1, 2])).toThrow(/singular/);
  });

  it('rejects a matrix of the wrong size', () => {
    expect(() => solve([1, 2, 3], [1, 2])).toThrow(RangeError);
  });
});
