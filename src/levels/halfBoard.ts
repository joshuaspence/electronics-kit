import type { Board, Location, PartSpec, PlacedPart } from '../core/build';
import type { Rail, TerminalRow } from '../core/breadboard';
import { newSpec } from '../core/catalogue';

// The board chapters 3 to 6 share: 15 columns of a half-size board with only its top rails, which
// keeps it short enough for tablet-sized holes (docs/design.md §5).

export const halfBoard: Board = {
  kind: 'breadboard',
  layout: { columns: 15, centreGap: true, rails: 'top' },
};

export const hole = (row: TerminalRow, column: number): Location => ({
  kind: 'terminal',
  row,
  column,
});

export const rail = (name: Rail, position: number): Location => ({
  kind: 'rail',
  rail: name,
  position,
});

export function part(
  id: string,
  kind: PartSpec['kind'],
  from: Location,
  to: Location,
  fixed = false,
): PlacedPart {
  return { id, spec: newSpec(kind), at: [from, to], fixed };
}

/** Plugged into the top rails, so the + rail and − rail run the length of the board. */
export const battery = part('battery', 'battery', rail('top+', 1), rail('top-', 1), true);
