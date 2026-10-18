import { describe, expect, it } from 'vitest';
import type { Hole } from './breadboard';
import { type Board, BuildEditor, type Location, type PlacedPart, toCircuit } from './build';
import { solveDc } from './dc';

const hole = (row: 'a' | 'b' | 'e' | 'f' | 'j', column: number): Hole => ({
  kind: 'terminal',
  row,
  column,
});
const snap = (terminal: string): Location => ({ kind: 'snap', terminal });

const mini: Board = { kind: 'breadboard', layout: { columns: 10, centreGap: false, rails: false } };
const snapBoard: Board = { kind: 'snap', terminals: ['t1', 't2', 't3', 't4'] };

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

  it('keeps snap terminals apart from each other', () => {
    const build = {
      parts: [battery([snap('t1'), snap('t2')]), bulb('b', [snap('t2'), snap('t3')])],
    };
    expect(toCircuit(snapBoard, build).parts[1]!.pins).toEqual(['snap:t2', 'snap:t3']);
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
    expect(place([snap('t1'), hole('b', 3)])).toEqual({ ok: false, reason: 'off-board' });
    // Both legs in one strip is allowed: it just shorts the part out (docs/design.md §5).
    expect(place([hole('b', 3), hole('j', 3)])).toEqual({ ok: true });
  });

  it('lets several parts share a snap terminal', () => {
    const editor = new BuildEditor(snapBoard, tray, { parts: [battery([snap('t1'), snap('t2')])] });
    expect(editor.apply({ kind: 'place', part: bulb('b', [snap('t1'), snap('t2')]) })).toEqual({
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
