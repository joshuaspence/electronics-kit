import { useState } from 'react';
import type { Board, Build } from '../core/build';
import { newSpec } from '../core/catalogue';
import type { PartAllowance } from '../core/levels';
import { NO_PROGRESS, type Progress, recordStars } from '../core/progress';
import { levels } from '../levels';
import { LevelList } from './LevelList';
import { LevelScreen } from './LevelScreen';
import { strings } from './strings';
import { Workbench } from './Workbench';

// Free-build sandboxes, until the sandbox mode in M3: a mini breadboard and a snap board.
const tray: readonly PartAllowance[] = [
  { kind: 'bulb', count: 2 },
  { kind: 'switch', count: 1 },
  { kind: 'button', count: 1 },
  { kind: 'wire', count: 6 },
];

const breadboard: { board: Board; initial: Build } = {
  board: { kind: 'breadboard', layout: { columns: 10, centreGap: false, rails: false } },
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

/** `?sandbox=breadboard` or `?sandbox=snap` opens a free-build board, for development and tests. */
const sandboxParam = new URLSearchParams(window.location.search).get('sandbox');
const sandbox = sandboxParam === 'snap' ? snapBoard : sandboxParam === null ? null : breadboard;

type Screen = { readonly kind: 'levels' } | { readonly kind: 'level'; readonly index: number };

export function App() {
  const [screen, setScreen] = useState<Screen>({ kind: 'levels' });
  const [progress, setProgress] = useState<Progress>(NO_PROGRESS);

  if (sandbox) {
    return (
      <main>
        <h1>{strings.title}</h1>
        <p>{sandbox === snapBoard ? strings.helloSnap : strings.helloBoard}</p>
        <Workbench board={sandbox.board} tray={tray} initial={sandbox.initial} />
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
        onFinish={(stars) => setProgress((p) => recordStars(p, level.id, stars))}
        onNext={next === null ? null : () => setScreen({ kind: 'level', index: next })}
        onBack={() => setScreen({ kind: 'levels' })}
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
