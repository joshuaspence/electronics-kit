/**
 * Breadboard geometry: which holes are joined by the metal clips under the plastic.
 *
 * A board has `columns` columns numbered from 1. Each column has ten terminal holes in rows
 * a–j. Rows a–e of a column form one strip and rows f–j another, split by the centre gap. A
 * mini board (chapter 2) has no centre gap, so all ten holes of a column form one strip. Boards
 * with rails add a + and a − rail along the top, and with `both` along the bottom too, each running
 * the full length of the board.
 */

export const TERMINAL_ROWS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'] as const;
export type TerminalRow = (typeof TERMINAL_ROWS)[number];

export const RAILS = ['top+', 'top-', 'bottom+', 'bottom-'] as const;
export type Rail = (typeof RAILS)[number];

export interface BoardLayout {
  readonly columns: number;
  readonly centreGap: boolean;
  /**
   * Which power rails the board has. A level's board has only the top pair, which leaves its holes
   * bigger on a tablet (docs/design.md §5).
   */
  readonly rails: 'none' | 'top' | 'both';
}

/** The rails a board has, top first. */
export function railsOf(layout: BoardLayout): readonly Rail[] {
  return layout.rails === 'both' ? RAILS : layout.rails === 'top' ? RAILS.slice(0, 2) : [];
}

export type Hole =
  | { readonly kind: 'terminal'; readonly column: number; readonly row: TerminalRow }
  | { readonly kind: 'rail'; readonly rail: Rail; readonly position: number };

/** A stable identifier for one connected strip of holes. */
export type StripId = string;

export function isValidHole(layout: BoardLayout, hole: Hole): boolean {
  if (hole.kind === 'rail') {
    return railsOf(layout).includes(hole.rail) && isWithin(hole.position, layout.columns);
  }
  return isWithin(hole.column, layout.columns);
}

/** The strip a hole belongs to. Two holes are connected exactly when their strips are equal. */
export function stripOf(layout: BoardLayout, hole: Hole): StripId {
  if (!isValidHole(layout, hole)) {
    throw new RangeError(`Hole ${holeName(hole)} is not on this board`);
  }
  if (hole.kind === 'rail') {
    return `rail:${hole.rail}`;
  }
  if (!layout.centreGap) {
    return `col:${hole.column}`;
  }
  const half = TERMINAL_ROWS.indexOf(hole.row) < 5 ? 'a-e' : 'f-j';
  return `col:${hole.column}:${half}`;
}

/** Every hole on the board, terminals column by column and then the rails. */
export function holesOf(layout: BoardLayout): Hole[] {
  const holes: Hole[] = [];
  for (let column = 1; column <= layout.columns; column++) {
    for (const row of TERMINAL_ROWS) {
      holes.push({ kind: 'terminal', column, row });
    }
  }
  for (const rail of railsOf(layout)) {
    for (let position = 1; position <= layout.columns; position++) {
      holes.push({ kind: 'rail', rail, position });
    }
  }
  return holes;
}

/** The holes connected to `hole`, including itself, in board order. */
export function holesInStrip(layout: BoardLayout, hole: Hole): Hole[] {
  const strip = stripOf(layout, hole);
  return holesOf(layout).filter((other) => stripOf(layout, other) === strip);
}

export function holeName(hole: Hole): string {
  return hole.kind === 'terminal' ? `${hole.row}${hole.column}` : `${hole.rail}${hole.position}`;
}

function isWithin(index: number, count: number): boolean {
  return Number.isInteger(index) && index >= 1 && index <= count;
}
