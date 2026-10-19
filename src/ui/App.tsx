import { useEffect, useRef, useState } from 'react';
import type { Board, Build } from '../core/build';
import { newSpec } from '../core/catalogue';
import { meterUnlocked, type PartAllowance, sandboxTray } from '../core/levels';
import { decodeCircuit, encodeCircuit } from '../core/share';
import {
  addProfile,
  currentProfile,
  mergePlayers,
  NO_PLAYERS,
  type Players,
  setUnlockAll,
  switchProfile,
  updateProgress,
} from '../core/profiles';
import { recordStars, type Stars } from '../core/progress';
import { levels } from '../levels';
import { sandbox as fullBoard } from '../levels/sandbox';
import { LevelList } from './LevelList';
import { LevelScreen } from './LevelScreen';
import { SandboxScreen } from './SandboxScreen';
import { PlayersScreen } from './PlayersScreen';
import { TeacherScreen } from './TeacherScreen';
import { loadSavedPlayers, saveSavedPlayers } from './progressStore';
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
    }
  | { readonly kind: 'players' }
  | { readonly kind: 'grown-ups' };

/**
 * The sandbox a share link's fragment (`#c=…`, docs/design.md §2) opens, offering the parts
 * unlocked by `stars`.
 */
function shareScreen(
  hash: string,
  stars: Readonly<Record<string, number>>,
  unlockAll: boolean,
): Screen {
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
  const tray = sandboxTray(levels, stars, unlockAll);
  return shared
    ? { kind: 'sandbox', tray, initial: shared }
    : { kind: 'sandbox', tray, initial: fullBoard.initial, badLink: true };
}

const shareLink = () => (window.location.hash.startsWith('#c=') ? window.location.hash : null);

export function App() {
  const [screen, setScreen] = useState<Screen>({ kind: 'levels' });
  const [players, setPlayers] = useState<Players>(NO_PLAYERS);
  const profile = currentProfile(players);
  const { progress } = profile;

  // Saved players arrive a moment after the first render; keep anything earned in between, and
  // save only once they have arrived so a quick finish can't overwrite them.
  const [loaded, setLoaded] = useState(false);
  const unsaved = useRef(false);
  useEffect(() => {
    void loadSavedPlayers().then((saved) => {
      setPlayers((p) => mergePlayers(saved, currentProfile(p).progress));
      setLoaded(true);
    });
  }, []);

  // A share link opens once saved players have arrived, so its tray offers every part unlocked so
  // far. One pasted into a tab already showing the game changes only the fragment, which doesn't
  // reload the page, so listen for that from the start rather than miss one while loading.
  const [link, setLink] = useState(shareLink);
  useEffect(() => {
    const onHashChange = () => setLink(shareLink());
    window.addEventListener('hashchange', onHashChange);
    // The fragment can change between the first render reading it and this listener being added.
    onHashChange();
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  if (loaded && link !== null) {
    setLink(null);
    setScreen(shareScreen(link, progress.stars, players.unlockAll));
  }

  useEffect(() => {
    if (loaded && unsaved.current) {
      unsaved.current = false;
      void saveSavedPlayers(players);
    }
  }, [loaded, players]);

  // Only earning stars, changing players or a grown-ups' setting saves, so saved data this version
  // can't read survives until then.
  const change = (update: (players: Players) => Players) => {
    unsaved.current = true;
    setPlayers(update);
  };
  const finish = (levelId: string, stars: Stars) =>
    change((p) => updateProgress(p, (progress) => recordStars(progress, levelId, stars)));

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

  if (screen.kind === 'players') {
    return (
      <PlayersScreen
        players={players}
        onChoose={(id) => {
          if (id !== players.current) {
            change((p) => switchProfile(p, id));
          }
          setScreen({ kind: 'levels' });
        }}
        onAdd={(name, avatar) => {
          change((p) => addProfile(p, name, avatar));
          setScreen({ kind: 'levels' });
        }}
        onBack={() => setScreen({ kind: 'levels' })}
      />
    );
  }

  if (screen.kind === 'grown-ups') {
    return (
      <TeacherScreen
        unlockAll={players.unlockAll}
        onUnlockAll={(on) => change((p) => setUnlockAll(p, on))}
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
        meter={meterUnlocked(levels, progress.stars, players.unlockAll)}
        guide={(progress.stars[level.id] ?? 0) === 0}
      />
    );
  }

  return (
    <LevelList
      levels={levels}
      progress={progress}
      profile={profile}
      onPlay={(level) => setScreen({ kind: 'level', index: levels.indexOf(level) })}
      onSandbox={() =>
        setScreen({
          kind: 'sandbox',
          tray: sandboxTray(levels, progress.stars, players.unlockAll),
          initial: fullBoard.initial,
        })
      }
      onPlayers={loaded ? () => setScreen({ kind: 'players' }) : null}
      onGrownUps={loaded ? () => setScreen({ kind: 'grown-ups' }) : null}
    />
  );
}
