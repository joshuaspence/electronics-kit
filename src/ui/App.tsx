import type { Board, Build } from '../core/build';
import { newSpec } from '../core/catalogue';
import type { PartAllowance } from '../core/levels';
import { strings } from './strings';
import { Workbench } from './Workbench';

// Sandboxes until the chapter PRs bring real levels: a mini breadboard, or with `?board=snap` the
// snap board chapter 1 uses.
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

const sandbox =
  new URLSearchParams(window.location.search).get('board') === 'snap' ? snapBoard : breadboard;

export function App() {
  return (
    <main>
      <h1>{strings.title}</h1>
      <p>{sandbox === snapBoard ? strings.helloSnap : strings.helloBoard}</p>
      <Workbench board={sandbox.board} tray={tray} initial={sandbox.initial} />
    </main>
  );
}
