import type { PartAllowance } from '../core/levels';
import { sandbox } from '../levels/sandbox';
import { strings } from './strings';
import { Workbench } from './Workbench';

interface SandboxScreenProps {
  /** Every part unlocked so far (`sandboxTray`). */
  tray: readonly PartAllowance[];
  meter: boolean;
  onBack: () => void;
}

/** Free building on a full-size board, with no goal: the sandbox (docs/design.md §3). */
export function SandboxScreen({ tray, meter, onBack }: SandboxScreenProps) {
  return (
    <main className="level">
      <header className="level-header">
        <button type="button" onClick={onBack}>
          {strings.backToLevels}
        </button>
        <div>
          <h1>{strings.sandbox}</h1>
          <p className="level-goal">{strings.sandboxIntro}</p>
        </div>
      </header>
      <Workbench
        board={sandbox.board}
        tray={tray}
        initial={sandbox.initial}
        meter={meter}
        zoomable
      />
    </main>
  );
}
