import type { PartSpec } from '../core/build';
import { BATTERY_ROOM, type Point } from './geometry';
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
  /** Pointed out by one of Volty's hints. */
  hinted?: boolean;
  ghost?: boolean;
  selected?: boolean;
  /** A battery plugged into the rails at the board's edge: the pack sits beside the board. */
  beside?: boolean;
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
  hinted = false,
  ghost,
  selected,
  beside = false,
}: PartShapeProps) {
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const className = [
    'part',
    `part-${spec.kind}`,
    ghost && 'part-ghost',
    selected && 'part-selected',
    hot && 'part-hot',
    spec.kind === 'led' && spec.blown && 'part-blown',
    hinted && 'part-hinted',
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

  // A battery beside the board has leads instead of legs running between its holes.
  return (
    <g className={className}>
      {!beside && <line className="leg" x1={from.x} y1={from.y} x2={to.x} y2={to.y} />}
      {!beside && <Flow from={from} to={to} speed={flow} />}
      {body(spec, from, to, brightness, beside)}
      {hot && (
        <text className="hot-label" x={mid.x} y={mid.y + 36}>
          {strings.hot}
        </text>
      )}
    </g>
  );
}

function body(spec: PartSpec, from: Point, to: Point, brightness: number, beside: boolean) {
  const x = (from.x + to.x) / 2;
  const y = (from.y + to.y) / 2;
  switch (spec.kind) {
    case 'led': {
      // A dome with a flat edge and a bar on the cathode (−) side, and a + by the anode's long
      // leg, so a child can see which way round it goes.
      const angle = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
      const plus = { x: from.x * 0.7 + to.x * 0.3, y: from.y * 0.7 + to.y * 0.3 - 14 };
      return (
        <g>
          <g transform={`rotate(${angle} ${x} ${y})`}>
            <circle className="led-glow" cx={x} cy={y} r={22} opacity={brightness * 0.9} />
            <path
              className="body led-body"
              d={`M ${x + 6} ${y - 12} A 12 12 0 1 0 ${x + 6} ${y + 12} Z`}
            />
            <line className="led-cathode" x1={x + 6} y1={y - 12} x2={x + 6} y2={y + 12} />
          </g>
          {spec.blown && <circle className="led-puff" cx={x} cy={y} r={24} />}
          <text className="led-anode" x={plus.x} y={plus.y}>
            +
          </text>
        </g>
      );
    }
    case 'battery': {
      // Beside the board, the pack sits in the room left of the first column with a lead to each
      // rail.
      const bx = beside ? from.x - BATTERY_ROOM + 20 : x;
      return (
        <g>
          {beside && (
            <>
              <line className="lead lead-plus" x1={bx} y1={y} x2={from.x} y2={from.y} />
              <line className="lead lead-minus" x1={bx} y1={y} x2={to.x} y2={to.y} />
            </>
          )}
          <rect
            className="body battery-body"
            x={bx - 26}
            y={y - 14}
            width={52}
            height={28}
            rx={5}
          />
          <text className="body-label" x={bx} y={y + 6}>
            + −
          </text>
        </g>
      );
    }
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
