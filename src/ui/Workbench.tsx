import {
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useEffect,
  useEffectEvent,
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
import {
  bulbBrightness,
  buzzerSounds,
  isShorted,
  ledBrightness,
  motorSpeed,
  type PartReading,
} from '../core/dc';
import type { CircuitSolution } from '../core/mna';
import { flowSpeed } from '../core/flow';
import type { PartAllowance } from '../core/levels';
import { Board, type Ghost } from './Board';
import {
  type BoardGeometry,
  geometryFor,
  type Orientation,
  type Point,
  quarterTurn,
  legsFrom,
  STEPS,
  turned,
} from './geometry';
import { strings } from './strings';
import { playChime, playPop, playSnap, playWarning, setBuzzing } from './sound';
import { Tray } from './Tray';
import { useEditor } from './useEditor';
import { changesOverTime, useSimulation } from './useSimulation';

/** Real time, slow motion and slower motion (docs/design.md §4); the speed button steps through them. */
const SPEEDS = [1, 0.25, 0.1] as const;

/** Pointer travel (in board units) below which a press counts as a tap, not a drag. */
const TAP_DISTANCE = 6;

type Legs = readonly [Location, Location];

type Drag =
  | { readonly type: 'new'; readonly spec: PartSpec; readonly pointer: Point | null }
  | { readonly type: 'move'; readonly id: string; readonly start: Point; readonly pointer: Point }
  | { readonly type: 'wire'; readonly from: Location; readonly pointer: Point }
  // Panning a zoomed board works in screen pixels: board units shift under the pointer as it pans,
  // so the pan keeps how many board units a pixel was worth when it started. It follows only the
  // finger that started it, so a second finger can't drag the board back or end the pan.
  | {
      readonly type: 'pan';
      readonly pointerId: number;
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

/** A zoomable board's window: `zoom` times its full height, centred on `centre`. */
interface View {
  readonly zoom: number;
  readonly centre: Point;
}

/** The window `view` shows onto the board, as a viewBox `[x, y, width, height]` kept within it. */
function viewBox(board: BoardGeometry, { zoom, centre }: View): [number, number, number, number] {
  const height = board.height / zoom;
  const width = Math.min(board.width, height * VIEW_ASPECT);
  const clamp = (v: number, size: number, full: number) =>
    Math.min(Math.max(v - size / 2, 0), full - size);
  return [
    clamp(centre.x, width, board.width),
    clamp(centre.y, height, board.height),
    width,
    height,
  ];
}

/**
 * `view` with its centre moved to where the window actually is. A centre left beyond where the
 * window can go would make the next pan do nothing until it had made up the difference.
 */
function clamped(board: BoardGeometry, view: View): View {
  const [x, y, width, height] = viewBox(board, view);
  return { zoom: view.zoom, centre: { x: x + width / 2, y: y + height / 2 } };
}

/** `view` zoomed by `factor`, from the board's full height to `MAX_ZOOM` times closer. */
function zoomed(board: BoardGeometry, view: View, factor: number): View {
  const zoom = Math.min(MAX_ZOOM, Math.max(1, Math.round(view.zoom * factor * 100) / 100));
  return clamped(board, { ...view, zoom });
}

interface WorkbenchProps {
  board: BoardModel;
  tray: readonly PartAllowance[];
  initial: Build;
  /**
   * Called with the build after every change, edits and flipped switches alike, and the solution
   * the board then shows: for a circuit that changes over time, the transient run's.
   */
  onChange?: (build: Build, shown: CircuitSolution) => void;
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
  const { editor, build, newId, apply, setControl, setLight, undo, redo } = useEditor(
    board,
    tray,
    initial,
  );
  const geometry = useMemo(() => geometryFor(board), [board]);

  // A zoomable board opens on its left end.
  const [view, setView] = useState<View>(() =>
    clamped(geometry, { zoom: 1, centre: { x: 0, y: geometry.height / 2 } }),
  );
  /** Where a pan has moved the window's centre to, in board units. */
  const pannedCentre = (pan: Drag & { type: 'pan' }): Point => ({
    x: pan.centre.x - (pan.client.x - pan.start.x) * pan.perPixel,
    y: pan.centre.y - (pan.client.y - pan.start.y) * pan.perPixel,
  });
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  // One drag at a time: a second finger pressing a hole, a part or the tray mid-drag starts nothing.
  const startDrag = (next: Drag) => setDrag((d) => d ?? next);
  // A pan keeps the scale it started at, so the zoom waits for it to end.
  const panning = drag?.type === 'pan';
  const zoomBy = (factor: number) => {
    if (!panning) {
      setView((v) => zoomed(geometry, v, factor));
    }
  };
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<Orientation>('right');
  const [muted, setMuted] = useState(false);
  const [meterOn, setMeterOn] = useState(false);

  // React's own wheel listeners are passive, so they can't stop the page scrolling (or, with a
  // pinch, zooming) under the board as it zooms. A sideways swipe has no `deltaY`, and isn't a zoom.
  useEffect(() => {
    const svg = svgRef.current;
    if (!zoomable || !svg) {
      return;
    }
    const onWheel = (event: WheelEvent) => {
      if (event.deltaY === 0) {
        return;
      }
      event.preventDefault();
      if (!panning) {
        setView((v) => zoomed(geometry, v, event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP));
      }
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [zoomable, geometry, panning]);

  /** Applies an edit, with a snap when a part lands in the board. */
  const edit = (change: Edit) => {
    const result = apply(change);
    if (result.ok && change.kind !== 'remove' && !muted) {
      playSnap();
    }
    return result;
  };

  const circuit = toCircuit(board, build);
  const timed = changesOverTime(circuit);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(SPEEDS[0]);
  const solution = useSimulation(circuit, speed);
  // Report only real changes to the build, not a parent passing a new callback or a new frame.
  const reportChange = useEffectEvent(() => onChange?.(build, solution));
  useEffect(() => reportChange(), [build]);
  // A capacitor's charge, drawn as how full it is, against the battery it can charge to.
  const fullVolts = Math.max(
    1,
    ...circuit.parts.map((part) => (part.kind === 'battery' ? Math.abs(part.volts) : 0)),
  );
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
    } else if (part.kind === 'buzzer') {
      brightness.set(part.id, buzzerSounds(part, reading) ? 1 : 0);
    } else if (part.kind === 'motor') {
      brightness.set(part.id, motorSpeed(part, reading));
    } else if (part.kind === 'blinker') {
      // Its little light shows it switched on and passing current, so it is dark out of a loop.
      brightness.set(part.id, Math.abs(reading.current) >= 0.001 ? 1 : 0);
    } else if (part.kind === 'capacitor') {
      brightness.set(part.id, Math.min(1, Math.abs(reading.voltage) / fullVolts));
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

  // A buzzer sounds for as long as the circuit makes it, and stops when the bench goes away.
  const buzzing = !muted && circuit.parts.some((p) => p.kind === 'buzzer' && brightness.get(p.id));
  useEffect(() => setBuzzing(buzzing), [buzzing]);
  useEffect(() => () => setBuzzing(false), []);

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
    const span = geometry.legSpan(spec.kind);
    return first && legsFrom(geometry, first, step.rows * span, step.columns * span);
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
    return first && legsFrom(geometry, first, rows, columns);
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
        if (event.pointerId === drag.pointerId) {
          setDrag({ ...drag, client: { x: event.clientX, y: event.clientY } });
        }
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
        if (event.pointerId === drag.pointerId) {
          const centre = pannedCentre({ ...drag, client: { x: event.clientX, y: event.clientY } });
          setView((v) => clamped(geometry, { ...v, centre }));
          setDrag(null);
        }
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
    startDrag({ type: 'new', spec, pointer: toBoard(event.clientX, event.clientY) });
  };

  const onHolePointerDown = (hole: Location, event: ReactPointerEvent) => {
    const pointer = toBoard(event.clientX, event.clientY);
    if (pointer && editor.remaining('wire') > 0) {
      startDrag({ type: 'wire', from: hole, pointer });
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
      startDrag({ type: 'move', id, start: pointer, pointer });
      return;
    }
    if (part.spec.kind === 'switch') {
      setControl(id, !part.spec.closed);
    }
    // A level's own parts can't be moved, but tapping selects them so the meter can measure them,
    // and a light sensor for its light slider.
    if ((meter && meterOn) || part.spec.kind === 'light-sensor') {
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
        view={
          zoomable
            ? viewBox(
                geometry,
                drag?.type === 'pan' ? { ...view, centre: pannedCentre(drag) } : view,
              )
            : undefined
        }
        onBackgroundPointerDown={
          zoomable
            ? (event) => {
                const client = { x: event.clientX, y: event.clientY };
                // The board's on-screen scale, whichever of its width or height bounds it.
                const perPixel = 1 / (svgRef.current?.getScreenCTM()?.a ?? 1);
                startDrag({
                  type: 'pan',
                  pointerId: event.pointerId,
                  start: client,
                  client,
                  centre: view.centre,
                  perPixel,
                });
              }
            : undefined
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
            <button
              type="button"
              onClick={() => zoomBy(ZOOM_STEP)}
              disabled={view.zoom >= MAX_ZOOM}
            >
              {strings.zoomIn}
            </button>
            <button type="button" onClick={() => zoomBy(1 / ZOOM_STEP)} disabled={view.zoom <= 1}>
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
        {timed && (
          <button
            type="button"
            aria-label={strings.speedLabel}
            onClick={() => setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length]!)}
          >
            {strings.speed(speed)}
          </button>
        )}
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
      {selected?.spec.kind === 'light-sensor' && (
        <label className="light-control">
          <span aria-hidden="true">{strings.dark}</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(selected.spec.light * 100)}
            aria-label={strings.lightLabel}
            onChange={(event) => setLight(selected.id, Number(event.target.value) / 100)}
          />
          <span aria-hidden="true">{strings.light}</span>
        </label>
      )}
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
