import { describe, expect, it } from 'vitest';
import type { Hole } from './breadboard';
import {
  type Board,
  blowOverdrivenLeds,
  type Build,
  BuildEditor,
  type Location,
  type PlacedPart,
  toCircuit,
} from './build';
import { newSpec } from './catalogue';
import { solveDc } from './dc';
import type { PartAllowance } from './levels';

const hole = (row: 'a' | 'b' | 'e' | 'f' | 'j', column: number): Hole => ({
  kind: 'terminal',
  row,
  column,
});
const snap = (row: number, column: number): Location => ({ kind: 'snap', row, column });

const mini: Board = {
  kind: 'breadboard',
  layout: { columns: 10, centreGap: false, rails: 'none' },
};
const snapBoard: Board = { kind: 'snap', rows: 2, columns: 3 };

const battery = (at: readonly [Location, Location]): PlacedPart => ({
  id: 'battery',
  spec: { kind: 'battery', volts: 3, internalOhms: 0.5 },
  at,
  fixed: true,
});
const bulb = (id: string, at: readonly [Location, Location]): PlacedPart => ({
  id,
  spec: { kind: 'bulb', ohms: 10, ratedWatts: 0.5 },
  at,
  fixed: false,
});
const wire = (id: string, at: readonly [Location, Location]): PlacedPart => ({
  id,
  spec: { kind: 'wire' },
  at,
  fixed: false,
});

describe('toCircuit', () => {
  it('joins pins in the same breadboard strip', () => {
    const build = {
      parts: [battery([hole('a', 1), hole('a', 2)]), bulb('b', [hole('j', 1), hole('j', 2)])],
    };
    const circuit = toCircuit(mini, build);
    expect(circuit.parts.map((p) => p.pins)).toEqual([
      ['col:1', 'col:2'],
      ['col:1', 'col:2'],
    ]);
    expect(solveDc(circuit).parts.get('b')!.current).toBeGreaterThan(0.2);
  });

  it('keeps snap posts apart from each other', () => {
    const build = {
      parts: [battery([snap(1, 1), snap(1, 2)]), bulb('b', [snap(1, 2), snap(2, 2)])],
    };
    expect(toCircuit(snapBoard, build).parts[1]!.pins).toEqual(['snap:1:2', 'snap:2:2']);
  });
});

