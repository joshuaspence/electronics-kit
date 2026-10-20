import { type PointerEvent as ReactPointerEvent, type Ref, useState } from 'react';
import type { Build, Location, PartSpec } from '../core/build';
import type { BoardGeometry, Point } from './geometry';
import { PartShape } from './PartShape';
import { strings } from './strings';

/**
 * The most screen pixels per board unit a snap board grows to: posts 165 px apart and about 50 px
 * across, big targets for small fingers without a 2×3 board filling a tablet (docs/design.md §5).
 */
const SNAP_MAX_SCALE = 1.5;

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
  /** Where a part being dragged will land, drawn faintly there. */
  ghost: Ghost | null;
  /** The part being dragged, drawn lifted under the pointer wherever it is. */
  held: Ghost | null;
  /** A placed part being moved, drawn faded where it was. */
  movingId: string | null;
  /**
   * While dragging, the strips the part would join if dropped now, highlighted in place of the
   * strip under the pointer; none when it wouldn't land.
   */
  targetStrips: ReadonlySet<string> | null;
  /** A part one of Volty's hints suggests placing, drawn faintly where it goes. */
  hintGhost: Ghost | null;
  /** A placed part one of Volty's hints points at. */
  hintedId: string | null;
  onHolePointerDown: (location: Location, event: ReactPointerEvent) => void;
  onPartPointerDown: (id: string, event: ReactPointerEvent) => void;
  /**
   * The part of a zoomable board in view, as a viewBox `[x, y, width, height]` in board units;
   * otherwise the whole board is shown.
   */
  view?: readonly [number, number, number, number] | undefined;
  /** A press on the board itself, between holes and parts: on a zoomable board, a pan. */
  onBackgroundPointerDown?: ((event: ReactPointerEvent) => void) | undefined;
  /** The battery beside the board is the sandbox's power supply. */
  supply?: boolean;
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
  held,
  movingId,
  targetStrips,
  hintGhost,
  hintedId,
  onHolePointerDown,
  onPartPointerDown,
  view,
  onBackgroundPointerDown,
  supply = false,
}: BoardProps) {
  const [hoverStrip, setHoverStrip] = useState<string | null>(null);
  const lit = (strip: string) => (targetStrips ? targetStrips.has(strip) : strip === hoverStrip);
  const { width, height } = geometry;

  // Each power rail gets a red or blue stripe and a + or − at its right end, clear of the battery's
  // leads on the left.
  const rails = geometry.locations
    .filter((location) => location.kind === 'rail' && location.position === 1)
    .map((location) => {
      const plus = location.kind === 'rail' && location.rail.endsWith('+');
      const { x, y } = geometry.position(location);
      const end = geometry.offset(location, 0, geometry.columns - 1)!;
      return (
        <g key={geometry.name(location)} className={plus ? 'rail rail-plus' : 'rail rail-minus'}>
          <line x1={x} y1={y - 16} x2={geometry.position(end).x} y2={y - 16} />
          <text x={geometry.position(end).x + 18} y={y + 5}>
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
        className={lit(strip) ? 'hole hole-active' : 'hole'}
        cx={x}
        cy={y}
        r={geometry.radius}
        onPointerEnter={() => setHoverStrip(strip)}
        onPointerDown={(event) => {
          setHoverStrip(strip);
          onHolePointerDown(location, event);
        }}
      />
    );
  });

  return (
    <svg
      ref={ref}
      className={['board', snap && 'board-snap', view && 'board-zoomable']
        .filter(Boolean)
        .join(' ')}
      viewBox={view ? view.join(' ') : `0 0 ${width} ${height}`}
      // A snap board has only a few posts, so filling the space would blow them up: it grows no
      // bigger than SNAP_MAX_SCALE screen pixels per board unit.
      style={
        snap && !view
          ? { maxWidth: width * SNAP_MAX_SCALE, maxHeight: height * SNAP_MAX_SCALE }
          : undefined
      }
      role="img"
      aria-label={strings.boardLabel}
      onPointerLeave={() => setHoverStrip(null)}
    >
      <rect
        className="board-body"
        x={0}
        y={0}
        width={width}
        height={height}
        rx={16}
        onPointerDown={onBackgroundPointerDown}
      />
      {rails}
      {!snap && holes}
      {build.parts.map((part) => {
        const [a, b] = part.at;
        return (
          <g
            key={part.id}
            data-part={part.id}
            className={part.id === movingId ? 'part-moving' : undefined}
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
              beside={
                part.spec.kind === 'battery' &&
                part.at.every((l) => l.kind === 'rail' && l.position === 1)
              }
              supply={supply}
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
      {held && (
        <g className="held">
          <PartShape spec={held.spec} from={held.from} to={held.to} />
        </g>
      )}
    </svg>
  );
}
