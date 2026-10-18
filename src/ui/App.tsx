import type { Board, Build } from '../core/build';
import { newSpec } from '../core/catalogue';
import type { PartAllowance } from '../core/levels';
import { strings } from './strings';
import { Workbench } from './Workbench';

// A sandbox until the chapter PRs bring real levels.
const board: Board & { kind: 'breadboard' } = {
  kind: 'breadboard',
  layout: { columns: 10, centreGap: false, rails: false },
};
const tray: readonly PartAllowance[] = [
  { kind: 'bulb', count: 2 },
  { kind: 'switch', count: 1 },
  { kind: 'button', count: 1 },
  { kind: 'wire', count: 6 },
];
const initial: Build = {
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
};

export function App() {
  return (
    <main>
      <h1>{strings.title}</h1>
      <p>{strings.helloBoard}</p>
      <Workbench board={board} tray={tray} initial={initial} />
    </main>
  );
}
