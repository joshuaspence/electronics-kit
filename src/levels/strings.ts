// Player-facing level text, in Australian English (docs/design.md §6).

export interface LevelText {
  readonly title: string;
  readonly goal: string;
  /** The "Why?" card after the level. */
  readonly why: string;
  /** "Tell me more" on the "Why?" card: the same idea in real terms, for older children. */
  readonly more: string;
}

export const chapterTitles: Readonly<Record<number, string>> = {
  1: 'Make a loop',
  2: 'On and off',
};

export const levelText: Readonly<Record<string, LevelText>> = {
  'loop-1': {
    title: 'Light it up',
    goal: 'Make the bulb glow. Snap the bulb onto two posts, then use wires to join it to the battery.',
    why: 'Electricity flows out of one end of the battery, through the bulb and back into the other end. It needs a complete loop, called a circuit.',
    more: 'The battery pushes with 3 volts. That push makes a current flow around the loop and through the thin wire inside the bulb, which gets so hot it glows. Current is measured in amps.',
  },
  'loop-2': {
    title: 'The long way round',
    goal: 'The bulb is far from the battery. Use wires to light it.',
    why: 'Wires let electricity travel a long way. It doesn’t matter how long the loop is, as long as it isn’t broken.',
    more: 'Everything in a circuit resists the current a little. A wire’s resistance is tiny next to the bulb’s, so a longer loop makes almost no difference to how much current flows.',
  },
  'loop-3': {
    title: 'Mind the gap',
    goal: 'This circuit has a gap. Find it and fix it with one wire.',
    why: 'A gap anywhere in the loop stops the electricity everywhere. That’s why one broken part can turn a whole circuit off.',
    more: 'A loop with a gap is called an open circuit. Air has a huge resistance, so no current can flow, however hard the battery pushes.',
  },
  'loop-4': {
    title: 'Double bright',
    goal: 'Light both bulbs with one battery.',
    why: 'Electricity can go through one bulb and then the next. They share the battery, so each bulb glows a little less brightly.',
    more: 'Bulbs one after the other are in series. Their resistances add up, so the same 3 volts pushes about half as much current through them, and each bulb is dimmer.',
  },
  'loop-5': {
    title: 'Shortcut!',
    goal: 'Someone wired a shortcut. Fix it so the bulb lights instead.',
    why: 'Electricity takes the easiest path. A wire straight from one end of the battery to the other is a short circuit: it skips the bulb and makes the battery hot.',
    more: 'A wire has almost no resistance, so a wire across the battery lets a huge current flow: about 6 amps here, twenty times what the bulb needs. Nearly all of it goes through the wire, not the bulb.',
  },
  'loop-6': {
    title: 'Two gaps',
    goal: 'This loop is broken in more than one place. Fix every gap to light the bulb.',
    why: 'Fixing one gap isn’t enough. Electricity has to get all the way round, so every gap in the loop must be closed.',
    more: 'With even one gap, the circuit is still open and the current is zero. Electricians check a broken circuit one piece at a time, because there may be more than one fault.',
  },
  'strips-1': {
    title: 'Hidden wires',
    goal: 'This is a breadboard. Holes in the same column are joined underneath. Light the bulb.',
    why: 'Metal strips inside the breadboard join each column of holes, so parts in the same column are connected without any wires.',
    more: 'Under each column is a springy metal clip that grips the legs pushed into it. Engineers try out circuits on breadboards before soldering the finished one together.',
  },
  'strips-2': {
    title: 'Sneaky strip',
    goal: 'This bulb won’t light. Work out why, then fix it.',
    why: 'Both legs of the bulb were in the same column, so the strip joined them both to the same end of the battery. A bulb only lights when its legs join different ends of the loop.',
    more: 'With both legs on one strip, there is no voltage across the bulb: both legs get the same push. With no difference in push, no current flows through it. We say the bulb is shorted out.',
  },
  'strips-3': {
    title: 'One column out',
    goal: 'One wire is in the wrong column. Find it and move it so the bulb lights.',
    why: 'The wire’s end was one column away from the bulb’s leg. Different columns aren’t joined, so the loop had a gap.',
    more: 'On a breadboard, being one hole out is as bad as a missing wire. When a breadboard circuit doesn’t work, the first thing to check is that every leg is in the column you meant.',
  },
  'switch-1': {
    title: 'Flick the switch',
    goal: 'Add a switch so you can turn the bulb on and off. Tap the switch to flick it.',
    why: 'A switch makes a gap in the loop when it is off. No complete loop, no electricity, no light.',
    more: 'Inside a switch, two pieces of metal touch when it is on, so it has almost no resistance. When it is off they spring apart, leaving an air gap that stops the current.',
  },
  'switch-2': {
    title: 'All together',
    goal: 'Make one switch turn two bulbs on and off.',
    why: 'When everything is in one loop, one gap stops it all. That’s how one switch can control lots of lights.',
    more: 'The switch and both bulbs are in series, so the same current flows through each of them. Open the switch and the current is zero everywhere in the loop.',
  },
  'switch-3': {
    title: 'Out of the loop',
    goal: 'The switch doesn’t do anything yet. Put it in the loop so it turns the bulb on and off.',
    why: 'A switch only works when the electricity has to go through it. Off to the side, it can’t make a gap in the loop.',
    more: 'A switch must be in series with what it controls: the current has to flow through the switch as well as the bulb. A switch outside the loop has no current through it, so opening it changes nothing.',
  },
  'button-1': {
    title: 'Press to glow',
    goal: 'Use a button so the bulb only glows while you hold it down.',
    why: 'A button closes the gap only while you press it. Doorbells and keyboards work like this.',
    more: 'A button is a momentary switch: a spring holds it open until you press it. A switch that stays where you leave it, like a light switch, is called a latching switch.',
  },
  'switch-4': {
    title: 'Both switches',
    goal: 'Use two switches so the bulb only glows when both of them are on.',
    why: 'With the switches one after the other, turning either one off makes a gap. The bulb needs this switch and that one.',
    more: 'Switches in series make an AND: current flows only if every switch is on. Some big machines have two buttons, one for each hand, wired like this so they only start with both hands safely out of the way.',
  },
};
