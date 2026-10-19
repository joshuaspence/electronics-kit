/**
 * The circuit a child has built, as the simulator sees it: parts whose pins sit on points.
 *
 * A point is anything a pin can be attached to: a breadboard strip, a snap terminal, a battery
 * clip. Pins on the same point are connected. The board layer decides which point each pin is on
 * (for a breadboard, `stripOf` of the hole it is in); the simulator only compares point ids.
 *
 * Every part has two pins. "Current through a part" always means conventional current flowing
 * through it from `pins[0]` to `pins[1]`.
 */

export type PointId = string;
export type Pins = readonly [PointId, PointId];

interface PartBase {
  readonly id: string;
  readonly pins: Pins;
}

/** pins[0] is the + terminal and pins[1] the − terminal. */
export interface Battery extends PartBase {
  readonly kind: 'battery';
  readonly volts: number;
  readonly internalOhms: number;
}

export interface Resistor extends PartBase {
  readonly kind: 'resistor';
  readonly ohms: number;
}

/** A bulb is a resistor that glows; at `ratedWatts` it is at full brightness. */
export interface Bulb extends PartBase {
  readonly kind: 'bulb';
  readonly ohms: number;
  readonly ratedWatts: number;
}

/**
 * A light-emitting diode: pins[0] is the anode (long leg) and pins[1] the cathode. It conducts only
 * from anode to cathode, once the voltage across it passes `forwardVolts`, through a small series
 * resistance. At `ratedAmps` it is at full brightness. A `blown` LED took too much current and
 * conducts no more.
 */
export interface Led extends PartBase {
  readonly kind: 'led';
  readonly forwardVolts: number;
  readonly ohms: number;
  readonly ratedAmps: number;
  readonly blown: boolean;
}

export interface Wire extends PartBase {
  readonly kind: 'wire';
}

/** A toggle switch: stays as it was left. */
export interface Switch extends PartBase {
  readonly kind: 'switch';
  readonly closed: boolean;
}

/** A momentary push button: conducts only while held down. */
export interface PushButton extends PartBase {
  readonly kind: 'button';
  readonly pressed: boolean;
}

/** Open in the DC operating point; charges and discharges in the transient run. */
export interface Capacitor extends PartBase {
  readonly kind: 'capacitor';
  readonly farads: number;
}

/** A buzzer: a resistor that sounds once the voltage across it, either way round, is `onVolts`. */
export interface Buzzer extends PartBase {
  readonly kind: 'buzzer';
  readonly ohms: number;
  readonly onVolts: number;
}

/**
 * A motor: a resistor that starts turning once `startAmps` flows through it, either way, and
 * turns at full speed at `ratedAmps`. Current from pins[1] to pins[0] turns it the other way.
 */
export interface Motor extends PartBase {
  readonly kind: 'motor';
  readonly ohms: number;
  readonly startAmps: number;
  readonly ratedAmps: number;
}

/**
 * A light sensor (a light-dependent resistor): `darkOhms` in the dark, falling to `brightOhms` in
 * full light. `light` is how much light falls on it, from 0 (dark) to 1 (full light), set by a
 * slider.
 */
export interface LightSensor extends PartBase {
  readonly kind: 'light-sensor';
  readonly brightOhms: number;
  readonly darkOhms: number;
  readonly light: number;
}

/**
 * A blinker chip: a timer that switches itself on and off, conducting for the first half of every
 * `periodSeconds` and open for the second half. Inside, a real one is a 555 timer and its timing
 * capacitor; here it is one block with two legs, like every other part. The DC operating point is
 * the instant t = 0, so it conducts there.
 */
export interface Blinker extends PartBase {
  readonly kind: 'blinker';
  readonly periodSeconds: number;
}

export type Part =
  | Battery
  | Resistor
  | Bulb
  | Led
  | Wire
  | Switch
  | PushButton
  | Capacitor
  | Buzzer
  | Motor
  | LightSensor
  | Blinker;
