import type { PartSpec } from '../core/build';
import { type BandColour, colourBands } from '../core/colourCode';
import { SUPPLY_VOLTS } from '../core/catalogue';
import { BATTERY_ROOM, type Point } from './geometry';
import { strings } from './strings';

/** Where each colour band sits along a resistor's body: three close together, then tolerance. */
const BAND_OFFSETS = [-13, -6, 1, 13];

const BAND_HEX: Readonly<Record<BandColour, string>> = {
  black: '#1b1b1b',
  brown: '#7a4a24',
  red: '#d6322e',
  orange: '#f07f1f',
  yellow: '#f6d02f',
  green: '#2f9a4a',
  blue: '#2a64d6',
  violet: '#8a45c2',
  grey: '#8c8c8c',
  white: '#f6f6f2',
  gold: '#c9a227',
  silver: '#b8bcc2',
};

/** Distance between flowing dots, in board units. */
const DOT_GAP = 16;

interface PartShapeProps {
  spec: PartSpec;
  from: Point;
  to: Point;
  /**
   * How hard the part is working: a light's brightness, 0 to 1; a buzzer's 1 while it sounds; a
   * motor's speed, −1 to 1, negative turning the other way; how full a capacitor is, 0 to 1;
   * 1 while a blinker chip is on and passing current.
   */
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
  /** A battery beside the board drawn as the sandbox's bench power supply, showing its volts. */
  supply?: boolean;
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
  supply = false,
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
      {beside && supply && spec.kind === 'battery'
        ? supplyBody(spec.volts, from, to)
        : body(spec, from, to, brightness, beside)}
      {hot && (
        <text className="hot-label" x={mid.x} y={mid.y + 36}>
          {strings.hot}
        </text>
      )}
    </g>
  );
}

/**
 * A bench power supply in the room left of the first column: a case with a display of its volts, a
 * knob turned as far as they are, and a red + and black − terminal with a lead to each rail.
 */
