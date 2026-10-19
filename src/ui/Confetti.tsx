const PIECES = 32;
const COLOURS = ['#ffd84d', '#f28c28', '#3d8bfd', '#e5484d', '#30a46c'];

/**
 * A one-off confetti burst when a level is finished (docs/design.md §7). Each piece's place, colour
 * and timing come from its index, so the burst is the same every time and renders purely.
 */
export function Confetti() {
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: PIECES }, (_, i) => (
        <span
          key={i}
          style={{
            left: `${(i * 37) % 100}%`,
            background: COLOURS[i % COLOURS.length],
            animationDelay: `${(i % 8) * 60}ms`,
            animationDuration: `${1400 + ((i * 53) % 600)}ms`,
          }}
        />
      ))}
    </div>
  );
}
