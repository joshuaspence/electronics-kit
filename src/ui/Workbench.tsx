import {
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  type Board as BoardModel,
  type Build,
  type Edit,
  type Location,
  type PartSpec,
  type PlacedPart,
  toCircuit,
} from '../core/build';
import { bulbBrightness, isShorted, ledBrightness, type PartReading, solveDc } from '../core/dc';
import { flowSpeed } from '../core/flow';
import type { PartAllowance } from '../core/levels';
import { Board, type Ghost } from './Board';
import {
  geometryFor,
  type Orientation,
  type Point,
  quarterTurn,
  secondLeg,
  STEPS,
  turned,
} from './geometry';
import { strings } from './strings';
import { playChime, playPop, playSnap, playWarning } from './sound';
import { Tray } from './Tray';
import { useEditor } from './useEditor';

/** Pointer travel (in board units) below which a press counts as a tap, not a drag. */
const TAP_DISTANCE = 6;

type Legs = readonly [Location, Location];

type Drag =
  | { readonly type: 'new'; readonly spec: PartSpec; readonly pointer: Point | null }
  | { readonly type: 'move'; readonly id: string; readonly start: Point; readonly pointer: Point }
  | { readonly type: 'wire'; readonly from: Location; readonly pointer: Point }
  // Panning a zoomed board works in screen pixels: board units shift under the pointer as it pans,
  // so the pan keeps how many board units a pixel was worth when it started.
  | {
      readonly type: 'pan';
      readonly start: Point;
      readonly client: Point;
      readonly centre: Point;
      readonly perPixel: number;
    };

/** How far a zoomable board can zoom in, from showing its full height, and by how much a step. */
const MAX_ZOOM = 3;
const ZOOM_STEP = 1.25;

/** A zoomable board's window: wider than tall, like a landscape tablet. */
const VIEW_ASPECT = 1.5;

interface WorkbenchProps {
  board: BoardModel;
  tray: readonly PartAllowance[];
  initial: Build;
  /** Called with the build after every change, edits and flipped switches alike. */
  onChange?: (build: Build) => void;
  /** What one of Volty's hints points at: a part to place, or a placed part to take away. */
  hint?: { readonly place?: PlacedPart; readonly removeId?: string } | undefined;
  /** The level's goal has been met: chime as it happens, unless muted. */
  finished?: boolean;
  /**
   * Shown at the foot of the column beside the board, such as Volty, so the layout keeps room for
   * it rather than letting it cover the tools.
   */
  aside?: ReactNode;
  /** The multimeter is unlocked, so it can be switched on (docs/design.md §4). */
  meter?: boolean;
  /** A board too big to show whole, such as the sandbox's: it pans and zooms. */
  zoomable?: boolean;
}

