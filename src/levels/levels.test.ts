import { describe, expect, it } from 'vitest';
import { BuildEditor, toCircuit } from '../core/build';
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
        const editor = start();
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
      });

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
