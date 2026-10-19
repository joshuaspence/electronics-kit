import type { PartKind } from '../core/circuit';

/** A part's name mid-sentence, alone and with its article, which "LED" can't be derived for. */
const partInSentence: Record<PartKind, { readonly noun: string; readonly a: string }> = {
  battery: { noun: 'battery', a: 'a battery' },
  bulb: { noun: 'bulb', a: 'a bulb' },
  led: { noun: 'LED', a: 'an LED' },
  resistor: { noun: 'resistor', a: 'a resistor' },
  capacitor: { noun: 'capacitor', a: 'a capacitor' },
  switch: { noun: 'switch', a: 'a switch' },
  button: { noun: 'button', a: 'a button' },
  buzzer: { noun: 'buzzer', a: 'a buzzer' },
  motor: { noun: 'motor', a: 'a motor' },
  'light-sensor': { noun: 'light sensor', a: 'a light sensor' },
  wire: { noun: 'wire', a: 'a wire' },
};

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
  ledPopped:
    'Pop! Too much electricity rushed through the LED and it burnt out. Press Undo to get it back.',
  soundOn: 'Sound on',
  soundOff: 'Sound off',
  backToLevels: 'Levels',
  sandbox: 'Sandbox',
  whoIsPlaying: 'Who’s playing?',
  changePlayer: 'Change player',
  playingAs: (name: string) => `Playing as ${name}`,
  newPlayer: 'New player',
  playerName: 'Name',
  pickAvatar: 'Pick a picture',
  avatarLabel: (avatar: string) => `Picture ${avatar}`,
  addPlayer: 'Add player',
  starCount: (stars: number) => `${stars} ★`,
  sandboxIntro:
    'Build anything you like with the parts you’ve unlocked. Finish levels to unlock more.',
  share: 'Share',
  linkCopied: 'Link copied! Send it to a friend to show them your circuit:',
  copyLink: 'Copy this link to show someone your circuit:',
  badShareLink:
    'That share link didn’t work, so here’s an empty board. Ask for the link again, or build your own.',
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
    'too-dim':
      'They’re glowing, but only dimly: one after the other, they share the battery’s push. Try giving each bulb its own path from one end of the battery to the other.',
    'led-blown':
      'That LED popped: too much electricity went through it. Press Undo to get it back, then give it something to slow the electricity down.',
    'led-overdriven':
      'Careful: that LED would pop! It needs something to slow the electricity down, like a resistor in the loop with it.',
    'led-backwards':
      'An LED only lets electricity through one way. Turn it round so its long leg, the +, is on the battery’s + side.',
    'short-circuit':
      'Uh oh, a shortcut! Electricity is rushing straight back to the battery without going through a bulb.',
    'not-controlled':
      'The bulb stays on even when the switch is off. Put the switch in the loop so it can make a gap.',
    'no-control': 'This one needs a switch or a button in the loop.',
    'not-every-control':
      'The bulb still lights with one of them off. Put them one after the other in the loop, so the bulb needs them all.',
    'switch-off': 'Your circuit looks ready. Try switching it on!',
  },
  hintPlace: (kind: PartKind) => `Try putting ${partInSentence[kind].a} where I’ve shown it.`,
  hintRemove: (kind: PartKind) =>
    `That ${partInSentence[kind].noun} is getting in the way. Try removing it.`,
  undo: 'Undo',
  redo: 'Redo',
  rotate: 'Rotate',
  remove: 'Remove',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  meter: 'Meter',
  light: 'Light',
  dark: 'Dark',
  lightLabel: 'Light on the sensor',
  meterLabel: 'Multimeter',
  meterPrompt: 'Tap a part to measure it.',
  meterPart: (part: string) => `${part}:`,
  volts: (volts: number) => `${volts.toFixed(2)} V`,
  // Small currents keep a decimal place so a dim LED doesn't read as nothing.
  milliamps: (milliamps: number) => `${milliamps.toFixed(milliamps < 10 ? 1 : 0)} mA`,
  parts: {
    battery: 'Battery',
    bulb: 'Bulb',
    led: 'LED',
    resistor: 'Resistor',
    capacitor: 'Capacitor',
    switch: 'Switch',
    button: 'Button',
    buzzer: 'Buzzer',
    motor: 'Motor',
    'light-sensor': 'Light sensor',
    wire: 'Wire',
  } satisfies Record<PartKind, string>,
} as const;
