import { strings } from './strings';

/**
 * A phone held upright is too narrow for the board, so it asks to be turned sideways
 * (docs/design.md §9). Always rendered, and shown over everything by CSS only on a narrow portrait
 * screen, so turning the phone takes it away without a re-render.
 */
export function RotatePrompt() {
  return (
    <div className="rotate-prompt">
      <svg viewBox="0 0 64 64" width="96" height="96" aria-hidden="true">
        <rect className="rotate-phone" x="20" y="8" width="24" height="44" rx="4" />
        <path className="rotate-arrow" d="M 52 30 a 20 20 0 0 1 -16 24 m 0 0 l 5 -5 m -5 5 l 6 3" />
      </svg>
      <p>{strings.turnSideways}</p>
    </div>
  );
}

/** On a phone on its side the board's holes are small, so the level list says so, once. */
export function SmallScreenNote() {
  return <p className="small-screen-note">{strings.smallScreen}</p>;
}
