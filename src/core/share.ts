import { type BoardLayout, holeName, parseHole } from './breadboard';
import type { Build, PartSpec, PlacedPart } from './build';
import { newSpec } from './catalogue';
import type { PartKind } from './circuit';

/**
 * Share links (docs/design.md §2): a sandbox circuit in the URL fragment, `#c=<code>`, which never
 * reaches a server. The code is short text rather than compressed bytes: `1` for this version,
 * then a token per part the child placed, `<kind>.<hole>.<hole>[.<value>]`, joined by `_`. A 100 Ω
 * resistor from b3 to b6 is `r.b3.b6.100`; a closed switch `s.e3.e5.1`. The level's own fixed
 * parts, such as the battery, aren't in it: the sandbox places them.
 */

const VERSION = '1';

const LETTERS: Readonly<Record<Exclude<PartKind, 'battery'>, string>> = {
  bulb: 'b',
  led: 'l',
  resistor: 'r',
  capacitor: 'c',
  switch: 's',
  button: 'p',
  wire: 'w',
};

const KINDS = new Map(Object.entries(LETTERS).map(([kind, letter]) => [letter, kind as PartKind]));

/** The share code for the parts of `build` the child placed, on a breadboard. */
export function encodeCircuit(build: Build): string {
  const tokens = build.parts
    .filter((part) => !part.fixed && part.spec.kind !== 'battery')
    .map((part) => {
      const spec = part.spec as Exclude<PartSpec, { kind: 'battery' }>;
      const legs = part.at.map((at) => (at.kind === 'snap' ? '' : holeName(at)));
      const value = valueOf(spec);
      return [LETTERS[spec.kind], ...legs, ...(value === null ? [] : [value])].join('.');
    });
  return [VERSION, ...tokens].join('_');
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
  const parts: PlacedPart[] = [];
  for (const [i, token] of tokens.entries()) {
    const [letter, from, to, value, ...extra] = token.split('.');
    const kind = KINDS.get(letter ?? '');
    const a = parseHole(layout, from ?? '');
    const b = parseHole(layout, to ?? '');
    const spec = kind && specFor(kind, value);
    if (!spec || !a || !b || extra.length > 0) {
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
  return { parts: [...initial.parts, ...parts] };
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
      return Number.isFinite(number) && number > 0 ? { ...spec, ohms: number } : null;
    case 'capacitor':
      return Number.isFinite(number) && number > 0 ? { ...spec, farads: number } : null;
    case 'switch':
      return value === '0' || value === '1' ? { ...spec, closed: value === '1' } : null;
    default:
      return value === undefined ? spec : null;
  }
}
