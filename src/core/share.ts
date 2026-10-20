import { type BoardLayout, holeName, parseHole } from './breadboard';
import type { Build, PartSpec, PlacedPart } from './build';
import { BATTERY_VOLTS, newSpec, SUPPLY_VOLTS } from './catalogue';
import type { PartKind } from './circuit';
import { colourBands } from './colourCode';

/**
 * Share links (docs/design.md §2): a sandbox circuit in the URL fragment, `#c=<code>`, which never
 * reaches a server. The code is short text rather than compressed bytes: `1` for this version,
 * then a token per part the child placed, `<kind>.<hole>.<hole>[.<value>]`, joined by `_`. A 100 Ω
 * resistor from b3 to b6 is `r.b3.b6.100`; a closed switch `s.e3.e5.1`. The value comes last and
 * a hole name has no `.`, so the value keeps any decimal point of its own: `c.a1.a3.0.001`. The
 * level's own fixed parts, such as the battery, aren't in it: the sandbox places them. A power
 * supply turned away from the battery's 3 V adds `v.<volts>`, such as `v.4.5`, so a link from
 * before the supply could be turned still opens at 3 V.
 */

const VERSION = '1';

const LETTERS: Readonly<Record<Exclude<PartKind, 'battery'>, string>> = {
  bulb: 'b',
  led: 'l',
  resistor: 'r',
  capacitor: 'c',
  switch: 's',
  button: 'p',
  buzzer: 'z',
  motor: 'm',
  'light-sensor': 'y',
  blinker: 'k',
  wire: 'w',
};

const KINDS = new Map(Object.entries(LETTERS).map(([kind, letter]) => [letter, kind as PartKind]));

/** The letter of a power supply's voltage token, which has no holes. */
const VOLTS = 'v';

/** The share code for the parts of `build` the child placed, on a breadboard, and its supply. */
export function encodeCircuit(build: Build): string {
  const supply = build.parts.find((part) => part.fixed && part.spec.kind === 'battery')?.spec;
  const volts =
    supply?.kind === 'battery' && supply.volts !== BATTERY_VOLTS
      ? [`${VOLTS}.${supply.volts}`]
      : [];
  const tokens = build.parts
    .filter((part) => !part.fixed && part.spec.kind !== 'battery')
    .map((part) => {
      const spec = part.spec as Exclude<PartSpec, { kind: 'battery' }>;
      const legs = part.at.map((at) => (at.kind === 'snap' ? '' : holeName(at)));
      const value = valueOf(spec);
      return [LETTERS[spec.kind], ...legs, ...(value === null ? [] : [value])].join('.');
    });
  return [VERSION, ...volts, ...tokens].join('_');
}

/**
 * The build a share code describes: the board's own starting parts plus the shared ones. Nothing
 * if the code is from another version, names a hole that isn't on the board, puts two legs in one
 * hole or is otherwise malformed, so a child never gets half a circuit.
 */
export function decodeCircuit(layout: BoardLayout, initial: Build, code: string): Build | null {
  const [version, ...tokens] = code.split('_');
  if (version !== VERSION) {
    return null;
  }
  const taken = new Set(initial.parts.flatMap((part) => part.at.map(holeKey)));
  let board = initial.parts;
  if (tokens[0]?.startsWith(`${VOLTS}.`)) {
    const volts = supplyVolts(tokens.shift()!.slice(VOLTS.length + 1));
    if (volts === null || !board.some((part) => part.fixed && part.spec.kind === 'battery')) {
      return null;
    }
    board = board.map((part) =>
      part.fixed && part.spec.kind === 'battery'
        ? { ...part, spec: { ...part.spec, volts } }
        : part,
    );
  }
  const parts: PlacedPart[] = [];
  for (const [i, token] of tokens.entries()) {
    const [letter, from, to, ...value] = token.split('.');
    const kind = KINDS.get(letter ?? '');
    const a = parseHole(layout, from ?? '');
    const b = parseHole(layout, to ?? '');
    const spec = kind && specFor(kind, value.length > 0 ? value.join('.') : undefined);
    if (!spec || !a || !b) {
      return null;
    }
    for (const hole of [a, b]) {
      const key = holeName(hole);
      if (taken.has(key)) {
        return null;
      }
      taken.add(key);
    }
    parts.push({ id: `shared-${i}`, spec, at: [a, b], fixed: false });
  }
  return { parts: [...board, ...parts] };
}

/** A supply voltage from its token, or nothing if the supply can't be turned to it. */
function supplyVolts(value: string): number | null {
  const volts = Number(value);
  const { min, max, step } = SUPPLY_VOLTS;
  // Number('') is 0, so an empty value has to be refused before it reads as off.
  return value !== '' && volts >= min && volts <= max && Number.isInteger(volts / step)
    ? volts
    : null;
}

function holeKey(location: PlacedPart['at'][number]): string {
  return location.kind === 'snap' ? `snap:${location.row}:${location.column}` : holeName(location);
}

/** The value a part's token carries, if its kind has one worth sharing. */
function valueOf(spec: Exclude<PartSpec, { kind: 'battery' }>): string | null {
  switch (spec.kind) {
    case 'resistor':
      return String(spec.ohms);
    case 'capacitor':
      return String(spec.farads);
    case 'switch':
      return spec.closed ? '1' : '0';
    case 'light-sensor':
      return String(spec.light);
    default:
      return null;
  }
}

/** A part's spec from its kind and token value, or nothing if the value doesn't fit the kind. */
function specFor(kind: PartKind, value: string | undefined): PartSpec | null {
  const spec = newSpec(kind);
  const number = Number(value);
  switch (spec.kind) {
    case 'resistor':
      // The board draws a resistor's colour code, so a resistance it can't show would crash it.
      try {
        colourBands(number);
      } catch {
        return null;
      }
      return { ...spec, ohms: number };
    case 'capacitor':
      return Number.isFinite(number) && number > 0 ? { ...spec, farads: number } : null;
    case 'switch':
      return value === '0' || value === '1' ? { ...spec, closed: value === '1' } : null;
    case 'light-sensor':
      // Number('') is 0, so an empty value has to be refused before it reads as dark.
      return value && number >= 0 && number <= 1 ? { ...spec, light: number } : null;
    default:
      return value === undefined ? spec : null;
  }
}
