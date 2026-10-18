import type { PartKind } from '../core/circuit';

// Player-facing text, in Australian English (docs/design.md §6).
export const strings = {
  title: 'Electronics Kit',
  boardLabel: 'Breadboard',
  trayLabel: 'Parts',
  toolsLabel: 'Tools',
  helloBoard:
    'Drag a bulb onto the board, then draw wires from hole to hole to make it glow. Holes in the same column are joined.',
  wireHint: 'Wires: drag from hole to hole',
  undo: 'Undo',
  redo: 'Redo',
  rotate: 'Rotate',
  remove: 'Remove',
  parts: {
    battery: 'Battery',
    bulb: 'Bulb',
    resistor: 'Resistor',
    capacitor: 'Capacitor',
    switch: 'Switch',
    button: 'Button',
    wire: 'Wire',
  } satisfies Record<PartKind, string>,
} as const;
