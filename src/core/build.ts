import { type BoardLayout, type Hole, holeName, isValidHole, stripOf } from './breadboard';
import type { Circuit, Part, PartKind, PointId } from './circuit';
import type { PartAllowance } from './levels';

/**
 * What the child has built: parts placed at locations on a board, with undo and redo.
 *
 * A board is either a breadboard, whose holes are joined in strips, or a snap board (chapter 1),
 * whose posts each stand alone. `toCircuit` turns a build into the circuit the simulator
 * solves, so pins in the same strip end up on the same point.
 */

export type Board =
  | { readonly kind: 'breadboard'; readonly layout: BoardLayout }
  | { readonly kind: 'snap'; readonly rows: number; readonly columns: number };

/** A post on a snap board, numbered from 1 like breadboard columns. */
export interface SnapPost {
  readonly kind: 'snap';
  readonly row: number;
  readonly column: number;
}

export type Location = Hole | SnapPost;

/** A part as the tray offers it: everything but its id and where its pins are. */
export type PartSpec = WithoutPlacement<Part>;
type WithoutPlacement<P> = P extends Part ? Omit<P, 'id' | 'pins'> : never;

export interface PlacedPart {
  readonly id: string;
  readonly spec: PartSpec;
  readonly at: readonly [Location, Location];
  /** Placed by the level; the child can't move or remove it. */
  readonly fixed: boolean;
}

export interface Build {
  readonly parts: readonly PlacedPart[];
}

/** An edit. Each one is a single step of undo. */
export type Edit =
  | { readonly kind: 'place'; readonly part: PlacedPart }
  | { readonly kind: 'move'; readonly id: string; readonly at: readonly [Location, Location] }
  | { readonly kind: 'remove'; readonly id: string };

/** Why an edit was refused. The UI turns this into a gentle message, never an error. */
export type EditRefusal =
  | 'off-board'
  | 'same-hole'
  | 'hole-taken'
  | 'none-left'
  | 'fixed-part'
  | 'unknown-part'
  | 'duplicate-id';

export type EditResult =
  { readonly ok: true } | { readonly ok: false; readonly reason: EditRefusal };

export function pointOf(board: Board, location: Location): PointId {
  if (location.kind === 'snap') {
    return locationKey(location);
  }
  if (board.kind !== 'breadboard') {
    throw new RangeError(`Hole ${holeName(location)} is not on a snap board`);
  }
  return stripOf(board.layout, location);
}

export function toCircuit(board: Board, build: Build): Circuit {
  return {
    parts: build.parts.map(
      (placed) =>
        ({
          ...placed.spec,
          id: placed.id,
          pins: [pointOf(board, placed.at[0]), pointOf(board, placed.at[1])],
        }) as Part,
    ),
  };
}

/**
 * A build being edited, with undo and redo. Edits are checked against the board, the holes already
 * taken and the level's tray; inputs (`setControl`) change a switch or button without becoming an
 * undo step, since flipping a switch is playing with the circuit, not building it.
 */
export class BuildEditor {
  private past: Build[] = [];
  private future: Build[] = [];
  private current: Build;

  constructor(
    readonly board: Board,
    readonly tray: readonly PartAllowance[],
    initial: Build,
  ) {
    this.current = initial;
  }