function supplyBody(volts: number, from: Point, to: Point) {
  const left = from.x - BATTERY_ROOM - 12;
  const top = (from.y + to.y) / 2 - 32;
  const knob = { x: left + 18, y: top + 46 };
  const turn = -135 + (270 * (volts - SUPPLY_VOLTS.min)) / (SUPPLY_VOLTS.max - SUPPLY_VOLTS.min);
  const plus = { x: left + 44, y: top + 46 };
  const minus = { x: left + 62, y: top + 46 };
  return (
    <g>
      <rect
        className="body battery-body supply-body"
        x={left}
        y={top}
        width={74}
        height={64}
        rx={6}
      />
      <rect className="supply-screen" x={left + 6} y={top + 6} width={62} height={22} rx={3} />
      <text className="supply-reading" x={left + 37} y={top + 23}>
        {strings.supplyVolts(volts)}
      </text>
      <circle className="supply-knob" cx={knob.x} cy={knob.y} r={11} />
      <line
        className="supply-pointer"
        x1={knob.x}
        y1={knob.y}
        x2={knob.x}
        y2={knob.y - 8}
        transform={`rotate(${turn} ${knob.x} ${knob.y})`}
      />
      <line className="lead lead-plus" x1={plus.x} y1={plus.y} x2={from.x} y2={from.y} />
      <line className="lead lead-minus" x1={minus.x} y1={minus.y} x2={to.x} y2={to.y} />
      <circle className="supply-terminal supply-plus" cx={plus.x} cy={plus.y} r={6} />
      <circle className="supply-terminal supply-minus" cx={minus.x} cy={minus.y} r={6} />
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
          {/* A big black cell on its side: the + terminal's nub and a red end on the left. */}
          <rect className="body battery-nub" x={bx - 35} y={y - 7} width={7} height={14} rx={2} />
          <rect
            className="body battery-body"
            x={bx - 30}
            y={y - 15}
            width={60}
            height={30}
            rx={6}
          />
          <rect className="battery-plus" x={bx - 27} y={y - 12} width={15} height={24} rx={3} />
          <path
            className="battery-bolt"
            d={`M ${bx + 2} ${y - 11} L ${bx - 6} ${y + 2} H ${bx - 1} L ${bx - 3} ${y + 11} L ${bx + 6} ${y - 3} H ${bx + 1} Z`}
          />
          <text className="body-label" x={bx - 19.5} y={y + 5.5}>
            +
          </text>
          <text className="body-label" x={bx + 20} y={y + 5.5}>
            −
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
    case 'resistor': {
      // Its value in colour bands along the body, which turns with the legs.
      const angle = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
      return (
        <g transform={`rotate(${angle} ${x} ${y})`}>
          <rect className="body resistor-body" x={x - 22} y={y - 8} width={44} height={16} rx={6} />
          {colourBands(spec.ohms).map((band, i) => (
            <rect
              key={i}
              className="resistor-band"
              x={x + BAND_OFFSETS[i]! - 2}
              y={y - 8}
              width={4}
              height={16}
              fill={BAND_HEX[band]}
            />
          ))}
        </g>
      );
    }
    case 'capacitor':
      // A can that fills from the bottom as it charges, so a child can watch it fill and empty.
      return (
        <g>
          <rect
            className="body capacitor-body"
            x={x - 10}
            y={y - 14}
            width={20}
            height={28}
            rx={6}
          />
          {brightness > 0 && (
            <rect
              className="capacitor-charge"
              x={x - 7}
              y={y + 11 - 22 * brightness}
              width={14}
              height={22 * brightness}
              rx={3}
            />
          )}
        </g>
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
    case 'buzzer':
      // A round black buzzer with a sound hole, which wobbles while it sounds.
      return (
        <g className={brightness > 0 ? 'buzzer-on' : undefined}>
          <g className="buzzer-shake" style={{ transformOrigin: `${x}px ${y}px` }}>
            <circle className="body buzzer-body" cx={x} cy={y} r={17} />
            <circle className="buzzer-hole" cx={x} cy={y} r={4} />
          </g>
          {brightness > 0 && (
            <path
              className="buzzer-waves"
              d={`M ${x + 22} ${y - 9} q 6 9 0 18 M ${x + 28} ${y - 15} q 10 15 0 30`}
            />
          )}
        </g>
      );
    case 'light-sensor': {
      // A round sensor with its zigzag track, under rays that show how much light falls on it.
      const rays = [0, 45, 90, 135, 180, 225, 270, 315];
      return (
        <g>
          <g className="sensor-rays" opacity={spec.light}>
            {rays.map((angle) => (
              <line
                key={angle}
                x1={x}
                y1={y - 21}
                x2={x}
                y2={y - 27}
                transform={`rotate(${angle} ${x} ${y})`}
              />
            ))}
          </g>
          <circle className="body sensor-body" cx={x} cy={y} r={16} />
          <path className="sensor-track" d={`M ${x - 9} ${y - 6} h 18 l -18 6 h 18 l -18 6 h 18`} />
        </g>
      );
    }
    case 'blinker':
      // A black chip with a notch at one end and a little light that shows when it is on.
      return (
        <g>
          <rect className="body blinker-body" x={x - 20} y={y - 13} width={40} height={26} rx={3} />
          <path className="blinker-notch" d={`M ${x - 20} ${y - 5} a 5 5 0 0 1 0 10`} />
          <circle
            className={brightness > 0 ? 'blinker-light blinker-on' : 'blinker-light'}
            cx={x + 8}
            cy={y}
            r={5}
          />
        </g>
      );
    case 'motor': {
      // A can with a fan on its shaft, turning faster with the current, and backwards with it.
      const speed = Math.abs(brightness);
      return (
        <g>
          <rect className="body motor-body" x={x - 18} y={y - 15} width={36} height={30} rx={8} />
          <g
            className={speed > 0 ? 'motor-fan motor-on' : 'motor-fan'}
            style={{
              transformOrigin: `${x}px ${y}px`,
              animationDuration: speed > 0 ? `${0.6 / speed}s` : undefined,
              animationDirection: brightness < 0 ? 'reverse' : 'normal',
            }}
          >
            <ellipse className="motor-blade" cx={x} cy={y - 8} rx={4} ry={8} />
            <ellipse className="motor-blade" cx={x} cy={y + 8} rx={4} ry={8} />
            <circle className="motor-hub" cx={x} cy={y} r={3} />
          </g>
        </g>
      );
    }
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
