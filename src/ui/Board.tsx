import { type PointerEvent as ReactPointerEvent, type Ref, useState } from 'react';
import { holeName, holesOf, stripOf } from '../core/breadboard';
import type { Board as BoardModel, Build, PartSpec } from '../core/build';
import { boardSize, HOLE_RADIUS, holePosition, type Point, type Terminal } from './geometry';
import { PartShape } from './PartShape';
import { strings } from './strings';

export interface Ghost {
  readonly spec: PartSpec;
  readonly from: Point;
  readonly to: Point;
}

interface BoardProps {
  ref?: Ref<SVGSVGElement>;
  board: BoardModel & { kind: 'breadboard' };
  build: Build;
  brightness: ReadonlyMap<string, number>;
  flows: ReadonlyMap<string, number>;
  hot: ReadonlySet<string>;
  selectedId: string | null;
  ghost: Ghost | null;
  onHolePointerDown: (hole: Terminal, event: ReactPointerEvent) => void;
  onPartPointerDown: (id: string, event: ReactPointerEvent) => void;
}

/** A breadboard with the child's parts on it. The strip under the pointer is highlighted. */
export function Board({
  ref,
  board,
  build,
  brightness,
  flows,
  hot,
  selectedId,
  ghost,
  onHolePointerDown,
  onPartPointerDown,
}: BoardProps) {
  const { layout } = board;
  const [activeStrip, setActiveStrip] = useState<string | null>(null);
  const terminals = holesOf(layout).filter((hole): hole is Terminal => hole.kind === 'terminal');
  const { width, height } = boardSize(layout);

  return (
    <svg
      ref={ref}
      className="board"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={strings.boardLabel}
      onPointerLeave={() => setActiveStrip(null)}
    >
      <rect className="board-body" x={0} y={0} width={width} height={height} rx={16} />
      {terminals.map((hole) => {
        const strip = stripOf(layout, hole);
        const { x, y } = holePosition(hole);
        return (
          <circle
            key={holeName(hole)}
            data-hole={holeName(hole)}
            className={strip === activeStrip ? 'hole hole-active' : 'hole'}
            cx={x}
            cy={y}
            r={HOLE_RADIUS}
            onPointerEnter={() => setActiveStrip(strip)}
            onPointerDown={(event) => {
              setActiveStrip(strip);
              onHolePointerDown(hole, event);
            }}
          />
        );
      })}
      {build.parts.map((part) => {
        const [a, b] = part.at;
        if (a.kind !== 'terminal' || b.kind !== 'terminal') {
          return null;
        }
        return (
          <g
            key={part.id}
            data-part={part.id}
            onPointerDown={(event) => onPartPointerDown(part.id, event)}
          >
            <PartShape
              spec={part.spec}
              from={holePosition(a)}
              to={holePosition(b)}
              brightness={brightness.get(part.id) ?? 0}
              flow={flows.get(part.id) ?? 0}
              hot={hot.has(part.id)}
              selected={part.id === selectedId}
            />
          </g>
        );
      })}
      {ghost && <PartShape spec={ghost.spec} from={ghost.from} to={ghost.to} ghost />}
    </svg>
  );
}
