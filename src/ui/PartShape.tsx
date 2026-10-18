import type { PartSpec } from '../core/build';
import type { Point } from './geometry';
import { strings } from './strings';

/** Distance between flowing dots, in board units. */
const DOT_GAP = 16;

interface PartShapeProps {
  spec: PartSpec;
  from: Point;
  to: Point;
  /** 0 to 1, for bulbs. */
  brightness?: number;
  /** Speed of the flowing dots in board units per second, signed like the current. */
  flow?: number;
  /** A shorted battery. */
  hot?: boolean;
  ghost?: boolean;
  selected?: boolean;
}

/**
 * Placeholder art for a part: its legs, and a body at their midpoint. Real art replaces this
 * behind the same props (`PartSkin`, docs/design.md §7).
 */
export function PartShape({
  spec,
  from,
  to,
  brightness = 0,
  flow = 0,
  hot = false,
  ghost,
  selected,
}: PartShapeProps) {
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const className = [
    'part',
    `part-${spec.kind}`,
    ghost && 'part-ghost',
    selected && 'part-selected',
    hot && 'part-hot',
  ]
    .filter(Boolean)
    .join(' ');

  if (spec.kind === 'wire') {
    return (
      <g className={className}>
        <line className="wire" x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
        <Flow from={from} to={to} speed={flow} />
      </g>
    );
  }

  return (
    <g className={className}>
      <line className="leg" x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
      <Flow from={from} to={to} speed={flow} />
      {body(spec, mid, brightness)}
      {hot && (
        <text className="hot-label" x={mid.x} y={mid.y + 36}>
          {strings.hot}
        </text>
      )}
    </g>
  );
}

function body(spec: PartSpec, { x, y }: Point, brightness: number) {
  switch (spec.kind) {
    case 'battery':
      return (
        <g>
          <rect className="body battery-body" x={x - 26} y={y - 14} width={52} height={28} rx={5} />
          <text className="body-label" x={x} y={y + 6}>
            + −
          </text>
        </g>
      );
    case 'bulb':
      return (
        <g>
          <circle className="bulb-glow" cx={x} cy={y} r={30} opacity={brightness * 0.8} />
          <circle className="body bulb-body" cx={x} cy={y} r={16} />
        </g>
      );
    case 'resistor':
      return (
        <rect className="body resistor-body" x={x - 22} y={y - 8} width={44} height={16} rx={6} />
      );
    case 'capacitor':
      return (
        <rect className="body capacitor-body" x={x - 10} y={y - 14} width={20} height={28} rx={6} />
      );
    case 'switch':
      return (
        <g>
          <rect className="body switch-body" x={x - 20} y={y - 12} width={40} height={24} rx={6} />
          <circle className="switch-knob" cx={spec.closed ? x + 9 : x - 9} cy={y} r={8} />
        </g>
      );
    case 'button':
      return (
        <g>
          <rect className="body button-body" x={x - 18} y={y - 18} width={36} height={36} rx={6} />
          <circle className="button-cap" cx={x} cy={y} r={spec.pressed ? 9 : 12} />
        </g>
      );
    case 'wire':
      return null;
  }
}

/** Dots moving from `from` to `to` (or back, for a negative speed) to show current flowing. */
function Flow({ from, to, speed }: { from: Point; to: Point; speed: number }) {
  if (speed === 0) {
    return null;
  }
  return (
    <line
      className="flow"
      x1={from.x}
      y1={from.y}
      x2={to.x}
      y2={to.y}
      strokeDasharray={`0 ${DOT_GAP}`}
      style={{
        animationDuration: `${DOT_GAP / Math.abs(speed)}s`,
        animationDirection: speed < 0 ? 'reverse' : 'normal',
      }}
    />
  );
}
