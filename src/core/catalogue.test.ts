import { describe, expect, it } from 'vitest';
import { toCircuit } from './build';
import { newSpec } from './catalogue';
import { bulbBrightness, solveDc } from './dc';

describe('newSpec', () => {
  it('lights one kit bulb at full brightness from one kit battery', () => {
    const board = { kind: 'snap', terminals: ['+', '-'] } as const;
    const at = [
      { kind: 'snap', terminal: '+' },
      { kind: 'snap', terminal: '-' },
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

  it('starts switches open and buttons released', () => {
    expect(newSpec('switch')).toEqual({ kind: 'switch', closed: false });
    expect(newSpec('button')).toEqual({ kind: 'button', pressed: false });
  });
});
