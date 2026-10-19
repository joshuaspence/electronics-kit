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

export type Part =
  Battery | Resistor | Bulb | Led | Wire | Switch | PushButton | Capacitor | Buzzer | Motor;
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
      case 'wire':
      case 'switch':
      case 'button':
        break;
    }
  }
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
