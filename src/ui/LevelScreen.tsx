import { useCallback, useEffect, useMemo, useState } from 'react';
import { type Build, toCircuit } from '../core/build';
import { type Hint, hintFor } from '../core/hints';
import { checkGoal, type Level, litNow, starsFor } from '../core/levels';
import type { Stars } from '../core/progress';
import { levelText } from '../levels/strings';
import { Confetti } from './Confetti';
import { strings } from './strings';
import { Volty } from './Volty';
import { Workbench } from './Workbench';

/** After this long without a change, Volty offers to help (docs/design.md §6). */
const IDLE_MS = 30_000;

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
  const [build, setBuild] = useState<Build>(initial);
  const [hint, setHint] = useState<Hint | null>(null);
  const [hintsUsed, setHintsUsed] = useState(0);
  // Offer help after a while without progress. The timer records which build it went idle on, so
  // any change starts the wait again.
  const [idleBuild, setIdleBuild] = useState<Build | null>(null);
  const idle = idleBuild === build;
  useEffect(() => {
    const timer = setTimeout(() => setIdleBuild(build), IDLE_MS);
    return () => clearTimeout(timer);
  }, [build]);

  const askVolty = () => {
    // Each request goes one step further: a nudge first, then the solution a part at a time.
    setHint(hintFor(level, build, hintsUsed));
    setHintsUsed((n) => n + 1);
    setIdleBuild(null);
  };

  const onChange = useCallback(
    (next: Build) => {
      setBuild(next);
      // A hint is about the circuit it was given for; once that changes, it's done its job.
      setHint(null);
      if (stars !== null) {
        return;
      }
      const build = next;
      // The goal must be met, and the bulbs must be glowing right now: a switch-controlled
      // circuit finishes when the child switches it on.
      const circuit = toCircuit(level.board, build);
      if (!checkGoal(level.goal, circuit).met || litNow(circuit) < level.goal.bulbs) {
        return;
      }
      // Parts the level started with don't count as placed, even if the child moved them.
      const placed = build.parts.filter((p) => !level.parts.some((s) => s.id === p.id)).length;
      const earned = starsFor(level, placed, hintsUsed);
      setStars(earned);
      onFinish(earned);
    },
    [level, stars, hintsUsed, onFinish],
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
      {stars !== null && <Confetti />}
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
          <details className="more">
            <summary>{strings.tellMore}</summary>
            <p>{text.more}</p>
          </details>
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
      <Workbench
        board={level.board}
        tray={level.tray}
        initial={initial}
        onChange={onChange}
        finished={stars !== null}
        hint={
          hint?.kind === 'show-part'
            ? { place: hint.part }
            : hint?.kind === 'remove-part'
              ? { removeId: hint.part.id }
              : undefined
        }
      />
      {stars === null && (
        <Volty
          says={hint ? hintText(hint) : idle ? strings.stuck : null}
          offering={idle}
          onAsk={askVolty}
        />
      )}
    </main>
  );
}

function hintText(hint: Hint): string {
  switch (hint.kind) {
    case 'nudge':
      return strings.hints[hint.reason];
    case 'show-part':
      return strings.hintPlace(strings.parts[hint.part.spec.kind].toLowerCase());
    case 'remove-part':
      return strings.hintRemove(strings.parts[hint.part.spec.kind].toLowerCase());
  }
}
