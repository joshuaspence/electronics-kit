import type { PartKind } from '../core/circuit';

// Player-facing text, in Australian English (docs/design.md §6).
export const strings = {
  title: 'Electronics Kit',
  boardLabel: 'Breadboard',
  trayLabel: 'Parts',
  toolsLabel: 'Tools',
  helloBoard:
    'Drag a bulb onto the board, then draw wires from hole to hole to make it glow. Holes in the same column are joined.',
  helloSnap:
    'Snap a bulb between two posts, then draw wires from post to post so the electricity can get from the battery, through the bulb and back.',
  wireHint: 'Wires: drag from hole to hole',
  wireHintSnap: 'Wires: drag from post to post',
  hot: 'Hot!',
  shortCircuit:
    'Whoa, short circuit! The electricity is rushing straight back to the battery without going through anything, so the battery is getting hot.',
  soundOn: 'Sound on',
  soundOff: 'Sound off',
  backToLevels: 'Levels',
  success: 'You did it!',
  why: 'Why?',
  tellMore: 'Tell me more',
  nextLevel: 'Next level',
  starsLabel: (stars: number) => `${stars} of 3 stars`,
  chapter: (n: number, title: string) => `Chapter ${n}: ${title}`,
  version: (version: string, commit: string) => `Version ${version} (${commit})`,
  updateReady: 'A new version of Electronics Kit is ready.',
  update: 'Update',
  askVolty: 'Ask Volty for a hint',
  hint: 'Hint',
  stuck: 'Stuck? Tap me for a hint!',
  hints: {
    'too-few-lit':
      'Electricity needs a complete loop: out of one end of the battery, through the bulb and back into the other end.',
    'short-circuit':
      'Uh oh, a shortcut! Electricity is rushing straight back to the battery without going through a bulb.',
    'not-controlled':
      'The bulb stays on even when the switch is off. Put the switch in the loop so it can make a gap.',
    'no-control': 'This one needs a switch or a button in the loop.',
    'switch-off': 'Your circuit looks ready. Try switching it on!',
  },
  hintPlace: (part: string) => `Try putting a ${part} where I’ve shown it.`,
  hintRemove: (part: string) => `That ${part} is getting in the way. Try removing it.`,
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
