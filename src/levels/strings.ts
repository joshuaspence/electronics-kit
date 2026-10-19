// Player-facing level text, in Australian English (docs/design.md §6).

import type { Hint } from '../core/hints';

export type NudgeReason = Extract<Hint, { kind: 'nudge' }>['reason'];

export interface LevelText {
  readonly title: string;
  readonly goal: string;
  /** The "Why?" card after the level. */
  readonly why: string;
  /** "Tell me more" on the "Why?" card: the same idea in real terms, for older children. */
  readonly more: string;
  /** Volty's nudges for this level, where the usual ones talk about a bulb it hasn't got. */
  readonly hints?: Partial<Record<NudgeReason, string>>;
}

export const chapterTitles: Readonly<Record<number, string>> = {
  1: 'Make a loop',
  2: 'On and off',
  3: 'Bright and dim',
  4: 'One way only',
  5: 'Slow it down',
  6: 'Shortcuts',
  7: 'Gadgets',
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
  'pair-1': {
    title: 'Side by side',
    goal: 'This board has power rails along the top: + and −. Make two bulbs glow brightly.',
    why: 'Side by side, each bulb has its own path from + to −, so each one gets the battery’s whole push and glows brightly.',
    more: 'Bulbs side by side are in parallel. Each has the full 3 volts across it, so each takes as much current as it would alone, and the battery supplies both: twice the current in total.',
  },
  'pair-2': {
    title: 'Three’s a crowd',
    goal: 'Light all three bulbs at once.',
    why: 'In a row, three bulbs share the battery’s push three ways, too little for any of them to glow. Side by side, each gets it all.',
    more: 'In series, the 3 volts are split between the bulbs, about 1 volt each, and the current falls to a third. Power goes with voltage times current, so each bulb gets about a ninth of its full power.',
  },
  'pair-3': {
    title: 'Brighter together',
    goal: 'These two bulbs are glowing, but only dimly. Rewire them so both glow brightly.',
    why: 'One after the other, the bulbs shared the push and were dim. Side by side, each has its own path and glows brightly.',
    more: 'This is why the lights in a house are wired in parallel. Every light gets the full voltage, and turning one off or taking one out leaves the others glowing.',
  },
  'led-1': {
    title: 'Long leg, short leg',
    goal: 'This is an LED. Its long leg, marked +, must face the battery’s + side. Make it glow.',
    why: 'An LED only lets electricity through one way: in at its long leg and out at its short leg.',
    more: 'LED stands for light-emitting diode. A diode is a one-way valve for current. The long leg is the anode (+) and the short leg, by the flat edge, is the cathode (−).',
  },
  'led-2': {
    title: 'Wrong way round',
    goal: 'This LED won’t glow. Work out why, then fix it. Tap it, then keep pressing Rotate until it’s turned round.',
    why: 'The LED was in backwards, so it blocked the electricity. Turned round, it lets it through.',
    more: 'Backwards, an LED is reverse-biased: the battery pushes against the way it conducts, so almost no current flows. That’s why a backwards LED stays dark rather than breaking.',
  },
  'led-3': {
    title: 'Bulbs don’t mind',
    goal: 'Make the bulb and the LED both glow.',
    why: 'A bulb works whichever way round it goes, but an LED only works one way. Only the LED needed turning round.',
    more: 'A bulb is just a thin wire that gets hot, and current can flow through a wire either way. An LED is made of two different materials joined together, and current only crosses the join in one direction.',
  },
  'res-1': {
    title: 'Save the LED',
    goal: 'Light the LED without popping it. Use the resistor to slow the electricity down.',
    why: 'Straight from the battery, too much electricity rushes through an LED and it pops. A resistor slows it down to just the right amount.',
    more: 'An LED has very little resistance of its own once it is on, so on its own it would let about 95 milliamps through, and it can only take 30. The resistor’s 100 ohms brings that down to about 9 milliamps.',
  },
  'res-2': {
    title: 'One each',
    goal: 'Light both LEDs. Each one needs its own resistor.',
    why: 'Each LED has its own path from + to −, and each path needs a resistor to keep its LED safe.',
    more: 'If two LEDs side by side shared one resistor, they would share its current too, and each would get only half: too little to glow brightly. That’s why every LED in a circuit usually gets a resistor of its own.',
  },
  'res-3': {
    title: 'Too little',
    goal: 'This resistor is too small to save the LED. Swap it for the one in the bin, then light the LED.',
    why: 'The small resistor didn’t slow the electricity enough, so the LED would pop. A bigger resistor slows it more.',
    more: 'A resistor’s colour bands give its value. The first two bands are digits and the third says how many zeros follow: brown-black-black is 10 ohms, and brown-black-brown is 100 ohms.',
  },
  'short-1': {
    title: 'Rail to rail',
    goal: 'The battery is getting hot. Find the shortcut, take it away, then light the bulb.',
    why: 'The wire went straight from + to −, with nothing in the way. Electricity rushed through it instead of going anywhere useful, and the battery got hot.',
    more: 'A wire across a battery is a short circuit. The wire has almost no resistance, so the only thing holding back the current is the battery’s own tiny resistance, and the current is huge. A real battery can get hot enough to burn you, so never join its ends with a wire.',
  },
  'short-2': {
    title: 'The way round',
    goal: 'The bulb is in the loop, but it won’t light and the battery is hot. Fix it.',
    why: 'The wire joined both of the bulb’s columns, so the electricity took the easy way round the bulb instead of going through it.',
    more: 'The wire was in parallel with the bulb. Current shares itself between paths side by side, and almost all of it takes the one with least resistance: the wire. With nothing else in its way, that path is a short circuit.',
  },
  'short-3': {
    title: 'Switch it safely',
    goal: 'Switching this switch on makes a shortcut. Move it so it turns the bulb on and off safely.',
    why: 'Beside the bulb, the switch made a way round it when it was on. In the bulb’s path, it makes a gap when it is off instead.',
    more: 'A switch has almost no resistance when it is on, just like a wire. In parallel with the bulb it shorts the battery; in series with the bulb it controls it. Electricians always put a light switch in series with the light.',
  },
  'out-1': {
    title: 'Ding dong',
    goal: 'This is a buzzer. Make a doorbell: the buzzer sounds only while you hold the button down.',
    why: 'A buzzer needs a complete loop, just like a bulb. The button closes the loop while you press it, so the buzzer sounds until you let go.',
    more: 'Inside the buzzer, a thin metal disc is pulled back and forth thousands of times a second. That shakes the air, and your ears hear the shaking as sound. It needs about 2 volts to start.',
    hints: {
      'too-few-lit':
        'Electricity needs a complete loop: out of one end of the battery, through the button and the buzzer, and back into the other end.',
      'not-controlled':
        'The buzzer sounds even without the button. Put the button in the loop so it can make a gap.',
      'short-circuit':
        'Uh oh, a shortcut! Electricity is rushing straight back to the battery without going through the buzzer.',
    },
  },
  'out-2': {
    title: 'Fan it',
    goal: 'This is a motor with a fan on it. Make a switch turn the fan on and off.',
    why: 'Electricity flowing through the motor makes it turn. The switch makes a gap in the loop to stop it.',
    more: 'A motor has coils of wire and magnets inside. Current through the coils makes them magnetic, so the magnets push them round. Send the current through the other way and the motor turns the other way.',
    hints: {
      'too-few-lit':
        'Electricity needs a complete loop: out of one end of the battery, through the switch and the motor, and back into the other end.',
      'not-controlled':
        'The fan keeps turning even with the switch off. Put the switch in the loop so it can make a gap.',
      'short-circuit':
        'Uh oh, a shortcut! Electricity is rushing straight back to the battery without going through the motor.',
    },
  },
  'out-3': {
    title: 'Lights and sound',
    goal: 'Make one switch turn on the bulb and the buzzer together.',
    why: 'Side by side, the bulb and the buzzer each have their own path, so each gets the battery’s whole push. The switch is in the loop before they split, so it controls them both.',
    more: 'Current from the switch splits into two branches, one through the bulb and one through the buzzer, then joins up again. Outputs in parallel each get the full voltage, so the buzzer still has the 2 volts it needs.',
    hints: {
      'too-few-lit':
        'Both need a complete loop: from the battery, through the switch, then through the bulb and the buzzer, and back.',
      'not-controlled':
        'They stay on even with the switch off. Put the switch in the loop before the path splits, so it can make a gap for both.',
      'short-circuit':
        'Uh oh, a shortcut! Electricity is rushing straight back to the battery without going through the bulb or the buzzer.',
    },
  },
};