describe('BuildEditor', () => {
  const tray = [
    { kind: 'bulb', count: 1 },
    { kind: 'wire', count: 2 },
  ] as const;
  const start = () =>
    new BuildEditor(mini, tray, { parts: [battery([hole('a', 1), hole('a', 2)])] });

  it('places parts from the tray until they run out', () => {
    const editor = start();
    expect(editor.remaining('bulb')).toBe(1);
    expect(editor.apply({ kind: 'place', part: bulb('b1', [hole('b', 1), hole('b', 2)]) })).toEqual(
      { ok: true },
    );
    expect(editor.remaining('bulb')).toBe(0);
    expect(editor.apply({ kind: 'place', part: bulb('b2', [hole('b', 3), hole('b', 4)]) })).toEqual(
      {
        ok: false,
        reason: 'none-left',
      },
    );
    expect(editor.remaining('resistor')).toBe(0);
  });

  it('refuses only physically impossible placements', () => {
    const editor = start();
    let next = 0;
    const place = (at: readonly [Location, Location]) =>
      editor.apply({ kind: 'place', part: wire(`w${next++}`, at) });
    expect(place([hole('a', 1), hole('b', 1)])).toEqual({ ok: false, reason: 'hole-taken' });
    expect(place([hole('b', 3), hole('b', 3)])).toEqual({ ok: false, reason: 'same-hole' });
    expect(place([hole('b', 3), hole('b', 11)])).toEqual({ ok: false, reason: 'off-board' });
    expect(place([snap(1, 1), hole('b', 3)])).toEqual({ ok: false, reason: 'off-board' });
    // Both legs in one strip is allowed: it just shorts the part out (docs/design.md §5).
    expect(place([hole('b', 3), hole('j', 3)])).toEqual({ ok: true });
  });

  it('lets several parts share a snap post', () => {
    const editor = new BuildEditor(snapBoard, tray, { parts: [battery([snap(1, 1), snap(1, 2)])] });
    expect(editor.apply({ kind: 'place', part: bulb('x', [snap(2, 3), snap(3, 3)]) })).toEqual({
      ok: false,
      reason: 'off-board',
    });
    expect(editor.apply({ kind: 'place', part: bulb('b', [snap(1, 1), snap(1, 2)]) })).toEqual({
      ok: true,
    });
  });

  it('moves and removes the child’s parts but not the level’s', () => {
    const editor = start();
    editor.apply({ kind: 'place', part: bulb('b', [hole('b', 3), hole('b', 4)]) });
    expect(editor.apply({ kind: 'move', id: 'b', at: [hole('b', 1), hole('b', 2)] })).toEqual({
      ok: true,
    });
    expect(editor.build.parts.find((p) => p.id === 'b')!.at).toEqual([hole('b', 1), hole('b', 2)]);
    // Moving onto the holes it already occupies is fine.
    expect(editor.apply({ kind: 'move', id: 'b', at: [hole('b', 2), hole('b', 1)] })).toEqual({
      ok: true,
    });

    expect(editor.apply({ kind: 'move', id: 'battery', at: [hole('e', 5), hole('e', 6)] })).toEqual(
      {
        ok: false,
        reason: 'fixed-part',
      },
    );
    expect(editor.apply({ kind: 'remove', id: 'battery' })).toEqual({
      ok: false,
      reason: 'fixed-part',
    });
    expect(editor.apply({ kind: 'remove', id: 'nope' })).toEqual({
      ok: false,
      reason: 'unknown-part',
    });
    expect(editor.apply({ kind: 'remove', id: 'b' })).toEqual({ ok: true });
    expect(editor.remaining('bulb')).toBe(1);
  });

  it('undoes and redoes edits, and a new edit clears redo', () => {
    const editor = start();
    expect(editor.canUndo).toBe(false);
    editor.apply({ kind: 'place', part: bulb('b', [hole('b', 3), hole('b', 4)]) });
    editor.apply({ kind: 'move', id: 'b', at: [hole('b', 5), hole('b', 6)] });

    expect(editor.undo()).toBe(true);
    expect(editor.build.parts.find((p) => p.id === 'b')!.at[0]).toEqual(hole('b', 3));
    expect(editor.undo()).toBe(true);
    expect(editor.build.parts).toHaveLength(1);
    expect(editor.undo()).toBe(false);

    expect(editor.redo()).toBe(true);
    expect(editor.build.parts).toHaveLength(2);
    editor.apply({ kind: 'place', part: wire('w', [hole('f', 7), hole('f', 8)]) });
    expect(editor.canRedo).toBe(false);
  });

  it('does not record refused edits', () => {
    const editor = start();
    editor.apply({ kind: 'place', part: wire('w', [hole('a', 1), hole('b', 9)]) });
    expect(editor.canUndo).toBe(false);
  });

  it('flips controls without adding undo steps, and keeps them flipped across undo', () => {
    const editor = new BuildEditor(mini, [{ kind: 'switch', count: 1 }, ...tray], {
      parts: [battery([hole('a', 1), hole('a', 2)])],
    });
    editor.apply({
      kind: 'place',
      part: {
        id: 's',
        spec: { kind: 'switch', closed: false },
        at: [hole('b', 3), hole('b', 4)],
        fixed: false,
      },
    });
    editor.apply({ kind: 'place', part: bulb('b', [hole('b', 5), hole('b', 6)]) });

    expect(editor.setControl('s', true)).toEqual({ ok: true });
    expect(editor.undo()).toBe(true);
    expect(editor.build.parts.find((p) => p.id === 's')!.spec).toEqual({
      kind: 'switch',
      closed: true,
    });
    expect(editor.undo()).toBe(true);
    expect(editor.canUndo).toBe(false);
    expect(editor.setControl('b', true)).toEqual({ ok: false, reason: 'unknown-part' });
  });
});

