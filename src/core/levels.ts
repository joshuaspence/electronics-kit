import type { Board, PlacedPart } from './build';
import { type Circuit, type Part, type PartKind } from './circuit';
import {
  bulbBrightness,
  buzzerSounds,
  isShorted,
  ledBrightness,
  ledPops,
  motorSpeed,
  solveDc,
} from './dc';

/**
 * A light (a bulb or an LED) counts as lit at a quarter of full brightness or more. Goals count
 * buzzers and motors as lights too: a sounding buzzer is lit and bright, and a turning motor is lit
 * at a quarter of full speed or more, so `lights` is how many outputs are working.
 */
export const LIT_BRIGHTNESS = 0.25;

/**
 * A light counts as bright at nearly full brightness. Two kit bulbs side by side across the
 * battery are bright; two in a row share its push and glow at under half.
 */
const BRIGHT_BRIGHTNESS = 0.9;

/**
 * Below lit, a light still visibly glows down to this brightness. Three kit bulbs in a row glow at
 * about 0.19; a light in a broken loop carries only the solver's leakage, far below this.
 */
const GLOW_BRIGHTNESS = 0.05;

/**
 * What a level asks for. Goals are checked against the simulated circuit, never a fixed layout,
 * so any correct circuit wins (docs/design.md §3). No goal is met while a battery is shorted.
 */
export type Goal =
  /**
   * At least `lights` lights are lit with every switch closed and every button pressed; with
   * `bright`, lit at nearly full brightness.
   */
  | { readonly kind: 'light-up'; readonly lights: number; readonly bright?: boolean }
  /**
   * At least `lights` lights are lit with every switch closed and every button pressed, and none
   * is lit with every switch open and every button released. The circuit needs a switch or button.
   */
  | { readonly kind: 'control-lights'; readonly lights: number }
  /**
   * As `control-lights`, and also none is lit with any one switch open or button released and the
   * rest on: the lights need every control at once.
   */
  | { readonly kind: 'every-control'; readonly lights: number };

export interface PartAllowance {
  readonly kind: PartKind;
  readonly count: number;
}

export interface Level {
  readonly id: string;
  readonly chapter: number;
  readonly board: Board;
  /**
   * Parts on the board when the level starts: fixed ones (usually the battery) can't be moved, and
   * others count against the tray as if the child had placed them.
   */
  readonly parts: readonly PlacedPart[];
  readonly goal: Goal;
  /** The parts the child may place, on top of any the level places for them. */
  readonly tray: readonly PartAllowance[];
  /** The fewest parts the child needs to place; placing no more earns a star. */
  readonly par: number;
  /**
   * One way to finish at par: the parts the child places, on top of the starting ones they keep.
   * Tests check that every level can be finished this way; hints can show its parts.
   */
  readonly solution: Solution;
}

export interface Solution {
  /** Ids of starting parts the child removes. */
  readonly remove?: readonly string[];
  readonly place: readonly PlacedPart[];
}

export type GoalResult =
  { readonly met: true } | { readonly met: false; readonly reason: GoalFailure };

/** Why a goal is not met, so hints can say something useful. */
export type GoalFailure =
  | 'short-circuit'
  | 'too-few-lit'
  | 'too-dim'
  | 'led-blown'
  | 'led-overdriven'
  | 'led-backwards'
  | 'not-controlled'
  | 'no-control'
  | 'not-every-control';

export function checkGoal(goal: Goal, circuit: Circuit): GoalResult {
  const on = withControls(circuit, true);
  const onResult = litLights(on);
  if (onResult.shorted) {
    return { met: false, reason: 'short-circuit' };
  }
  if (onResult.lit < goal.lights) {
    return { met: false, reason: whyDark(onResult) };
  }

  switch (goal.kind) {
    case 'light-up':
      return goal.bright && onResult.bright < goal.lights
        ? { met: false, reason: 'too-dim' }
        : { met: true };
    case 'control-lights':
    case 'every-control': {
      const controls = circuit.parts.filter(isControl);
      if (controls.length === 0) {
        return { met: false, reason: 'no-control' };
      }
      const offs: [Circuit, GoalFailure][] = [[withControls(circuit, false), 'not-controlled']];
      if (goal.kind === 'every-control') {
        for (const control of controls) {
          offs.push([withControls(circuit, true, control.id), 'not-every-control']);
        }
      }
      for (const [off, failure] of offs) {
        const offResult = litLights(off);
        if (offResult.shorted) {
          return { met: false, reason: 'short-circuit' };
        }
        if (offResult.lit > 0) {
          return { met: false, reason: failure };
        }
      }
      return { met: true };
    }
  }
}

function isControl(part: Part): boolean {
  return part.kind === 'switch' || part.kind === 'button';
}

/**
 * How many lights are lit with every switch and button as the child left them. A level finishes
 * only when its goal is met and this many lights are glowing, so the child sees the light come on.
 */
export function litNow(circuit: Circuit): number {
  const { lit, shorted } = litLights(circuit);
  return shorted ? 0 : lit;
}

/**
 * The multimeter unlocks once any level of this chapter is finished: chapter 3 is where brightness
 * becomes a question numbers can answer (docs/design.md §4).
 */
export const METER_CHAPTER = 3;

/** Whether the multimeter is unlocked, given the stars earned so far. */
export function meterUnlocked(
  levels: readonly Level[],
  stars: Readonly<Record<string, number>>,
): boolean {
  return levels.some((level) => level.chapter >= METER_CHAPTER && (stars[level.id] ?? 0) > 0);
}