export type PartKind = Part['kind'];

export interface Circuit {
  readonly parts: readonly Part[];
}

/**
 * Resistance of a wire, closed switch or pressed button. Modelling them as tiny resistors rather
 * than merging their pins into one node keeps the current through every wire known, which the
 * flowing-dot display needs, and shares current correctly between parallel wires.
 */
export const CONDUCTOR_OHMS = 0.001;

/**
 * Every capacitor's resistance in series with it, as a real one has. It keeps an empty capacitor's
 * inrush below a short circuit: across the kit battery (0.5 Ω inside), 3 V through 1.5 Ω is 2 A,
 * under the 3 A at which the battery counts as shorted.
 */
export const CAPACITOR_SERIES_OHMS = 1;

/** Throws a RangeError describing the first problem that would make the circuit unsolvable. */
export function validateCircuit(circuit: Circuit): void {
  const ids = new Set<string>();
  for (const part of circuit.parts) {
    if (ids.has(part.id)) {
      throw new RangeError(`Duplicate part id ${part.id}`);
    }
    ids.add(part.id);
    switch (part.kind) {
      case 'battery':
        requireFinite(part, 'volts', part.volts);
        requirePositive(part, 'internalOhms', part.internalOhms);
        break;
      case 'resistor':
        requirePositive(part, 'ohms', part.ohms);
        break;
      case 'bulb':
        requirePositive(part, 'ohms', part.ohms);
        requirePositive(part, 'ratedWatts', part.ratedWatts);
        break;
      case 'led':
        requirePositive(part, 'forwardVolts', part.forwardVolts);
        requirePositive(part, 'ohms', part.ohms);
        requirePositive(part, 'ratedAmps', part.ratedAmps);
        break;
      case 'capacitor':
        requirePositive(part, 'farads', part.farads);
        break;
      case 'buzzer':
        requirePositive(part, 'ohms', part.ohms);
        requirePositive(part, 'onVolts', part.onVolts);
        break;
      case 'motor':
        requirePositive(part, 'ohms', part.ohms);
        requirePositive(part, 'startAmps', part.startAmps);
        if (!(part.ratedAmps > part.startAmps)) {
          throw new RangeError(`${part.id}: ratedAmps must be more than startAmps`);
        }
        break;
      case 'light-sensor':
        requirePositive(part, 'brightOhms', part.brightOhms);
        if (!(part.darkOhms > part.brightOhms) || !Number.isFinite(part.darkOhms)) {
          throw new RangeError(`${part.id}: darkOhms must be more than brightOhms`);
        }
        if (!(part.light >= 0 && part.light <= 1)) {
          throw new RangeError(`${part.id}: light must be from 0 to 1, not ${part.light}`);
        }
        break;
      case 'blinker':
        requirePositive(part, 'periodSeconds', part.periodSeconds);
        break;
      case 'wire':
      case 'switch':
      case 'button':
        break;
    }
  }
}

/**
 * A light sensor's resistance. It falls by the same factor for each step of light, as a real one
 * does over a wide range: halfway is the geometric mean of its dark and bright resistance.
 */
export function lightSensorOhms(part: LightSensor): number {
  return part.darkOhms * (part.brightOhms / part.darkOhms) ** part.light;
}

/** Whether a blinker chip is on, conducting, `seconds` into the transient run. */
export function blinkerOn(part: Blinker, seconds: number): boolean {
  return seconds % part.periodSeconds < part.periodSeconds / 2;
}

/** Whether a part currently lets current through at all. */
export function conducts(part: Part): boolean {
  switch (part.kind) {
    case 'switch':
      return part.closed;
    case 'button':
      return part.pressed;
    case 'led':
      return !part.blown;
    default:
      return true;
  }
}

function requireFinite(part: Part, field: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${part.id}: ${field} must be a finite number, not ${value}`);
  }
}

function requirePositive(part: Part, field: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${part.id}: ${field} must be positive, not ${value}`);
  }
}
