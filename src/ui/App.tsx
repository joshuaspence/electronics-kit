import { useEffect, useRef, useState } from 'react';
import type { Board, Build } from '../core/build';
import { newSpec } from '../core/catalogue';
import { meterUnlocked, type PartAllowance, sandboxTray } from '../core/levels';
import { decodeCircuit, encodeCircuit } from '../core/share';
import {
  mergeProgress,
  NO_PROGRESS,
  type Progress,
  recordStars,
  type Stars,
} from '../core/progress';
import { levels } from '../levels';
import { sandbox as fullBoard } from '../levels/sandbox';
import { LevelList } from './LevelList';
import { LevelScreen } from './LevelScreen';
import { SandboxScreen } from './SandboxScreen';
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

type Screen =
  | { readonly kind: 'levels' }
  | { readonly kind: 'level'; readonly index: number }
  // The tray is fixed when the sandbox opens: a new tray means a new editor, emptying the board.
  | {
      readonly kind: 'sandbox';
      readonly tray: readonly PartAllowance[];
      readonly initial: Build;
      readonly badLink?: boolean;
    };

/**
 * The sandbox a share link's fragment (`#c=…`, docs/design.md §2) opens, offering the parts
 * unlocked by `stars`.
 */
function shareScreen(hash: string, stars: Readonly<Record<string, number>>): Screen {
  let shared: Build | null = null;
  try {
    shared = decodeCircuit(
      fullBoard.board.layout,
      fullBoard.initial,
      decodeURIComponent(hash.slice('#c='.length)),
    );
  } catch {
    // A fragment that isn't valid percent-encoding is a bad link like any other.
  }
  const tray = sandboxTray(levels, stars);
  return shared
    ? { kind: 'sandbox', tray, initial: shared }
    : { kind: 'sandbox', tray, initial: fullBoard.initial, badLink: true };
}

const shareLink = () => (window.location.hash.startsWith('#c=') ? window.location.hash : null);

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

  // A share link opens once saved progress has arrived, so its tray offers every part unlocked so
  // far. One pasted into a tab already showing the game changes only the fragment, which doesn't
  // reload the page, so listen for that from the start rather than miss one while loading.
  const [link, setLink] = useState(shareLink);
  useEffect(() => {
    const onHashChange = () => setLink(shareLink());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  if (loaded && link !== null) {
    setLink(null);
    setScreen(shareScreen(link, progress.stars));
  }

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

  if (screen.kind === 'sandbox') {
    return (
      <SandboxScreen
        // A new circuit, such as another share link, starts the sandbox afresh.
        key={`${encodeCircuit(screen.initial)}:${screen.badLink ?? false}`}
        tray={screen.tray}
        meter
        initial={screen.initial}
        badLink={screen.badLink ?? false}
        onBack={() => setScreen({ kind: 'levels' })}
      />
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
      onSandbox={() =>
        setScreen({
          kind: 'sandbox',
          tray: sandboxTray(levels, progress.stars),
          initial: fullBoard.initial,
        })
      }
    />
  );
}
