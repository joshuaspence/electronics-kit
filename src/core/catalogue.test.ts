import { describe, expect, it } from 'vitest';
import { toCircuit } from './build';
import { newSpec } from './catalogue';
import { bulbBrightness, ledPops, solveDc } from './dc';

describe('newSpec', () => {
  it('lights one kit bulb at full brightness from one kit battery', () => {
    const board = { kind: 'snap', rows: 1, columns: 2 } as const;
    const at = [
      { kind: 'snap', row: 1, column: 1 },
      { kind: 'snap', row: 1, column: 2 },
    ] as const;
    const circuit = toCircuit(board, {
      parts: [
        { id: 'battery', spec: newSpec('battery'), at, fixed: true },
        { id: 'bulb', spec: newSpec('bulb'), at, fixed: false },
      ],
    });
    const bulb = circuit.parts[1]!;
    if (bulb.kind !== 'bulb') {
      throw new Error('expected a bulb');
    }
    expect(bulbBrightness(bulb, solveDc(circuit).parts.get('bulb')!)).toBe(1);
  });

  it('pops a kit LED straight across a kit battery, but not behind a kit resistor', () => {
    const board = { kind: 'snap', rows: 1, columns: 3 } as const;
    const post = (column: number) => ({ kind: 'snap', row: 1, column }) as const;
    const led = (from: number) => {
      const build = {
        parts: [
          { id: 'battery', spec: newSpec('battery'), at: [post(1), post(2)], fixed: true },
          { id: 'led', spec: newSpec('led'), at: [post(1), post(from)], fixed: false },
          { id: 'r', spec: newSpec('resistor'), at: [post(3), post(2)], fixed: false },
        ],
      } as const;
      return solveDc(toCircuit(board, build)).parts.get('led')!;
    };
    // Straight across: the LED's cathode on the battery's − post, the resistor beside it unused.
    expect(ledPops(led(2))).toBe(true);
    // Through the resistor: anode on +, cathode on post 3, resistor from 3 back to −.
    expect(ledPops(led(3))).toBe(false);
    expect(led(3).current).toBeGreaterThan(0.005);
  });

  it('starts switches open and buttons released', () => {
    expect(newSpec('switch')).toEqual({ kind: 'switch', closed: false });
    expect(newSpec('button')).toEqual({ kind: 'button', pressed: false });
  });
});
