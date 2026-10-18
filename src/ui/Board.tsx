import { useState } from 'react';
import {
  type BoardLayout,
  type Hole,
  holeName,
  holesOf,
  stripOf,
  TERMINAL_ROWS,
} from '../core/breadboard';
import { strings } from './strings';

const PITCH = 40;
const MARGIN = 30;
const HOLE_RADIUS = 9;

interface BoardProps {
  layout: BoardLayout;
}

/** A breadboard that highlights the strip under the pointer. */
export function Board({ layout }: BoardProps) {
  const [activeStrip, setActiveStrip] = useState<string | null>(null);
  const terminals = holesOf(layout).filter((hole) => hole.kind === 'terminal');
  const width = MARGIN * 2 + PITCH * (layout.columns - 1);
  const height = MARGIN * 2 + PITCH * (TERMINAL_ROWS.length - 1);

  return (
    <svg
      className="board"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={strings.boardLabel}
      onPointerLeave={() => setActiveStrip(null)}
    >
      <rect className="board-body" x={0} y={0} width={width} height={height} rx={16} />
      {terminals.map((hole) => {
        const strip = stripOf(layout, hole);
        const { x, y } = position(hole);
        return (
          <circle
            key={holeName(hole)}
            data-hole={holeName(hole)}
            className={strip === activeStrip ? 'hole hole-active' : 'hole'}
            cx={x}
            cy={y}
            r={HOLE_RADIUS}
            onPointerEnter={() => setActiveStrip(strip)}
            onPointerDown={() => setActiveStrip(strip)}
          />
        );
      })}
    </svg>
  );
}

function position(hole: Hole & { kind: 'terminal' }): { x: number; y: number } {
  return {
    x: MARGIN + PITCH * (hole.column - 1),
    y: MARGIN + PITCH * TERMINAL_ROWS.indexOf(hole.row),
  };
}