/** The board, the parts tray and the editing tools, wired to a BuildEditor. */
export function Workbench({
  board,
  tray,
  initial,
  onChange,
  hint,
  finished,
  aside,
  meter = false,
  zoomable = false,
}: WorkbenchProps) {
  const { editor, build, newId, apply, setControl, undo, redo } = useEditor(board, tray, initial);
  // Report only real changes to the build, not a parent passing a new callback.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  useEffect(() => onChangeRef.current?.(build), [build]);
  const geometry = useMemo(() => geometryFor(board), [board]);

  // A zoomable board shows a window onto itself, `zoom` times its full height, centred on
  // `centre` and kept within the board.
  const [zoom, setZoom] = useState(1);
  const [centre, setCentre] = useState<Point>({ x: 0, y: geometry.height / 2 });
  const viewSize = () => {
    const height = geometry.height / zoom;
    return { width: Math.min(geometry.width, height * VIEW_ASPECT), height };
  };
  const viewFor = (at: Point): readonly [number, number, number, number] => {
    const { width, height } = viewSize();
    const clamp = (v: number, size: number, full: number) =>
      Math.min(Math.max(v - size / 2, 0), full - size);
    return [
      clamp(at.x, width, geometry.width),
      clamp(at.y, height, geometry.height),
      width,
      height,
    ];
  };
  const zoomBy = (factor: number) =>
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(1, Math.round(z * factor * 100) / 100)));
  /** Where a pan has moved the window's centre to, in board units. */
  const pannedCentre = (pan: Drag & { type: 'pan' }): Point => ({
    x: pan.centre.x - (pan.client.x - pan.start.x) * pan.perPixel,
    y: pan.centre.y - (pan.client.y - pan.start.y) * pan.perPixel,
  });
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<Orientation>('right');
  const [muted, setMuted] = useState(false);
  const [meterOn, setMeterOn] = useState(false);

  /** Applies an edit, with a snap when a part lands in the board. */
  const edit = (change: Edit) => {
    const result = apply(change);
    if (result.ok && change.kind !== 'remove' && !muted) {
      playSnap();
    }
    return result;
  };

  const circuit = toCircuit(board, build);
  const solution = solveDc(circuit);
  const brightness = new Map<string, number>();
  const flows = new Map<string, number>();
  const hot = new Set<string>();
  for (const part of circuit.parts) {
    const reading = solution.parts.get(part.id)!;
    flows.set(part.id, flowSpeed(reading.current));
    if (part.kind === 'bulb') {
      brightness.set(part.id, bulbBrightness(part, reading));
    } else if (part.kind === 'led') {
      brightness.set(part.id, ledBrightness(part, reading));
    } else if (part.kind === 'battery' && isShorted(part, reading)) {
      hot.add(part.id);
    }
  }

  // Buzz once each time the battery becomes shorted, not on every render while it stays so.
  const shorted = hot.size > 0;
  const wasShorted = useRef(false);
  useEffect(() => {
    if (shorted && !wasShorted.current && !muted) {
      playWarning();
    }
    wasShorted.current = shorted;
  }, [shorted, muted]);

  // Pop as an LED blows, the same way: blowing more of them pops again, undoing them doesn't.
  const blown = build.parts.filter((p) => p.spec.kind === 'led' && p.spec.blown).length;
  const wasBlown = useRef(blown);
  useEffect(() => {
    if (blown > wasBlown.current && !muted) {
      playPop();
    }
    wasBlown.current = blown;
  }, [blown, muted]);

  // Chime once as the level is finished, the same way.
  const wasFinished = useRef(false);
  useEffect(() => {
    if (finished && !wasFinished.current && !muted) {
      playChime();
    }
    wasFinished.current = finished ?? false;
  }, [finished, muted]);

  const find = (id: string) => build.parts.find((p) => p.id === id);
  const selected = selectedId === null ? undefined : find(selectedId);

  const toBoard = (clientX: number, clientY: number): Point | null => {
    const matrix = svgRef.current?.getScreenCTM();
    if (!matrix) {
      return null;
    }
    const p = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    return { x: p.x, y: p.y };
  };

  /** Where a new part's legs go when the pointer holds it by its middle. */
  const newPartLegs = (spec: PartSpec, pointer: Point): Legs | null => {
    const half = (geometry.legSpan(spec.kind) * geometry.pitch) / 2;
    const step = STEPS[orientation];
    const first = geometry.nearest({
      x: pointer.x - step.columns * half,
      y: pointer.y - step.rows * half,
    });
    const second = first && secondLeg(geometry, first, spec.kind, orientation);
    return first && second ? [first, second] : null;
  };

  /** Where a placed part's legs go when dragged from `start` to `pointer`, keeping their shape. */
  const movedLegs = (part: PlacedPart, start: Point, pointer: Point): Legs | null => {
    const [a, b] = part.at;
    const from = geometry.position(a);
    const first = geometry.nearest({
      x: from.x + pointer.x - start.x,
      y: from.y + pointer.y - start.y,
    });
    const { rows, columns } = geometry.delta(a, b);
    const second = first && geometry.offset(first, rows, columns);
    return first && second ? [first, second] : null;
  };

  const placeAndSelect = (spec: PartSpec, at: Legs) => {
    const id = newId(spec.kind);
    if (edit({ kind: 'place', part: { id, spec, at, fixed: false } }).ok) {
      setSelectedId(id);
    }
  };

  const drop = (d: Drag) => {
    switch (d.type) {
      case 'new': {
        const legs = d.pointer && newPartLegs(d.spec, d.pointer);
        if (legs) {
          placeAndSelect(d.spec, legs);
        }
        return;
      }
      case 'move': {
        const part = find(d.id);
        if (!part) {
          return;
        }
        if (Math.hypot(d.pointer.x - d.start.x, d.pointer.y - d.start.y) < TAP_DISTANCE) {
          // A tap flips a switch and selects the part for rotating or removing.
          if (part.spec.kind === 'switch') {
            setControl(part.id, !part.spec.closed);
          }
          setSelectedId(part.id);
          return;
        }
        const legs = movedLegs(part, d.start, d.pointer);
        if (legs) {
          edit({ kind: 'move', id: d.id, at: legs });
        }
        return;
      }
      case 'wire': {
        const to = geometry.nearest(d.pointer);
        if (to && geometry.name(to) !== geometry.name(d.from)) {
          placeAndSelect({ kind: 'wire' }, [d.from, to]);
        }
        return;
      }
      case 'pan':
        return;
    }
  };

  // While dragging, follow the pointer anywhere on the page and drop where it is released. A
  // button is pressed only while it is held, so every release lets go of it too.
  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (drag?.type === 'pan') {
        setDrag({ ...drag, client: { x: event.clientX, y: event.clientY } });
        return;
      }
      const pointer = toBoard(event.clientX, event.clientY);
      if (pointer) {
        setDrag((d) => (d && d.type !== 'pan' ? { ...d, pointer } : d));
      }
    };
    const onUp = (event: PointerEvent) => {
      for (const part of editor.build.parts) {
        if (part.spec.kind === 'button' && part.spec.pressed) {
          setControl(part.id, false);
        }
      }
      if (drag?.type === 'pan') {
        setCentre(pannedCentre({ ...drag, client: { x: event.clientX, y: event.clientY } }));
        setDrag(null);
      } else if (drag) {
        // Drop where the pointer is released, not where the last render saw it: a fast drag can
        // be released before the final move has re-rendered.
        const pointer = toBoard(event.clientX, event.clientY) ?? drag.pointer;
        drop(pointer ? { ...drag, pointer } : drag);
        setDrag(null);
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  });

  // A placed part only counts as moving once the pointer has gone further than a tap.
  const moving =
    drag?.type === 'move' &&
    Math.hypot(drag.pointer.x - drag.start.x, drag.pointer.y - drag.start.y) >= TAP_DISTANCE
      ? find(drag.id)
      : undefined;

  // Where the dragged part would land if dropped now, and the part itself under the pointer.
  const { landing, held } = ((): { landing: Ghost | null; held: Ghost | null } => {
    const at = (spec: PartSpec, legs: Legs | null): Ghost | null =>
      legs && { spec, from: geometry.position(legs[0]), to: geometry.position(legs[1]) };
    if (drag?.type === 'wire') {
      const to = geometry.nearest(drag.pointer);
      return {
        landing: to && at({ kind: 'wire' }, [drag.from, to]),
        held: { spec: { kind: 'wire' }, from: geometry.position(drag.from), to: drag.pointer },
      };
    }
    if (drag?.type === 'new' && drag.pointer) {
      const step = STEPS[orientation];
      const half = (geometry.legSpan(drag.spec.kind) * geometry.pitch) / 2;
      const offset = { x: step.columns * half, y: step.rows * half };
      const { x, y } = drag.pointer;
      return {
        landing: at(drag.spec, newPartLegs(drag.spec, drag.pointer)),
        held: {
          spec: drag.spec,
          from: { x: x - offset.x, y: y - offset.y },
          to: { x: x + offset.x, y: y + offset.y },
        },
      };
    }
    if (drag?.type === 'move' && moving) {
      const dx = drag.pointer.x - drag.start.x;
      const dy = drag.pointer.y - drag.start.y;
      const [a, b] = moving.at.map((l) => geometry.position(l));
      return {
        landing: at(moving.spec, movedLegs(moving, drag.start, drag.pointer)),
        held: {
          spec: moving.spec,
          from: { x: a!.x + dx, y: a!.y + dy },
          to: { x: b!.x + dx, y: b!.y + dy },
        },
      };
    }
    return { landing: null, held: null };
  })();

  // While dragging, light up the strips the part would join, so a child sees where it connects.
  const targetStrips = ((): ReadonlySet<string> | null => {
    if (!drag || drag.type === 'pan') {
      return null;
    }
    // A wire is joined to the strip it starts from wherever it ends up.
    const legs = [
      drag.type === 'wire' ? drag.from : null,
      ...[landing?.from, landing?.to].map((p) => p && geometry.nearest(p)),
    ];
    return new Set(legs.flatMap((l) => (l ? [geometry.stripKey(l)] : [])));
  })();

  const rotate = () => {
    if (!selected) {
      setOrientation(turned);
      return;
    }
    if (selected.spec.kind === 'wire') {
      return;
    }
    const at = quarterTurn(geometry, selected.at);
    if (at) {
      edit({ kind: 'move', id: selected.id, at });
    }
  };

  const onPickUp = (spec: PartSpec, event: ReactPointerEvent) => {
    event.preventDefault();
    setSelectedId(null);
    setDrag({ type: 'new', spec, pointer: toBoard(event.clientX, event.clientY) });
  };

  const onHolePointerDown = (hole: Location, event: ReactPointerEvent) => {
    const pointer = toBoard(event.clientX, event.clientY);
    if (pointer && editor.remaining('wire') > 0) {
      setDrag({ type: 'wire', from: hole, pointer });
    }
  };

  const onPartPointerDown = (id: string, event: ReactPointerEvent) => {
    event.stopPropagation();
    const part = find(id);
    const pointer = toBoard(event.clientX, event.clientY);
    if (!part || !pointer) {
      return;
    }
    if (part.spec.kind === 'button') {
      setControl(id, true);
    }
    if (!part.fixed) {
      setDrag({ type: 'move', id, start: pointer, pointer });
      return;
    }
    if (part.spec.kind === 'switch') {
      setControl(id, !part.spec.closed);
    }
    // A level's own parts can't be moved, but tapping selects them so the meter can measure them.
    if (meter && meterOn) {
      setSelectedId(id);
    }
  };

  return (
    <div className="workbench">
      <Tray
        tray={tray}
        remaining={(kind) => editor.remaining(kind)}
        onPickUp={onPickUp}
        snap={board.kind === 'snap'}
      />
      <p className="warning" role="status">
        {shorted ? strings.shortCircuit : blown > 0 ? strings.ledPopped : ''}
      </p>
      <Board
        ref={svgRef}
        geometry={geometry}
        snap={board.kind === 'snap'}
        build={build}
        brightness={brightness}
        flows={flows}
        hot={hot}
        selectedId={selectedId}
        ghost={landing}
        held={held}
        movingId={moving?.id ?? null}
        targetStrips={targetStrips}
        hintGhost={
          hint?.place
            ? {
                spec: hint.place.spec,
                from: geometry.position(hint.place.at[0]),
                to: geometry.position(hint.place.at[1]),
              }
            : null
        }
        hintedId={hint?.removeId ?? null}
        onHolePointerDown={onHolePointerDown}
        onPartPointerDown={onPartPointerDown}
        view={zoomable ? viewFor(drag?.type === 'pan' ? pannedCentre(drag) : centre) : undefined}
        onBackgroundPointerDown={
          zoomable
            ? (event) => {
                const client = { x: event.clientX, y: event.clientY };
                const perPixel = viewSize().width / (svgRef.current?.clientWidth || 1);
                setDrag({ type: 'pan', start: client, client, centre, perPixel });
              }
            : undefined
        }
        onWheel={
          zoomable ? (event) => zoomBy(event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP) : undefined
        }
      />
      <div className="tools" role="toolbar" aria-label={strings.toolsLabel}>
        <button type="button" onClick={undo} disabled={!editor.canUndo}>
          {strings.undo}
        </button>
        <button type="button" onClick={redo} disabled={!editor.canRedo}>
          {strings.redo}
        </button>
        {zoomable && (
          <>
            <button type="button" onClick={() => zoomBy(ZOOM_STEP)} disabled={zoom >= MAX_ZOOM}>
              {strings.zoomIn}
            </button>
            <button type="button" onClick={() => zoomBy(1 / ZOOM_STEP)} disabled={zoom <= 1}>
              {strings.zoomOut}
            </button>
          </>
        )}
        <button type="button" onClick={rotate} disabled={selected?.fixed}>
          {strings.rotate}
        </button>
        <button
          type="button"
          disabled={!selected || selected.fixed}
          onClick={() => {
            if (selected && apply({ kind: 'remove', id: selected.id }).ok) {
              setSelectedId(null);
            }
          }}
        >
          {strings.remove}
        </button>
        <button type="button" aria-pressed={muted} onClick={() => setMuted((m) => !m)}>
          {muted ? strings.soundOff : strings.soundOn}
        </button>
        {meter && (
          <button
            type="button"
            aria-pressed={meterOn}
            onClick={() => {
              setMeterOn((on) => !on);
              // A fixed part is selected only for the meter, so let go of it as the meter goes off.
              if (selected?.fixed) {
                setSelectedId(null);
              }
            }}
          >
            {strings.meter}
          </button>
        )}
      </div>
      {meter && meterOn && (
        <Meter part={selected} reading={selected && solution.parts.get(selected.id)} />
      )}
      {aside && <div className="workbench-aside">{aside}</div>}
    </div>
  );
}

/** The multimeter's display: the selected part's volts across it and current through it. */
function Meter({
  part,
  reading,
}: {
  part: PlacedPart | undefined;
  reading: PartReading | undefined;
}) {
  return (
    <output className="meter" aria-label={strings.meterLabel}>
      {part && reading ? (
        <>
          <span className="meter-part">{strings.meterPart(strings.parts[part.spec.kind])}</span>
          <span className="meter-value">{strings.volts(Math.abs(reading.voltage))}</span>
          <span className="meter-value">{strings.milliamps(Math.abs(reading.current) * 1000)}</span>
        </>
      ) : (
        <span className="meter-part">{strings.meterPrompt}</span>
      )}
    </output>
  );
}
