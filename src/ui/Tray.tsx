import type { PointerEvent as ReactPointerEvent } from 'react';
import type { PartSpec } from '../core/build';
import { newSpec } from '../core/catalogue';
import type { PartAllowance } from '../core/levels';
import { PartShape } from './PartShape';
import { strings } from './strings';

interface TrayProps {
  tray: readonly PartAllowance[];
  remaining: (kind: PartAllowance['kind']) => number;
  onPickUp: (spec: PartSpec, event: ReactPointerEvent) => void;
  /** On a snap board wires go between posts rather than holes. */
  snap: boolean;
  /** The part the guided tutorial says to pick up next, which pulses. */
  guided?: PartAllowance['kind'] | undefined;
}

/**
 * The parts the child can still place. Wires are drawn on the board, so they aren't picked up:
 * how to draw them is a note under the bin rather than a compartment in it.
 */
export function Tray({ tray, remaining, onPickUp, snap, guided }: TrayProps) {
  const parts = tray.filter(({ kind }) => kind !== 'wire');
  const wires = tray.some(({ kind }) => kind === 'wire');
  return (
    <>
      <ul className="tray" aria-label={strings.trayLabel}>
        {parts.map(({ kind }) => {
          const left = remaining(kind);
          return (
            <li key={kind}>
              <button
                type="button"
                className={kind === guided ? 'tray-item tray-item-guided' : 'tray-item'}
                data-tray={kind}
                disabled={left === 0}
                onPointerDown={(event) => left > 0 && onPickUp(newSpec(kind), event)}
              >
                <svg className="tray-icon" viewBox="-28 -16 56 32" aria-hidden="true">
                  <PartShape spec={newSpec(kind)} from={{ x: -26, y: 0 }} to={{ x: 26, y: 0 }} />
                </svg>
                {strings.parts[kind]} <span className="tray-count">×{left}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {wires && (
        <p className="wire-hint" data-tray="wire">
          <svg className="wire-hint-icon" viewBox="0 0 32 16" aria-hidden="true">
            <path d="M4 12 C 12 12, 18 4, 28 4" />
            <circle cx="4" cy="12" r="2.5" />
            <circle cx="28" cy="4" r="2.5" />
          </svg>
          {snap ? strings.wireHintSnap : strings.wireHint}{' '}
          <span className="tray-count">×{remaining('wire')}</span>
        </p>
      )}
    </>
  );
}
