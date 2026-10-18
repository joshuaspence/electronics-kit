import { describe, expect, it } from 'vitest';
import type { Battery, Bulb, Circuit, Part, Pins } from './circuit';
import { CONDUCTOR_OHMS } from './circuit';
import { bulbBrightness, isShorted, solveDc } from './dc';

const battery = (pins: Pins, volts = 3, internalOhms = 0.5): Battery => ({
  id: 'battery',
  kind: 'battery',
  pins,
  volts,
  internalOhms,
});
const bulb = (id: string, pins: Pins, ohms = 10): Bulb => ({
  id,
  kind: 'bulb',
  pins,
  ohms,
  ratedWatts: 0.5,
});
const wire = (id: string, pins: Pins): Part => ({ id, kind: 'wire', pins });

function reading(circuit: Circuit, id: string) {
  const r = solveDc(circuit).parts.get(id);
  if (!r) {
    throw new Error(`No reading for ${id}`);
  }
  return r;
}

describe('solveDc', () => {
  it('lights a bulb in a complete loop', () => {
    const circuit = { parts: [battery(['+', '-']), bulb('bulb', ['+', '-'])] };
    const amps = 3 / (10 + 0.5);
    expect(reading(circuit, 'bulb').current).toBeCloseTo(amps, 6);
    expect(reading(circuit, 'bulb').voltage).toBeCloseTo(amps * 10, 6);
    // The battery delivers current, so it flows through it from − to +.
    expect(reading(circuit, 'battery').current).toBeCloseTo(-amps, 6);
  });

  it('gives no current when the loop is not closed', () => {
    const circuit = { parts: [battery(['+', '-']), bulb('bulb', ['+', 'loose'])] };
    expect(Math.abs(reading(circuit, 'bulb').current)).toBeLessThan(1e-6);
  });

  it('dims two bulbs in series and keeps two in parallel bright', () => {
    const single = { parts: [battery(['+', '-']), bulb('a', ['+', '-'])] };
    const series = {
      parts: [battery(['+', '-']), bulb('a', ['+', 'mid']), bulb('b', ['mid', '-'])],
    };
    const parallel = { parts: [battery(['+', '-']), bulb('a', ['+', '-']), bulb('b', ['+', '-'])] };
    const power = (c: Circuit) => reading(c, 'a').power;

    expect(power(series)).toBeLessThan(power(single) / 3);
    expect(power(parallel)).toBeGreaterThan(power(single) * 0.8);
    expect(reading(series, 'a').current).toBeCloseTo(reading(series, 'b').current, 9);
  });

  it('follows a switch and a push button', () => {
    const withSwitch = (closed: boolean): Circuit => ({
      parts: [
        battery(['+', '-']),
        { id: 'switch', kind: 'switch', pins: ['+', 's'], closed },
        bulb('bulb', ['s', '-']),
      ],
    });
    const withButton = (pressed: boolean): Circuit => ({
      parts: [
        battery(['+', '-']),
        { id: 'button', kind: 'button', pins: ['+', 's'], pressed },
        bulb('bulb', ['s', '-']),
      ],
    });
    expect(Math.abs(reading(withSwitch(false), 'bulb').current)).toBeLessThan(1e-6);
    expect(reading(withSwitch(true), 'bulb').current).toBeGreaterThan(0.2);
    expect(Math.abs(reading(withButton(false), 'bulb').current)).toBeLessThan(1e-6);
    expect(reading(withButton(true), 'bulb').current).toBeGreaterThan(0.2);
  });

  it('carries the loop current through wires, shared between parallel wires', () => {
    const circuit = {
      parts: [
        battery(['+', '-']),
        wire('w1', ['+', 'a']),
        wire('w2', ['+', 'a']),
        bulb('bulb', ['a', '-']),
      ],
    };
    const bulbAmps = reading(circuit, 'bulb').current;
    expect(reading(circuit, 'w1').current).toBeCloseTo(bulbAmps / 2, 6);
    expect(reading(circuit, 'w2').current).toBeCloseTo(bulbAmps / 2, 6);
  });

  it('detects a short circuit across the battery', () => {
    const shorted = { parts: [battery(['+', '-']), wire('w', ['+', '-'])] };
    const normal = { parts: [battery(['+', '-']), bulb('bulb', ['+', '-'])] };
    const b = battery(['+', '-']);
    expect(reading(shorted, 'battery').current).toBeCloseTo(-3 / (0.5 + CONDUCTOR_OHMS), 3);
    expect(isShorted(b, reading(shorted, 'battery'))).toBe(true);
    expect(isShorted(b, reading(normal, 'battery'))).toBe(false);
  });

  it('bypasses a bulb with a wire across it', () => {
    const circuit = {
      parts: [battery(['+', '-']), bulb('bulb', ['+', '-']), wire('w', ['+', '-'])],
    };
    expect(reading(circuit, 'bulb').power).toBeLessThan(1e-3);
  });

  it('ignores a part with both pins on one point', () => {
    const circuit = { parts: [battery(['+', '-']), bulb('bulb', ['+', '+'])] };
    expect(reading(circuit, 'bulb').current).toBe(0);
  });

  it('solves separate circuits independently', () => {
    const circuit = {
      parts: [
        battery(['+', '-']),
        bulb('a', ['+', '-']),
        { ...battery(['p', 'n'], 1.5), id: 'other' },
        bulb('b', ['p', 'n']),
      ],
    };
    expect(reading(circuit, 'a').current).toBeCloseTo(3 / 10.5, 6);
    expect(reading(circuit, 'b').current).toBeCloseTo(1.5 / 10.5, 6);
  });

  it('reverses current when the battery is turned around', () => {
    const circuit = { parts: [battery(['-', '+']), bulb('bulb', ['+', '-'])] };
    expect(reading(circuit, 'bulb').current).toBeCloseTo(-3 / 10.5, 6);
  });

  it('reports bulb brightness from power, capped at full', () => {
    const dim = bulb('bulb', ['+', '-'], 100);
    const bright = bulb('bulb', ['+', '-'], 2);
    const brightness = (b: Bulb) =>
      bulbBrightness(b, reading({ parts: [battery(['+', '-']), b] }, 'bulb'));
    expect(brightness(dim)).toBeGreaterThan(0);
    expect(brightness(dim)).toBeLessThan(0.5);
    expect(brightness(bright)).toBe(1);
  });

  it('solves an empty circuit', () => {
    expect(solveDc({ parts: [] }).parts.size).toBe(0);
  });

  it('rejects invalid parts', () => {
    expect(() => solveDc({ parts: [bulb('a', ['x', 'y'], 0)] })).toThrow(/ohms must be positive/);
    expect(() => solveDc({ parts: [battery(['x', 'y'], 3, -1)] })).toThrow(/internalOhms/);
    expect(() => solveDc({ parts: [bulb('a', ['x', 'y']), bulb('a', ['x', 'y'])] })).toThrow(
      /Duplicate part id a/,
    );
  });

  it('solves a 50-point circuit 1,000 times well within budget', () => {
    // A ladder: a battery feeding 49 rungs of bulbs joined by wires, about the largest sandbox
    // circuit expected (docs/design.md §9).
    const parts: Part[] = [battery(['p0', 'gnd'])];
    for (let i = 1; i < 50; i++) {
      parts.push(wire(`w${i}`, [`p${i - 1}`, `p${i}`]));
      parts.push(bulb(`b${i}`, [`p${i}`, 'gnd'], 100));
    }
    const circuit = { parts };
    const start = Date.now();
    for (let i = 0; i < 1000; i++) {
      solveDc(circuit);
    }
    const elapsedMs = Date.now() - start;
    // Generous for slow CI runners; locally this takes a fraction of it.
    expect(elapsedMs).toBeLessThan(5000);
  });
});
