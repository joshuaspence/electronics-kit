import { useCallback, useEffect, useMemo, useState } from 'react';
import { type Build, toCircuit } from '../core/build';
import { type Hint, hintFor } from '../core/hints';
import { checkGoal, finishedNow, type Level, starsFor } from '../core/levels';
import type { CircuitSolution } from '../core/mna';
import type { Stars } from '../core/progress';
import { type TutorialStep, tutorialStep } from '../core/tutorial';
import { type LevelText, levelText } from '../levels/strings';
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
  /** The multimeter is unlocked. */
  meter: boolean;
  /** Start with the guided tutorial running: a tutorial level the child hasn't finished yet. */
  guide: boolean;
}

/** One level: its goal, the workbench, and a success panel once the goal is met. */
export function LevelScreen({ level, onFinish, onNext, onBack, meter, guide }: LevelScreenProps) {
  const text = levelText[level.id]!;
  const initial = useMemo<Build>(() => ({ parts: level.parts }), [level]);
  const [stars, setStars] = useState<Stars | null>(null);
  const [build, setBuild] = useState<Build>(initial);
  const [hint, setHint] = useState<Hint | null>(null);
  const [hintsUsed, setHintsUsed] = useState(0);
  // The guided tutorial shows the solution a step at a time and, unlike a hint, costs no star.
  const [guiding, setGuiding] = useState(guide && level.tutorial === true);
  const step = guiding && stars === null ? tutorialStep(level, build) : null;
  // A hint the child asked for comes first; otherwise the tutorial points at its next step.
  const shown =
    hint ??
    (step?.kind === 'place'
      ? ({ kind: 'show-part', part: step.part } as const)
      : step?.kind === 'remove'
        ? ({ kind: 'remove-part', part: step.part } as const)
        : null);
  // Offer help after a while without progress. The timer records which build it went idle on, so
  // any change starts the wait again.
  const [idleBuild, setIdleBuild] = useState<Build | null>(null);
  const idle = idleBuild === build && !guiding;
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
    (next: Build, shown: CircuitSolution) => {
      setBuild(next);
      // A hint is about the circuit it was given for; once that changes, it's done its job.
      setHint(null);
      if (stars !== null) {
        return;
      }
      const build = next;
      // The goal must be met, and the child must see it working on the board: a switch-controlled
      // circuit finishes when the child switches it on.
      const circuit = toCircuit(level.board, build);
      if (!checkGoal(level.goal, circuit).met || !finishedNow(level.goal, circuit, shown)) {
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
    <main className="level fit-screen">
      <header className="level-header">
        <button type="button" onClick={onBack}>
          {strings.backToLevels}
        </button>
        <div>
          <h1>{text.title}</h1>
          <p className="level-goal">{text.goal}</p>
        </div>
        {level.tutorial && !guiding && stars === null && (
          <button type="button" className="show-me-how" onClick={() => setGuiding(true)}>
            {strings.showMeHow}
          </button>
        )}
      </header>
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
        meter={meter}
        hint={
          shown?.kind === 'show-part'
            ? { place: shown.part }
            : shown?.kind === 'remove-part'
              ? { removeId: shown.part.id }
              : undefined
        }
        guided={step?.kind === 'place' ? step.part.spec.kind : undefined}
        aside={
          stars === null && (
            <Volty
              says={
                hint
                  ? hintText(hint, text)
                  : step
                    ? tutorialText(step)
                    : idle
                      ? strings.stuck
                      : null
              }
              offering={idle}
              onAsk={askVolty}
            />
          )
        }
      />
    </main>
  );
}

function hintText(hint: Hint, text: LevelText): string {
  switch (hint.kind) {
    case 'nudge':
      return text.hints?.[hint.reason] ?? strings.hints[hint.reason];
    case 'show-part':
      return strings.hintPlace(hint.part.spec.kind);
    case 'remove-part':
      return strings.hintRemove(hint.part.spec.kind);
  }
}

function tutorialText(step: TutorialStep): string | null {
  switch (step.kind) {
    case 'place':
      if (step.part.spec.kind === 'bulb') {
        return strings.tutorial.bulb;
      }
      if (step.part.spec.kind === 'wire') {
        return step.wiresPlaced === 0 ? strings.tutorial.firstWire : strings.tutorial.nextWire;
      }
      return strings.tutorial.place(step.part.spec.kind);
    case 'remove':
      return strings.tutorial.remove(step.part.spec.kind);
    case 'try-it':
      return strings.tutorial.tryIt;
    case 'done':
      return null;
  }
}
