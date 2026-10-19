import { type PointerEvent as ReactPointerEvent, type Ref, useState } from 'react';
import type { Build, Location, PartSpec } from '../core/build';
import type { BoardGeometry, Point } from './geometry';
import { PartShape } from './PartShape';
import { strings } from './strings';

export interface Ghost {
  readonly spec: PartSpec;
  readonly from: Point;
  readonly to: Point;
}

interface BoardProps {
  ref?: Ref<SVGSVGElement>;
  geometry: BoardGeometry;
  /** A snap board (chapter 1) rather than a breadboard. */
  snap: boolean;
  build: Build;
  brightness: ReadonlyMap<string, number>;
  flows: ReadonlyMap<string, number>;
  hot: ReadonlySet<string>;
  selectedId: string | null;
  ghost: Ghost | null;
  /** A part one of Volty's hints suggests placing, drawn faintly where it goes. */
  hintGhost: Ghost | null;
  /** A placed part one of Volty's hints points at. */
  hintedId: string | null;
  onHolePointerDown: (location: Location, event: ReactPointerEvent) => void;
  onPartPointerDown: (id: string, event: ReactPointerEvent) => void;
}

/**
 * A board with the child's parts on it. The strip under the pointer is highlighted, so a child can
 * see which breadboard holes are joined.
 */
export function Board({
  ref,
  geometry,
  snap,
  build,
  brightness,
  flows,
  hot,
  selectedId,
  ghost,
  hintGhost,
  hintedId,
  onHolePointerDown,
  onPartPointerDown,
}: BoardProps) {
  const [activeStrip, setActiveStrip] = useState<string | null>(null);
  const { width, height } = geometry;

  // Each power rail gets a red or blue stripe and a + or − at its left end, as on a real board.
  const rails = geometry.locations
    .filter((location) => location.kind === 'rail' && location.position === 1)
    .map((location) => {
      const plus = location.kind === 'rail' && location.rail.endsWith('+');
      const { x, y } = geometry.position(location);
      const end = geometry.offset(location, 0, geometry.columns - 1)!;
      return (
        <g key={geometry.name(location)} className={plus ? 'rail rail-plus' : 'rail rail-minus'}>
          <line x1={x} y1={y - 16} x2={geometry.position(end).x} y2={y - 16} />
          <text x={x - 18} y={y + 5}>
            {plus ? '+' : '−'}
          </text>
        </g>
      );
    });
  const holes = geometry.locations.map((location) => {
    const strip = geometry.stripKey(location);
    const { x, y } = geometry.position(location);
    return (
      <circle
        key={geometry.name(location)}
        data-hole={geometry.name(location)}
        className={strip === activeStrip ? 'hole hole-active' : 'hole'}
        cx={x}
        cy={y}
        r={geometry.radius}
        onPointerEnter={() => setActiveStrip(strip)}
        onPointerDown={(event) => {
          setActiveStrip(strip);
          onHolePointerDown(location, event);
        }}
      />
    );
  });

  return (
    <svg
      ref={ref}
      className={snap ? 'board board-snap' : 'board'}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={strings.boardLabel}
      onPointerLeave={() => setActiveStrip(null)}
    >
      <rect className="board-body" x={0} y={0} width={width} height={height} rx={16} />
      {rails}
      {!snap && holes}
      {build.parts.map((part) => {
        const [a, b] = part.at;
        return (
          <g
            key={part.id}
            data-part={part.id}
            onPointerDown={(event) => onPartPointerDown(part.id, event)}
          >
            <PartShape
              spec={part.spec}
              from={geometry.position(a)}
              to={geometry.position(b)}
              brightness={brightness.get(part.id) ?? 0}
              flow={flows.get(part.id) ?? 0}
              hot={hot.has(part.id)}
              selected={part.id === selectedId}
              hinted={part.id === hintedId}
            />
          </g>
        );
      })}
      {/* A snap post takes any number of parts, so it stays on top where a wire can start from it. */}
      {snap && holes}
      {hintGhost && (
        <PartShape spec={hintGhost.spec} from={hintGhost.from} to={hintGhost.to} ghost hinted />
      )}
      {ghost && <PartShape spec={ghost.spec} from={ghost.from} to={ghost.to} ghost />}
    </svg>
  );
}
