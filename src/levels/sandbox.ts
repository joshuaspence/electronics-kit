import type { Board, Build } from '../core/build';
import { newSpec } from '../core/catalogue';

/**
 * The sandbox's board (docs/design.md §5): full size, 63 columns with both rail pairs, its battery
 * in the top rails. Too big to show whole, it pans and zooms.
 */
export const sandbox: {
  readonly board: Board & { readonly kind: 'breadboard' };
  readonly initial: Build;
} = {
  board: { kind: 'breadboard', layout: { columns: 63, centreGap: true, rails: 'both' } },
  initial: {
    parts: [
      {
        id: 'battery',
        spec: newSpec('battery'),
        at: [
          { kind: 'rail', rail: 'top+', position: 1 },
          { kind: 'rail', rail: 'top-', position: 1 },
        ],
        fixed: true,
      },
    ],
  },
};
