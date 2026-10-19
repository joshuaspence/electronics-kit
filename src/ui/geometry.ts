import {
  type BoardLayout,
  holeName,
  holesOf,
  RAILS,
  type Rail,
  stripOf,
  TERMINAL_ROWS,
  type TerminalRow,
} from '../core/breadboard';
import type { Board, Location } from '../core/build';
import type { PartKind } from '../core/circuit';

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Which way a part's second leg is from its first, as seen on screen. */
export type Orientation = 'right' | 'down' | 'left' | 'up';

/** One row or column in each direction: rows grow downwards and columns rightwards. */
export const STEPS: Readonly<Record<Orientation, { rows: number; columns: number }>> = {
  right: { rows: 0, columns: 1 },
  down: { rows: 1, columns: 0 },
  left: { rows: 0, columns: -1 },
  up: { rows: -1, columns: 0 },
};

const CLOCKWISE: readonly Orientation[] = ['right', 'down', 'left', 'up'];

/** A quarter turn clockwise. */
export function turned(orientation: Orientation): Orientation {
  return CLOCKWISE[(CLOCKWISE.indexOf(orientation) + 1) % CLOCKWISE.length]!;
}

/**
 * Where everything on a board is drawn, for either kind of board. Locations sit on a grid of rows
 * and columns, so moving and rotating parts works the same on both.
 */
export interface BoardGeometry {
  readonly width: number;
  readonly height: number;
  /** Distance between neighbouring locations, in board units. */
  readonly pitch: number;
  readonly columns: number;
  /** Radius a location is drawn with. */
  readonly radius: number;
  readonly locations: readonly Location[];
  position(location: Location): Point;
  /** The location nearest a point, if the point is close enough to snap to it. */
  nearest(point: Point): Location | null;
  /** The location `rows` down and `columns` across from another, if it is on the board. */
  offset(location: Location, rows: number, columns: number): Location | null;
  /** Rows and columns from `a` to `b`. */
  delta(a: Location, b: Location): { rows: number; columns: number };
  /** Locations joined to each other share a key; a stable name for each location for tests. */
  stripKey(location: Location): string;
  name(location: Location): string;
  /** Columns or rows between the legs of a part with fixed legs. */
  legSpan(kind: PartKind): number;
}

/** How close, as a fraction of the pitch, a pointer must be to a location to snap to it. */
const SNAP_FRACTION = 0.6;

/** Breadboard holes: small and close, so a 10-column board fits a tablet. */
const BREADBOARD = { pitch: 40, margin: 30, radius: 9 };

/** Room left of a board with rails, where its battery pack sits with leads into the rails. */
export const BATTERY_ROOM = 90;
const BREADBOARD_SPANS: Partial<Record<PartKind, number>> = {
  battery: 2,
  bulb: 2,
  led: 2,
  resistor: 3,
  switch: 2,
  button: 2,
  buzzer: 2,
  motor: 2,
  'light-sensor': 2,
  capacitor: 1,
};

/** Snap posts: big and far apart for small fingers; every part reaches the next post. */
const SNAP = { pitch: 110, margin: 60, radius: 16 };

export function geometryFor(board: Board): BoardGeometry {
  return board.kind === 'breadboard' ? breadboardGeometry(board) : snapGeometry(board);
}

interface Grid {
  readonly rows: number;
  readonly columns: number;
  readonly pitch: number;
  readonly margin: number;
  /** Extra room left of the first column, for a battery pack beside the board. */
  readonly extraLeft: number;
  toCell(location: Location): { row: number; column: number };
  /** The location in a cell, or nothing for a cell between rows of holes. */
  fromCell(row: number, column: number): Location | null;
}

function gridGeometry(
  grid: Grid,
  rest: Pick<BoardGeometry, 'radius' | 'locations' | 'stripKey' | 'name' | 'legSpan'>,
): BoardGeometry {
  const { pitch, margin } = grid;
  const left = margin + grid.extraLeft;
  const inGrid = (row: number, column: number) =>
    row >= 0 && row < grid.rows && column >= 1 && column <= grid.columns;
  const position = (location: Location): Point => {
    const { row, column } = grid.toCell(location);
    return { x: left + pitch * (column - 1), y: margin + pitch * row };
  };
  return {
    ...rest,
    pitch,
    columns: grid.columns,
    width: left + margin + pitch * (grid.columns - 1),
    height: margin * 2 + pitch * (grid.rows - 1),
    position,
    nearest(point) {
      const column = Math.round((point.x - left) / pitch) + 1;
      const row = Math.round((point.y - margin) / pitch);
      if (!inGrid(row, column)) {
        return null;
      }
      const location = grid.fromCell(row, column);
      if (!location) {
        return null;
      }
      const centre = position(location);
      return Math.hypot(centre.x - point.x, centre.y - point.y) <= pitch * SNAP_FRACTION
        ? location
        : null;
    },
    offset(location, rows, columns) {
      const { row, column } = grid.toCell(location);
      return inGrid(row + rows, column + columns)
        ? grid.fromCell(row + rows, column + columns)
        : null;
    },
    delta(a, b) {
      const from = grid.toCell(a);
      const to = grid.toCell(b);
      return { rows: to.row - from.row, columns: to.column - from.column };
    },
  };
}

