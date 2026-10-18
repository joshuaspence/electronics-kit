import type { BoardLayout } from '../core/breadboard';
import { Board } from './Board';
import { strings } from './strings';

const miniBoard: BoardLayout = { columns: 10, centreGap: false, rails: false };

export function App() {
  return (
    <main>
      <h1>{strings.title}</h1>
      <p>{strings.helloBoard}</p>
      <Board layout={miniBoard} />
    </main>
  );
}
