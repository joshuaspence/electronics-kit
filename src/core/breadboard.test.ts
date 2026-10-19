import { describe, expect, it } from 'vitest';
import {
  type BoardLayout,
  type Hole,
  holeName,
  holesInStrip,
  holesOf,
  isValidHole,
  stripOf,
  type TerminalRow,
} from './breadboard';

const mini: BoardLayout = { columns: 10, centreGap: false, rails: 'none' };
const half: BoardLayout = { columns: 30, centreGap: true, rails: 'both' };

const terminal = (column: number, row: TerminalRow): Hole => ({ kind: 'terminal', column, row });

describe('rails', () => {
  it('runs only along the top on a board with top rails', () => {
    const level: BoardLayout = { ...half, rails: 'top' };
    const rail = (name: 'top+' | 'bottom+'): Hole => ({ kind: 'rail', rail: name, position: 1 });
    expect(isValidHole(level, rail('top+'))).toBe(true);
    expect(isValidHole(level, rail('bottom+'))).toBe(false);
    expect(isValidHole(mini, rail('top+'))).toBe(false);
    expect(holesOf(level).length).toBe(holesOf(half).length - 2 * half.columns);
  });
});

describe('stripOf', () => {
  it('joins a whole column on a board without a centre gap', () => {
    expect(stripOf(mini, terminal(3, 'a'))).toBe(stripOf(mini, terminal(3, 'j')));
  });

  it('splits a column at the centre gap', () => {
    expect(stripOf(half, terminal(3, 'a'))).toBe(stripOf(half, terminal(3, 'e')));
    expect(stripOf(half, terminal(3, 'e'))).not.toBe(stripOf(half, terminal(3, 'f')));
    expect(stripOf(half, terminal(3, 'f'))).toBe(stripOf(half, terminal(3, 'j')));
  });

  it('keeps neighbouring columns apart', () => {
    expect(stripOf(mini, terminal(3, 'a'))).not.toBe(stripOf(mini, terminal(4, 'a')));
  });

  it('joins a rail along the whole board but keeps the rails apart', () => {
    const rail = (r: 'top+' | 'top-', position: number): Hole => ({
      kind: 'rail',
      rail: r,
      position,
    });
    expect(stripOf(half, rail('top+', 1))).toBe(stripOf(half, rail('top+', 30)));
    expect(stripOf(half, rail('top+', 1))).not.toBe(stripOf(half, rail('top-', 1)));
  });

  it('rejects holes that are not on the board', () => {
    expect(() => stripOf(mini, terminal(11, 'a'))).toThrow(RangeError);
    expect(() => stripOf(mini, terminal(0, 'a'))).toThrow(RangeError);
    expect(() => stripOf(mini, { kind: 'rail', rail: 'top+', position: 1 })).toThrow(RangeError);
  });
});

describe('holesOf', () => {
  it('counts ten terminals per column plus four rails', () => {
    expect(holesOf(mini)).toHaveLength(100);
    expect(holesOf(half)).toHaveLength(300 + 4 * 30);
    expect(holesOf(half).every((hole) => isValidHole(half, hole))).toBe(true);
  });
});

describe('holesInStrip', () => {
  it('returns the five holes of a half column', () => {
    expect(holesInStrip(half, terminal(7, 'f')).map(holeName)).toEqual([
      'f7',
      'g7',
      'h7',
      'i7',
      'j7',
    ]);
  });

  it('returns the whole column on a mini board', () => {
    expect(holesInStrip(mini, terminal(2, 'e'))).toHaveLength(10);
  });
});
