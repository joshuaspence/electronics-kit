import { describe, expect, it } from 'vitest';
import { type BoardLayout, type Hole, parseHole } from './breadboard';
import type { Build, PartSpec, PlacedPart } from './build';
import { newSpec } from './catalogue';
import { decodeCircuit, encodeCircuit } from './share';

const layout: BoardLayout = { columns: 63, centreGap: true, rails: 'both' };
const hole = (name: string): Hole => parseHole(layout, name)!;
const battery: PlacedPart = {
  id: 'battery',
  spec: newSpec('battery'),
  at: [hole('top+1'), hole('top-1')],
  fixed: true,
};
const initial: Build = { parts: [battery] };
const placed = (id: string, spec: PartSpec, from: string, to: string): PlacedPart => ({
  id,
  spec,
  at: [hole(from), hole(to)],
  fixed: false,
});

describe('share codes', () => {
  const build: Build = {
    parts: [
      battery,
      placed('w', newSpec('wire'), 'top+3', 'a3'),
      placed('r', { kind: 'resistor', ohms: 4.7 }, 'b3', 'b6'),
      placed('l', newSpec('led'), 'c6', 'c8'),
      placed('s', { kind: 'switch', closed: true }, 'd8', 'd10'),
      placed('b', newSpec('bulb'), 'f20', 'f22'),
      placed('p', newSpec('button'), 'g30', 'g32'),
      placed('c', newSpec('capacitor'), 'h40', 'h42'),
    ],
  };

  it('writes each placed part as a short token, leaving out the fixed battery', () => {
    expect(encodeCircuit(build)).toBe(
      '1_w.top+3.a3_r.b3.b6.4.7_l.c6.c8_s.d8.d10.1_b.f20.f22_p.g30.g32_c.h40.h42.0.001',
    );
  });

  it('reads a code back into the same circuit, on top of the board’s own parts', () => {
    const decoded = decodeCircuit(layout, initial, encodeCircuit(build))!;
    const strip = (parts: readonly PlacedPart[]) =>
      parts.map(({ spec, at, fixed }) => ({ spec, at, fixed }));
    expect(strip(decoded.parts)).toEqual(strip(build.parts));
  });

  it('reads an empty circuit', () => {
    expect(decodeCircuit(layout, initial, encodeCircuit(initial))).toEqual(initial);
  });

  it('refuses a code it can’t trust, rather than build half a circuit', () => {
    for (const code of [
      '2_b.a1.a3', // another version
      '1_x.a1.a3', // an unknown part
      '1_b.a1.k3', // a hole not on the board
      '1_b.a1', // a leg missing
      '1_r.a1.a4', // a resistor without its value
      '1_r.a1.a4.-5', // a resistor with a value that can't be
      '1_r.a1.a4.1e12', // a resistor too big for its colour code
      '1_r.a1.a4.4.7.1', // a value with a field too many
      '1_s.a1.a3.2', // a switch neither on nor off
      '1_b.a1.a3.9', // a value on a part that has none
      '1_b.a1.a3_w.a3.a9', // two legs in one hole
      '1_w.top+1.a5', // a leg in the battery's hole
      '', // nothing at all
    ]) {
      expect(decodeCircuit(layout, initial, code), code).toBeNull();
    }
  });
});
