import { useCallback, useMemo, useState } from 'react';
import { type Build, toCircuit } from '../core/build';
import { checkGoal, type Level, starsFor } from '../core/levels';
import type { Stars } from '../core/progress';
import { levelText } from '../levels/strings';
import { strings } from './strings';
import { Workbench } from './Workbench';

interface LevelScreenProps {
  level: Level;
  onFinish: (stars: Stars) => void;
  onNext: (() => void) | null;
  onBack: () => void;
}

/** One level: its goal, the workbench, and a success panel once the goal is met. */
export function LevelScreen({ level, onFinish, onNext, onBack }: LevelScreenProps) {
  const text = levelText[level.id]!;
  const initial = useMemo<Build>(() => ({ parts: level.parts }), [level]);
  const [stars, setStars] = useState<Stars | null>(null);

  const onChange = useCallback(
    (build: Build) => {
      if (stars !== null || !checkGoal(level.goal, toCircuit(level.board, build)).met) {
        return;
      }
      // Parts the level started with don't count as placed, even if the child moved them.
      const placed = build.parts.filter((p) => !level.parts.some((s) => s.id === p.id)).length;
      const earned = starsFor(level, placed, 0);
      setStars(earned);
      onFinish(earned);
    },
    [level, stars, onFinish],
  );

  return (
    <main className="level">
      <header className="level-header">
        <button type="button" onClick={onBack}>
          {strings.backToLevels}
        </button>
        <h1>{text.title}</h1>
      </header>
      <p className="level-goal">{text.goal}</p>
      {stars !== null && (
        <section className="success" aria-live="polite">
          <h2>{strings.success}</h2>
          <p className="stars" aria-label={strings.starsLabel(stars)}>
            {'★'.repeat(stars)}
            <span className="stars-missing">{'★'.repeat(3 - stars)}</span>
          </p>
          <p>
            <strong>{strings.why}</strong> {text.why}
          </p>
          {onNext ? (
            <button type="button" className="primary" onClick={onNext}>
              {strings.nextLevel}
            </button>
          ) : (
            <button type="button" className="primary" onClick={onBack}>
              {strings.backToLevels}
            </button>
          )}
        </section>
      )}
      <Workbench board={level.board} tray={level.tray} initial={initial} onChange={onChange} />
    </main>
  );
}