/** What a row of a breadboard's grid holds: a row of terminals, a rail, or nothing (a gap). */
type BreadboardRow = TerminalRow | Rail | null;

/**
 * A breadboard's rows from top to bottom. A half-size board has a rail pair above, and with `both`
 * below too, each set apart by a blank row, and a blank row for the centre gap; a rail hole sits in
 * the same column as the terminals beside it.
 */
function breadboardRows(layout: BoardLayout): readonly BreadboardRow[] {
  const top = TERMINAL_ROWS.slice(0, 5);
  const bottom = TERMINAL_ROWS.slice(5);
  return [
    ...(layout.rails !== 'none' ? (['top+', 'top-', null] as const) : []),
    ...top,
    ...(layout.centreGap ? [null] : []),
    ...bottom,
    ...(layout.rails === 'both' ? ([null, 'bottom-', 'bottom+'] as const) : []),
  ];
}

function breadboardGeometry(board: Board & { kind: 'breadboard' }): BoardGeometry {
  const { layout } = board;
  const rows = breadboardRows(layout);
  return gridGeometry(
    {
      rows: rows.length,
      columns: layout.columns,
      pitch: BREADBOARD.pitch,
      margin: BREADBOARD.margin,
      extraLeft: layout.rails === 'none' ? 0 : BATTERY_ROOM,
      toCell: (location) => {
        if (location.kind === 'snap') {
          throw new RangeError('A snap post is not on a breadboard');
        }
        return location.kind === 'terminal'
          ? { row: rows.indexOf(location.row), column: location.column }
          : { row: rows.indexOf(location.rail), column: location.position };
      },
      fromCell: (row, column) => {
        const name = rows[row];
        if (!name) {
          return null;
        }
        return (RAILS as readonly string[]).includes(name)
          ? { kind: 'rail', rail: name as Rail, position: column }
          : { kind: 'terminal', row: name as TerminalRow, column };
      },
    },
    {
      radius: BREADBOARD.radius,
      locations: holesOf(layout),
      stripKey: (location) => (location.kind === 'snap' ? '' : stripOf(layout, location)),
      name: (location) => (location.kind === 'snap' ? '' : holeName(location)),
      legSpan: (kind) => BREADBOARD_SPANS[kind] ?? 1,
    },
  );
}

function snapGeometry(board: Board & { kind: 'snap' }): BoardGeometry {
  const locations: Location[] = [];
  for (let row = 1; row <= board.rows; row++) {
    for (let column = 1; column <= board.columns; column++) {
      locations.push({ kind: 'snap', row, column });
    }
  }
  const name = (location: Location) =>
    location.kind === 'snap' ? `p${location.row}-${location.column}` : '';
  return gridGeometry(
    {
      rows: board.rows,
      columns: board.columns,
      pitch: SNAP.pitch,
      margin: SNAP.margin,
      extraLeft: 0,
      toCell: (location) => {
        if (location.kind !== 'snap') {
          throw new RangeError('Only posts are drawn on a snap board');
        }
        return { row: location.row - 1, column: location.column };
      },
      fromCell: (row, column) => ({ kind: 'snap', row: row + 1, column }),
    },
    { radius: SNAP.radius, locations, stripKey: name, name, legSpan: () => 1 },
  );
}

/** Where the second leg goes for a part whose first leg is in `first`. */
export function secondLeg(
  geometry: BoardGeometry,
  first: Location,
  kind: PartKind,
  orientation: Orientation,
): Location | null {
  const span = geometry.legSpan(kind);
  const step = STEPS[orientation];
  return geometry.offset(first, step.rows * span, step.columns * span);
}

/**
 * A placed part's legs turned a quarter clockwise about its middle, so two turns swap its legs and
 * four bring it back. With an odd span the middle falls between locations, so each turn's shift is
 * rounded towards zero, which the four turns' shifts cancel out.
 */
export function quarterTurn(
  geometry: BoardGeometry,
  [first, second]: readonly [Location, Location],
): readonly [Location, Location] | null {
  const { rows, columns } = geometry.delta(first, second);
  const next = { rows: columns, columns: -rows };
  const start = geometry.offset(
    first,
    Math.trunc((rows - next.rows) / 2),
    Math.trunc((columns - next.columns) / 2),
  );
  const end = start && geometry.offset(start, next.rows, next.columns);
  return start && end ? [start, end] : null;
}
