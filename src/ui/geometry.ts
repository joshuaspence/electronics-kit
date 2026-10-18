import { type BoardLayout, type Hole, TERMINAL_ROWS, type TerminalRow } from '../core/breadboard';
import type { PartKind } from '../core/circuit';

export const PITCH = 40;
export const MARGIN = 30;
export const HOLE_RADIUS = 9;

/** How close (in board units) a pointer must be to a hole for a leg to snap into it. */
const SNAP_DISTANCE = PITCH * 0.6;

export type Terminal = Hole & { kind: 'terminal' };

export interface Point {
  readonly x: number;
  readonly y: number;
}

export function boardSize(layout: BoardLayout): { width: number; height: number } {
  return {
    width: MARGIN * 2 + PITCH * (layout.columns - 1),
    height: MARGIN * 2 + PITCH * (TERMINAL_ROWS.length - 1),
  };
}

export function holePosition(hole: Terminal): Point {
  return {
    x: MARGIN + PITCH * (hole.column - 1),
    y: MARGIN + PITCH * TERMINAL_ROWS.indexOf(hole.row),
  };
}

/** The hole nearest a point, if the point is close enough to snap to it. */
export function nearestHole(layout: BoardLayout, point: Point): Terminal | null {
  const column = Math.round((point.x - MARGIN) / PITCH) + 1;
  const rowIndex = Math.round((point.y - MARGIN) / PITCH);
  const row = TERMINAL_ROWS[rowIndex];
  if (row === undefined || column < 1 || column > layout.columns) {
    return null;
  }
  const hole: Terminal = { kind: 'terminal', column, row };
  const centre = holePosition(hole);
  return Math.hypot(centre.x - point.x, centre.y - point.y) <= SNAP_DISTANCE ? hole : null;
}

/** Columns between the two legs of a part with fixed legs; wires are drawn freely instead. */
export const LEG_SPAN: Partial<Record<PartKind, number>> = {
  battery: 2,
  bulb: 2,
  resistor: 3,
  switch: 2,
  button: 2,
  capacitor: 1,
};

export type Orientation = 'across' | 'down';

/** Where the second leg goes for a part whose first leg is in `first`. */
export function secondLeg(
  first: Terminal,
  span: number,
  orientation: Orientation,
): Terminal | null {
  if (orientation === 'across') {
    return { ...first, column: first.column + span };
  }
  const row = TERMINAL_ROWS[TERMINAL_ROWS.indexOf(first.row) + span] as TerminalRow | undefined;
  return row === undefined ? null : { ...first, row };
}

/** The orientation of a placed part, from where its legs are. */
export function orientationOf(first: Terminal, second: Terminal): Orientation {
  return first.row === second.row ? 'across' : 'down';
}