  get build(): Build {
    return this.current;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  /** How many more parts of `kind` the child may place. */
  remaining(kind: PartKind): number {
    const allowed = this.tray.find((allowance) => allowance.kind === kind)?.count ?? 0;
    const used = this.current.parts.filter((p) => !p.fixed && p.spec.kind === kind).length;
    return Math.max(0, allowed - used);
  }

  apply(edit: Edit): EditResult {
    const next = this.edited(edit);
    if (!('parts' in next)) {
      return next;
    }
    this.past.push(this.current);
    this.future = [];
    this.current = next;
    return { ok: true };
  }

  undo(): boolean {
    const previous = this.past.pop();
    if (!previous) {
      return false;
    }
    this.future.push(this.current);
    this.current = previous;
    return true;
  }

  redo(): boolean {
    const next = this.future.pop();
    if (!next) {
      return false;
    }
    this.past.push(this.current);
    this.current = next;
    return true;
  }

  /** Flips a switch or presses or releases a button. Not an edit, so not an undo step. */
  setControl(id: string, on: boolean): EditResult {
    const part = this.current.parts.find((p) => p.id === id);
    if (!part || (part.spec.kind !== 'switch' && part.spec.kind !== 'button')) {
      return { ok: false, reason: 'unknown-part' };
    }
    const spec: PartSpec =
      part.spec.kind === 'switch' ? { ...part.spec, closed: on } : { ...part.spec, pressed: on };
    const update = (build: Build): Build => ({
      parts: build.parts.map((p) => (p.id === id ? { ...p, spec } : p)),
    });
    this.current = update(this.current);
    // Keep the control where the child left it when they undo or redo around it.
    this.past = this.past.map((build) =>
      build.parts.some((p) => p.id === id) ? update(build) : build,
    );
    this.future = this.future.map((build) =>
      build.parts.some((p) => p.id === id) ? update(build) : build,
    );
    return { ok: true };
  }

  private edited(edit: Edit): Build | { ok: false; reason: EditRefusal } {
    const parts = this.current.parts;
    switch (edit.kind) {
      case 'place': {
        if (parts.some((p) => p.id === edit.part.id)) {
          return { ok: false, reason: 'duplicate-id' };
        }
        if (!edit.part.fixed && this.remaining(edit.part.spec.kind) === 0) {
          return { ok: false, reason: 'none-left' };
        }
        const refusal = this.placementRefusal(edit.part.at, parts);
        return refusal ? { ok: false, reason: refusal } : { parts: [...parts, edit.part] };
      }
      case 'move': {
        const part = parts.find((p) => p.id === edit.id);
        if (!part) {
          return { ok: false, reason: 'unknown-part' };
        }
        if (part.fixed) {
          return { ok: false, reason: 'fixed-part' };
        }
        const others = parts.filter((p) => p.id !== edit.id);
        const refusal = this.placementRefusal(edit.at, others);
        return refusal
          ? { ok: false, reason: refusal }
          : { parts: parts.map((p) => (p.id === edit.id ? { ...p, at: edit.at } : p)) };
      }
      case 'remove': {
        const part = parts.find((p) => p.id === edit.id);
        if (!part) {
          return { ok: false, reason: 'unknown-part' };
        }
        if (part.fixed) {
          return { ok: false, reason: 'fixed-part' };
        }
        return { parts: parts.filter((p) => p.id !== edit.id) };
      }
    }
  }

  /** Only physically impossible placements are refused (docs/design.md §5). */
  private placementRefusal(
    at: readonly [Location, Location],
    others: readonly PlacedPart[],
  ): EditRefusal | null {
    if (!at.every((location) => this.isOnBoard(location))) {
      return 'off-board';
    }
    if (locationKey(at[0]) === locationKey(at[1])) {
      return 'same-hole';
    }
    // A breadboard hole holds one leg; a snap post takes any number of parts.
    const taken = new Set(
      others.flatMap((p) => p.at.filter((l) => l.kind !== 'snap').map(locationKey)),
    );
    if (at.some((location) => location.kind !== 'snap' && taken.has(locationKey(location)))) {
      return 'hole-taken';
    }
    return null;
  }

  private isOnBoard(location: Location): boolean {
    if (location.kind === 'snap') {
      return (
        this.board.kind === 'snap' &&
        isWithin(location.row, this.board.rows) &&
        isWithin(location.column, this.board.columns)
      );
    }
    return this.board.kind === 'breadboard' && isValidHole(this.board.layout, location);
  }
}

/** A stable name for a location, equal for equal locations. */
export function locationKey(location: Location): string {
  return location.kind === 'snap' ? `snap:${location.row}:${location.column}` : holeName(location);
}

function isWithin(index: number, count: number): boolean {
  return Number.isInteger(index) && index >= 1 && index <= count;
}
