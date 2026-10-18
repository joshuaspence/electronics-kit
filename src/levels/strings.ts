// Player-facing level text, in Australian English (docs/design.md §6).

export interface LevelText {
  readonly title: string;
  readonly goal: string;
  /** The "Why?" card after the level. */
  readonly why: string;
}

export const chapterTitles: Readonly<Record<number, string>> = {
  1: 'Make a loop',
};

export const levelText: Readonly<Record<string, LevelText>> = {
  'loop-1': {
    title: 'Light it up',
    goal: 'Make the bulb glow. Snap the bulb onto two posts, then use wires to join it to the battery.',
    why: 'Electricity flows out of one end of the battery, through the bulb and back into the other end. It needs a complete loop, called a circuit.',
  },
  'loop-2': {
    title: 'The long way round',
    goal: 'The bulb is far from the battery. Use wires to light it.',
    why: 'Wires let electricity travel a long way. It doesn’t matter how long the loop is, as long as it isn’t broken.',
  },
  'loop-3': {
    title: 'Mind the gap',
    goal: 'This circuit has a gap. Find it and fix it with one wire.',
    why: 'A gap anywhere in the loop stops the electricity everywhere. That’s why one broken part can turn a whole circuit off.',
  },
  'loop-4': {
    title: 'Double bright',
    goal: 'Light both bulbs with one battery.',
    why: 'Electricity can go through one bulb and then the next. They share the battery, so each bulb glows a little less brightly.',
  },
  'loop-5': {
    title: 'Shortcut!',
    goal: 'Someone wired a shortcut. Fix it so the bulb lights instead.',
    why: 'Electricity takes the easiest path. A wire straight from one end of the battery to the other is a short circuit: it skips the bulb and makes the battery hot.',
  },
};
