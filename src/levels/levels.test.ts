import { describe, expect, it } from 'vitest';
import { holesInStrip } from '../core/breadboard';
import { BuildEditor, type Location, locationKey, toCircuit } from '../core/build';
import { newSpec } from '../core/catalogue';
import { hintFor } from '../core/hints';
import { checkGoal } from '../core/levels';
import { levels } from './index';
import { chapterTitles, levelText } from './strings';

describe('levels', () => {
  it('have unique ids, text and a chapter title', () => {
    expect(new Set(levels.map((level) => level.id)).size).toBe(levels.length);
    for (const level of levels) {
      expect(levelText[level.id], level.id).toBeDefined();
      expect(chapterTitles[level.chapter], level.id).toBeDefined();
    }
  });

  for (const level of levels) {
    describe(level.id, () => {
      const start = () => new BuildEditor(level.board, level.tray, { parts: level.parts });

      it('starts unsolved', () => {
        const editor = start();
        expect(checkGoal(level.goal, toCircuit(level.board, editor.build)).met).toBe(false);
      });

      it('can be finished by following Volty’s hints', () => {
        followHints(start());
      });

      it('can be finished by following Volty’s hints after a misplaced part', () => {
        const editor = start();
        let kind = level.tray.find(({ kind }) => editor.remaining(kind) > 0)?.kind;

        // With the whole tray already on the board, a part can only be misplaced by moving one.
        if (!kind) {
          const movable = level.parts.find((p) => !p.fixed)!;
          expect(editor.apply({ kind: 'remove', id: movable.id })).toEqual({ ok: true });
          kind = movable.spec.kind;
        }
        const spec = newSpec(kind);
        const solved = new Set(level.solution.place.map((p) => legsKey(p.at)));
        const { board } = level;

        // Somewhere joined to the level's own legs, so it can short the battery or bridge a loop.
        const legs = [...level.parts, ...level.solution.place]
          .flatMap((p) => p.at)
          .flatMap((leg) =>
            leg.kind === 'snap' || board.kind !== 'breadboard'
              ? [leg]
              : holesInStrip(board.layout, leg),
          );
        const misplaced = legs
          .flatMap((from) => legs.map((to) => [from, to] as const))
          .find(
            (at) =>
              !solved.has(legsKey(at)) &&
              editor.apply({ kind: 'place', part: { id: 'misplaced', spec, at, fixed: false } }).ok,
          );
        expect(misplaced).toBeDefined();
        followHints(editor);
      });

      const kept = level.parts.filter((p) => !p.fixed && !level.solution.remove?.includes(p.id));
      for (const part of kept) {
        it(`can be finished by following Volty’s hints after ${part.id} is taken away`, () => {
          const editor = start();
          expect(editor.apply({ kind: 'remove', id: part.id })).toEqual({ ok: true });
          followHints(editor);
        });
      }

      function followHints(editor: BuildEditor) {
        for (let step = 1; step <= 20; step++) {
          if (checkGoal(level.goal, toCircuit(level.board, editor.build)).met) {
            return;
          }
          const hint = hintFor(level, editor.build, step);
          if (hint.kind === 'remove-part') {
            expect(editor.apply({ kind: 'remove', id: hint.part.id })).toEqual({ ok: true });
          } else if (hint.kind === 'show-part') {
            const part = { ...hint.part, id: `hinted-${step}` };
            expect(editor.apply({ kind: 'place', part })).toEqual({ ok: true });
          } else {
            throw new Error(`Hint ${step} was a nudge before the level was finished`);
          }
        }
        throw new Error('Hints did not finish the level');
      }

      it('can be finished at par with its tray', () => {
        const editor = start();
        for (const id of level.solution.remove ?? []) {
          expect(editor.apply({ kind: 'remove', id }), `remove ${id}`).toEqual({ ok: true });
        }
        for (const part of level.solution.place) {
          expect(editor.apply({ kind: 'place', part }), `place ${part.id}`).toEqual({ ok: true });
        }
        expect(checkGoal(level.goal, toCircuit(level.board, editor.build))).toEqual({ met: true });
        expect(level.solution.place.length).toBeLessThanOrEqual(level.par);
      });
    });
  }
});

describe('strips-2', () => {
  it('starts with a bulb whose legs share the battery’s + strip, not one off in the corner', () => {
    const level = levels.find((l) => l.id === 'strips-2')!;
    const circuit = toCircuit(level.board, { parts: level.parts });
    const battery = circuit.parts.find((p) => p.kind === 'battery')!;
    const bulb = circuit.parts.find((p) => p.kind === 'bulb')!;
    expect(bulb.pins).toEqual([battery.pins[0], battery.pins[0]]);
  });
});

describe('pair-2', () => {
  it('says three bulbs in a row are too dim, not that the loop is broken', () => {
    const level = levels.find((l) => l.id === 'pair-2')!;
    const at = (a: Location, b: Location) => [a, b] as const;
    const hole = (row: 'a' | 'b' | 'c' | 'd' | 'e', column: number): Location => ({
      kind: 'terminal',
      row,
      column,
    });
    const rail = (name: 'top+' | 'top-', position: number): Location => ({
      kind: 'rail',
      rail: name,
      position,
    });
    const place = (id: string, kind: 'bulb' | 'wire', legs: readonly [Location, Location]) => ({
      id,
      spec: newSpec(kind),
      at: legs,
      fixed: false,
    });
    const inARow = {
      parts: [
        ...level.parts,
        place('plus', 'wire', at(rail('top+', 3), hole('a', 3))),
        place('b1', 'bulb', at(hole('b', 3), hole('b', 5))),
        place('b2', 'bulb', at(hole('c', 5), hole('c', 7))),
        place('b3', 'bulb', at(hole('d', 7), hole('d', 9))),
        place('minus', 'wire', at(hole('e', 9), rail('top-', 9))),
      ],
    };
    expect(hintFor(level, inARow, 0)).toEqual({ kind: 'nudge', reason: 'too-dim' });
  });
});

/** The same for the same two locations, either way round. */
function legsKey(at: readonly [Location, Location]): string {
  return at.map(locationKey).sort().join(' ');
}
