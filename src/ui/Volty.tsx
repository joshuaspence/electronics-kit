import { strings } from './strings';

interface VoltyProps {
  /** What Volty is saying, if anything. */
  says: string | null;
  /** Bob gently to offer help. */
  offering: boolean;
  onAsk: () => void;
}

/**
 * Volty, the guide: a chunky orange AA cell with a face, so it never looks like the black battery
 * packs on the board (docs/design.md §7). Tapping Volty asks for a hint.
 */
export function Volty({ says, offering, onAsk }: VoltyProps) {
  return (
    <aside className="volty">
      {says && (
        <p className="volty-bubble" role="status">
          {says}
        </p>
      )}
      <button
        type="button"
        className={offering ? 'volty-button volty-offering' : 'volty-button'}
        aria-label={strings.askVolty}
        onClick={onAsk}
      >
        <svg viewBox="0 0 100 130" width="80" height="104" aria-hidden="true">
          <line className="volty-arm" x1="22" y1="70" x2="6" y2="56" />
          <line className="volty-arm" x1="78" y1="70" x2="94" y2="56" />
          <rect className="volty-cap" x="38" y="6" width="24" height="14" rx="4" />
          <text className="volty-plus" x="50" y="18">
            +
          </text>
          <rect className="volty-body" x="20" y="18" width="60" height="104" rx="16" />
          <circle className="volty-eye" cx="40" cy="58" r="6" />
          <circle className="volty-eye" cx="60" cy="58" r="6" />
          <path className="volty-smile" d="M38 76 Q50 88 62 76" />
        </svg>
        <span className="volty-label">{strings.hint}</span>
      </button>
    </aside>
  );
}