describe('blowOverdrivenLeds', () => {
  const led = (id: string, at: readonly [Location, Location]): PlacedPart => ({
    id,
    spec: newSpec('led'),
    at,
    fixed: false,
  });
  const resistor = (id: string, at: readonly [Location, Location]): PlacedPart => ({
    id,
    spec: newSpec('resistor'),
    at,
    fixed: false,
  });
  const blown = (build: Build) =>
    build.parts.filter((p) => p.spec.kind === 'led' && p.spec.blown).map((p) => p.id);
  const power = battery([snap(1, 1), snap(1, 2)]);
  const toggle = (id: string, at: readonly [Location, Location]): PlacedPart => ({
    id,
    spec: newSpec('switch'),
    at,
    fixed: false,
  });
  /** An editor that blows overdriven LEDs, as the game's does, starting from just the battery. */
  const settled = (tray: readonly PartAllowance[]) =>
    new BuildEditor(snapBoard, tray, { parts: [power] }, (build) =>
      blowOverdrivenLeds(snapBoard, build),
    );

  it('blows an LED straight across the battery, which then stays dark', () => {
    const build = blowOverdrivenLeds(snapBoard, {
      parts: [power, led('led', [snap(1, 1), snap(1, 2)])],
    });
    expect(blown(build)).toEqual(['led']);
    expect(solveDc(toCircuit(snapBoard, build)).parts.get('led')!.current).toBeCloseTo(0, 6);
  });

  it('leaves an LED behind a resistor, and one the wrong way round, alone', () => {
    const build = {
      parts: [
        power,
        led('safe', [snap(1, 1), snap(2, 1)]),
        resistor('r', [snap(2, 1), snap(1, 2)]),
        led('backwards', [snap(1, 2), snap(1, 1)]),
      ],
    };
    expect(blowOverdrivenLeds(snapBoard, build)).toBe(build);
  });

  it('pops as part of the edit that overdrove it, so one undo brings it back', () => {
    const editor = settled([{ kind: 'led', count: 1 }]);
    editor.apply({ kind: 'place', part: led('led', [snap(1, 1), snap(1, 2)]) });
    expect(blown(editor.build)).toEqual(['led']);

    expect(editor.undo()).toBe(true);
    expect(editor.build.parts.map((p) => p.id)).toEqual(['battery']);
    expect(editor.canUndo).toBe(false);
    expect(editor.redo()).toBe(true);
    expect(blown(editor.build)).toEqual(['led']);
  });

  it('pops as part of the input that overdrove it, so one undo brings it back', () => {
    const tray = [
      { kind: 'led', count: 1 },
      { kind: 'switch', count: 1 },
      { kind: 'wire', count: 1 },
    ] as const;
    const editor = settled(tray);
    editor.apply({ kind: 'place', part: led('led', [snap(1, 1), snap(2, 1)]) });
    editor.apply({ kind: 'place', part: toggle('s', [snap(2, 1), snap(1, 2)]) });
    editor.apply({ kind: 'place', part: wire('w', [snap(2, 2), snap(2, 3)]) });

    // Closing the switch puts the LED straight across the battery.
    editor.setControl('s', true);
    expect(blown(editor.build)).toEqual(['led']);

    // One undo puts the switch back open and the LED back whole, and keeps the wire placed after.
    expect(editor.undo()).toBe(true);
    expect(blown(editor.build)).toEqual([]);
    expect(editor.build.parts.find((p) => p.id === 's')!.spec).toMatchObject({ closed: false });
    expect(editor.build.parts.map((p) => p.id)).toContain('w');
    expect(editor.redo()).toBe(true);
    expect(blown(editor.build)).toEqual(['led']);
  });

  it('keeps an input that sets nothing off out of undo', () => {
    const editor = settled([{ kind: 'switch', count: 1 }]);
    editor.apply({ kind: 'place', part: toggle('s', [snap(2, 1), snap(2, 2)]) });
    editor.setControl('s', true);
    expect(editor.undo()).toBe(true);
    expect(editor.canUndo).toBe(false);
  });
});