/** How many of each part, and of wires, the sandbox offers: plenty, but a bin, not a warehouse. */
const SANDBOX_PARTS = 8;
const SANDBOX_WIRES = 40;

/**
 * The sandbox's tray: every kind of part a finished level offered, so it grows with the child
 * (docs/design.md §3). Bulbs and wires, chapter 1's parts, are always there to start with.
 */
export function sandboxTray(
  levels: readonly Level[],
  stars: Readonly<Record<string, number>>,
): readonly PartAllowance[] {
  const unlocked = new Set<PartKind>(['bulb', 'wire']);
  for (const level of levels) {
    if ((stars[level.id] ?? 0) > 0) {
      level.tray.forEach(({ kind }) => unlocked.add(kind));
    }
  }
  const order: readonly PartKind[] = [
    'bulb',
    'led',
    'resistor',
    'switch',
    'button',
    'buzzer',
    'motor',
    'capacitor',
  ];
  return [
    ...order.filter((kind) => unlocked.has(kind)).map((kind) => ({ kind, count: SANDBOX_PARTS })),
    { kind: 'wire', count: SANDBOX_WIRES },
  ];
}

/**
 * Stars for a finished level, 1 to 3: one for finishing, one for placing no more than par parts
 * and one for using no hints. Speed never counts.
 */
export function starsFor(level: Level, partsPlaced: number, hintsUsed: number): 1 | 2 | 3 {
  const stars = 1 + (partsPlaced <= level.par ? 1 : 0) + (hintsUsed === 0 ? 1 : 0);
  return stars as 1 | 2 | 3;
}

/**
 * Every switch closed and button pressed (`on`), or every switch open and button released, except
 * the control with id `except`, which is set the other way.
 */
function withControls(circuit: Circuit, on: boolean, except?: string): Circuit {
  return {
    parts: circuit.parts.map((part): Part => {
      const state = part.id === except ? !on : on;
      switch (part.kind) {
        case 'switch':
          return { ...part, closed: state };
        case 'button':
          return { ...part, pressed: state };
        default:
          return part;
      }
    }),
  };
}

interface Lights {
  readonly lit: number;
  /** Lit at nearly full brightness: how many a `bright` goal counts. */
  readonly bright: number;
  /** Glowing faintly, too dim to count as lit, so current is flowing through them. */
  readonly glowing: number;
  readonly shorted: boolean;
  /** An LED has popped, so it stays dark however it is wired. */
  readonly blown: boolean;
  /**
   * An LED has, or turned round would have, more current than it can take: it would pop. It counts
   * as dark, since the child would see it pop rather than glow.
   */
  readonly overdriven: boolean;
  /** A dark LED has more than its forward voltage across it the wrong way: turned round, it lights. */
  readonly backwards: boolean;
}

function litLights(circuit: Circuit): Lights {
  const solution = solveDc(circuit);
  let lit = 0;
  let bright = 0;
  let shorted = false;
  let blown = false;
  let overdriven = false;
  let backwards = false;
  let glowing = 0;
  const count = (brightness: number) => {
    lit += brightness >= LIT_BRIGHTNESS ? 1 : 0;
    bright += brightness >= BRIGHT_BRIGHTNESS ? 1 : 0;
    glowing += brightness >= GLOW_BRIGHTNESS && brightness < LIT_BRIGHTNESS ? 1 : 0;
  };
  for (const part of circuit.parts) {
    const reading = solution.parts.get(part.id)!;
    switch (part.kind) {
      case 'bulb':
        count(bulbBrightness(part, reading));
        break;
      case 'led': {
        const pops = !part.blown && ledPops(reading);
        count(pops ? 0 : ledBrightness(part, reading));
        blown ||= part.blown;
        overdriven ||= pops;
        if (!part.blown && reading.voltage < -part.forwardVolts) {
          // Turning it round is only good advice if it wouldn't then pop.
          if (popsTurnedRound(circuit, part.id)) {
            overdriven = true;
          } else {
            backwards = true;
          }
        }
        break;
      }
      case 'buzzer':
        // Sounding or silent: there is no quiet buzz to count as too dim.
        count(buzzerSounds(part, reading) ? 1 : 0);
        break;
      case 'motor':
        count(Math.abs(motorSpeed(part, reading)));
        break;
      case 'battery':
        shorted ||= isShorted(part, reading);
        break;
      default:
        break;
    }
  }
  return { lit, bright, glowing, shorted, blown, overdriven, backwards };
}

/**
 * Why too few lights are lit, most specific first: an LED's own state or wiring is the reason
 * before the loop as a whole is.
 */
function whyDark(lights: Lights): GoalFailure {
  if (lights.blown) {
    return 'led-blown';
  }
  if (lights.overdriven) {
    return 'led-overdriven';
  }
  if (lights.backwards) {
    return 'led-backwards';
  }
  // A faint glow means the loop is complete but shared too thinly, not that it is broken.
  return lights.glowing > 0 ? 'too-dim' : 'too-few-lit';
}

/** Whether the LED `id` would pop with its legs the other way round. */
function popsTurnedRound(circuit: Circuit, id: string): boolean {
  const turned = {
    parts: circuit.parts.map((part): Part =>
      part.id === id ? { ...part, pins: [part.pins[1], part.pins[0]] } : part,
    ),
  };
  return ledPops(solveDc(turned).parts.get(id)!);
}
