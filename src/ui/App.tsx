import { useEffect, useRef, useState } from 'react';
import type { Board, Build } from '../core/build';
import { newSpec } from '../core/catalogue';
import { meterUnlocked, type PartAllowance } from '../core/levels';
import {
  mergeProgress,
  NO_PROGRESS,
  type Progress,
  recordStars,
  type Stars,
} from '../core/progress';
import { levels } from '../levels';
import { LevelList } from './LevelList';
import { LevelScreen } from './LevelScreen';
import { loadSavedProgress, saveProgress } from './progressStore';
import { strings } from './strings';
import { Workbench } from './Workbench';

// Free-build sandboxes, until the sandbox mode in M3: a mini breadboard and a snap board.
const tray: readonly PartAllowance[] = [
  { kind: 'bulb', count: 2 },
  { kind: 'led', count: 2 },
  { kind: 'resistor', count: 2 },
  { kind: 'switch', count: 1 },
  { kind: 'button', count: 1 },
  { kind: 'wire', count: 6 },
];

const breadboard: { board: Board; initial: Build } = {
  board: { kind: 'breadboard', layout: { columns: 10, centreGap: false, rails: 'none' } },
  initial: {
    parts: [
      {
        id: 'battery',
        spec: newSpec('battery'),
        at: [
          { kind: 'terminal', column: 1, row: 'a' },
          { kind: 'terminal', column: 3, row: 'a' },
        ],
        fixed: true,
      },
    ],
  },
};

const snapBoard: { board: Board; initial: Build } = {
  board: { kind: 'snap', rows: 3, columns: 4 },
  initial: {
    parts: [
      {
        id: 'battery',
        spec: newSpec('battery'),
        at: [
          { kind: 'snap', row: 1, column: 1 },
          { kind: 'snap', row: 1, column: 2 },
        ],
        fixed: true,
      },
    ],
  },
};

// A half-size board with a centre gap and power rails (chapters 3–5), its battery in the top rails.
const halfBoard: { board: Board; initial: Build } = {
  board: { kind: 'breadboard', layout: { columns: 30, centreGap: true, rails: 'both' } },
  initial: {
    parts: [
      {
        id: 'battery',
        spec: newSpec('battery'),
        at: [
          { kind: 'rail', rail: 'top+', position: 1 },
          { kind: 'rail', rail: 'top-', position: 1 },
        ],
        fixed: true,
      },
    ],
  },
};

// A full-size board, 63 columns with both rail pairs: too big to show whole, so it pans and zooms.
const fullBoard: { board: Board; initial: Build } = {
  board: { kind: 'breadboard', layout: { columns: 63, centreGap: true, rails: 'both' } },
  initial: halfBoard.initial,
};

/**
 * `?sandbox=breadboard`, `?sandbox=half`, `?sandbox=full` or `?sandbox=snap` opens a free-build
 * board, for development and tests.
 */
const sandboxes: Readonly<Record<string, { board: Board; initial: Build }>> = {
  breadboard,
  half: halfBoard,
  full: fullBoard,
  snap: snapBoard,
};
const sandboxParam = new URLSearchParams(window.location.search).get('sandbox');
const sandbox = sandboxParam === null ? null : (sandboxes[sandboxParam] ?? breadboard);

type Screen = { readonly kind: 'levels' } | { readonly kind: 'level'; readonly index: number };

export function App() {
  const [screen, setScreen] = useState<Screen>({ kind: 'levels' });
  const [progress, setProgress] = useState<Progress>(NO_PROGRESS);

  // Saved progress arrives a moment after the first render; keep anything earned in between, and
  // save only once it has arrived so a quick finish can't overwrite it.
  const [loaded, setLoaded] = useState(false);
  const unsaved = useRef(false);
  useEffect(() => {
    void loadSavedProgress().then((saved) => {
      setProgress((p) => mergeProgress(saved, p));
      setLoaded(true);
    });
  }, []);
  useEffect(() => {
    if (loaded && unsaved.current) {
      unsaved.current = false;
      void saveProgress(progress);
    }
  }, [loaded, progress]);

  const finish = (levelId: string, stars: Stars) => {
    // Only earning stars saves, so saved data this version can't read survives until then.
    unsaved.current = true;
    setProgress((p) => recordStars(p, levelId, stars));
  };

  if (sandbox) {
    return (
      <main className="fit-screen">
        <h1>{strings.title}</h1>
        <p>{sandbox === snapBoard ? strings.helloSnap : strings.helloBoard}</p>
        <Workbench
          board={sandbox.board}
          tray={tray}
          initial={sandbox.initial}
          meter
          zoomable={sandbox === fullBoard}
        />
      </main>
    );
  }

  if (screen.kind === 'level') {
    const level = levels[screen.index]!;
    const next = screen.index + 1 < levels.length ? screen.index + 1 : null;
    return (
      <LevelScreen
        key={level.id}
        level={level}
        onFinish={(stars) => finish(level.id, stars)}
        onNext={next === null ? null : () => setScreen({ kind: 'level', index: next })}
        onBack={() => setScreen({ kind: 'levels' })}
        meter={meterUnlocked(levels, progress.stars)}
      />
    );
  }

  return (
    <LevelList
      levels={levels}
      progress={progress}
      onPlay={(level) => setScreen({ kind: 'level', index: levels.indexOf(level) })}
    />
  );
}
