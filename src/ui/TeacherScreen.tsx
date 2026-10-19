import { useState } from 'react';
import { type GateQuestion, gateQuestion, passesGate } from '../core/gate';
import { strings } from './strings';

interface TeacherScreenProps {
  unlockAll: boolean;
  onUnlockAll: (unlockAll: boolean) => void;
  onBack: () => void;
}

/**
 * Settings for a teacher or parent, behind the grown-ups' gate (docs/design.md §2): for now, one
 * switch that unlocks every part in the sandbox, and the multimeter, for every player on the
 * device. The gate is asked each time the screen opens.
 */
export function TeacherScreen({ unlockAll, onUnlockAll, onBack }: TeacherScreenProps) {
  const [question, setQuestion] = useState<GateQuestion>(() => gateQuestion());
  const [answer, setAnswer] = useState('');
  const [passed, setPassed] = useState(false);
  const [wrong, setWrong] = useState(false);

  return (
    <main>
      <header className="level-header">
        <button type="button" onClick={onBack}>
          {strings.backToLevels}
        </button>
        <h1>{strings.grownUps}</h1>
      </header>
      {passed ? (
        <section className="teacher-settings">
          <button
            type="button"
            className="setting"
            aria-pressed={unlockAll}
            onClick={() => onUnlockAll(!unlockAll)}
          >
            {unlockAll ? strings.unlockAllOn : strings.unlockAllOff}
          </button>
          <p>{strings.unlockAllAbout}</p>
        </section>
      ) : (
        <form
          className="gate"
          onSubmit={(event) => {
            event.preventDefault();
            if (passesGate(question, answer)) {
              setPassed(true);
            } else {
              // A new sum each try, so the answer can't be found by trying numbers in turn.
              setWrong(true);
              setAnswer('');
              setQuestion(gateQuestion());
            }
          }}
        >
          <p>{strings.gateIntro}</p>
          <label>
            {strings.gateQuestion(question.a, question.b)}{' '}
            <input
              value={answer}
              inputMode="numeric"
              autoComplete="off"
              size={4}
              onChange={(event) => setAnswer(event.target.value)}
            />
          </label>
          <button type="submit" className="primary" disabled={answer.trim() === ''}>
            {strings.gateCheck}
          </button>
          <p role="status">{wrong ? strings.gateWrong : ''}</p>
        </form>
      )}
    </main>
  );
}
