import type { PointerEvent as ReactPointerEvent } from 'react';
import type { PartSpec } from '../core/build';
import { newSpec } from '../core/catalogue';
import type { PartAllowance } from '../core/levels';
import { strings } from './strings';

interface TrayProps {
  tray: readonly PartAllowance[];
  remaining: (kind: PartAllowance['kind']) => number;
  onPickUp: (spec: PartSpec, event: ReactPointerEvent) => void;
}

/** The parts the child can still place. Wires are drawn on the board, so they aren't picked up. */
export function Tray({ tray, remaining, onPickUp }: TrayProps) {
  return (
    <ul className="tray" aria-label={strings.trayLabel}>
      {tray.map(({ kind }) => {
        const left = remaining(kind);
        if (kind === 'wire') {
          return (
            <li key={kind} className="tray-info" data-tray={kind}>
              {strings.wireHint} <span className="tray-count">×{left}</span>
            </li>
          );
        }
        return (
          <li key={kind}>
            <button
              type="button"
              className="tray-item"
              data-tray={kind}
              disabled={left === 0}
              onPointerDown={(event) => left > 0 && onPickUp(newSpec(kind), event)}
            >
              {strings.parts[kind]} <span className="tray-count">×{left}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
