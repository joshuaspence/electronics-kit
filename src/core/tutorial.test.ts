import { describe, expect, it } from 'vitest';
import { BuildEditor } from './build';
import { tutorialStep } from './tutorial';
import { levels } from '../levels';

const level = levels.find((l) => l.tutorial)!;
const start = () => new BuildEditor(level.board, level.tray, { parts: level.parts });

describe('tutorialStep', () => {
  it('is on the first level, and walks its solution one part at a time to the end', () => {
    expect(level.id).toBe('loop-1');
    const editor = start();
    const shown: string[] = [];
    for (let i = 0; i < 10; i++) {
      const step = tutorialStep(level, editor.build);
      if (step.kind === 'done') {
        break;
      }
      expect(step.kind).toBe('place');
      if (step.kind === 'place') {
        shown.push(`${step.part.spec.kind}:${step.wiresPlaced}`);
        expect(editor.apply({ kind: 'place', part: step.part })).toEqual({ ok: true });
      }
    }
    expect(shown).toEqual(['bulb:0', 'wire:0', 'wire:1']);
    expect(tutorialStep(level, editor.build)).toEqual({ kind: 'done' });
  });

  it('asks for a part in the wrong place to be taken away', () => {
    const editor = start();
    const bulb = level.solution.place.find((p) => p.spec.kind === 'bulb')!;
    // The bulb with one leg on the battery's post instead of where the solution puts it.
    const stray = { ...bulb, id: 'stray', at: [level.parts[0]!.at[0], bulb.at[1]] as const };
    expect(editor.apply({ kind: 'place', part: stray }).ok).toBe(true);
    expect(tutorialStep(level, editor.build)).toMatchObject({
      kind: 'remove',
      part: { id: 'stray' },
    });
  });
});
