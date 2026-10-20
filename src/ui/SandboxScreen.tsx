import { useState } from 'react';
import type { Build } from '../core/build';
import type { PartAllowance } from '../core/levels';
import { encodeCircuit } from '../core/share';
import { sandbox } from '../levels/sandbox';
import { strings } from './strings';
import { Workbench } from './Workbench';

interface SandboxScreenProps {
  /** Every part unlocked so far (`sandboxTray`). */
  tray: readonly PartAllowance[];
  meter: boolean;
  /** The circuit to start from: the board's own parts, or a shared circuit. */
  initial: Build;
  /** A share link that couldn't be read, so the child knows why the board is empty. */
  badLink?: boolean;
  onBack: () => void;
}

/** Free building on a full-size board, with no goal: the sandbox (docs/design.md §3). */
export function SandboxScreen({ tray, meter, initial, badLink, onBack }: SandboxScreenProps) {
  const [build, setBuild] = useState(initial);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // The link is the page's own address with the circuit in its fragment, which no server sees.
  const share = () => {
    const url = `${window.location.href.split('#')[0]}#c=${encodeURIComponent(encodeCircuit(build))}`;
    setLink(url);
    setCopied(false);
    navigator.clipboard?.writeText(url).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  };

  return (
    <main className="level fit-screen">
      <header className="level-header">
        <button type="button" onClick={onBack}>
          {strings.backToLevels}
        </button>
        <div>
          <h1>{strings.sandbox}</h1>
          <p className="level-goal">{badLink ? strings.badShareLink : strings.sandboxIntro}</p>
        </div>
        <button type="button" className="share" onClick={share}>
          {strings.share}
        </button>
      </header>
      {link && (
        <p className="share-link" role="status">
          {copied ? strings.linkCopied : strings.copyLink}{' '}
          <input
            readOnly
            value={link}
            aria-label={strings.share}
            onFocus={(e) => e.target.select()}
          />
        </p>
      )}
      <Workbench
        board={sandbox.board}
        tray={tray}
        initial={initial}
        onChange={setBuild}
        meter={meter}
        zoomable
        supply
      />
    </main>
  );
}
