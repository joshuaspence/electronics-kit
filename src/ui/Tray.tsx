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

/** The parts the child can still place. Wires are drawn on the board, so they aren't picked up. */
export function Tray({ tray, remaining, onPickUp, snap, guided }: TrayProps) {
  return (
    <ul className="tray" aria-label={strings.trayLabel}>
      {tray.map(({ kind }) => {
        const left = remaining(kind);
        if (kind === 'wire') {
          return (
            <li key={kind} className="tray-info" data-tray={kind}>
              {snap ? strings.wireHintSnap : strings.wireHint}{' '}
              <span className="tray-count">×{left}</span>
            </li>
          );
        }
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
  );
}
