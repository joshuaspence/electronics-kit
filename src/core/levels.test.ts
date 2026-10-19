import { describe, expect, it } from 'vitest';
import type { Circuit, Part, PartKind, Pins } from './circuit';
import {
  checkGoal,
  type Level,
  litNow,
  METER_CHAPTER,
  meterUnlocked,
  sandboxTray,
  starsFor,
} from './levels';

const battery: Part = {
  id: 'battery',
  kind: 'battery',
  pins: ['+', '-'],
  volts: 3,
  internalOhms: 0.5,
};
const bulb = (id: string, pins: Pins): Part => ({
  id,
  kind: 'bulb',
  pins,
  ohms: 10,
  ratedWatts: 0.5,
});
const wire = (id: string, pins: Pins): Part => ({ id, kind: 'wire', pins });
const circuit = (...parts: Part[]): Circuit => ({ parts: [battery, ...parts] });

describe('checkGoal: light-up', () => {
  const goal = { kind: 'light-up', lights: 1 } as const;

  it('is met by any complete loop through a bulb', () => {
    expect(checkGoal(goal, circuit(bulb('b', ['+', '-'])))).toEqual({ met: true });
    expect(
      checkGoal(
        goal,
        circuit(wire('w1', ['+', 'x']), bulb('b', ['x', 'y']), wire('w2', ['y', '-'])),
      ),
    ).toEqual({ met: true });
  });

  it('is not met by a broken loop', () => {
    expect(checkGoal(goal, circuit(bulb('b', ['+', 'x'])))).toEqual({
      met: false,
      reason: 'too-few-lit',
    });
  });

  it('is not met while the battery is shorted, even with a lit bulb', () => {
    expect(checkGoal(goal, circuit(bulb('b', ['+', '-']), wire('w', ['+', '-'])))).toEqual({
      met: false,
      reason: 'short-circuit',
    });
  });

  it('counts only bulbs bright enough to be lit, and says a faint glow is too dim', () => {
    // Four bulbs in series share 3 V: each gets well under a quarter of its rated power. The loop
    // is complete, so the reason is that they're dim, not that it's broken.
    const chain = circuit(
      bulb('a', ['+', '1']),
      bulb('b', ['1', '2']),
      bulb('c', ['2', '3']),
      bulb('d', ['3', '-']),
    );
    expect(checkGoal({ kind: 'light-up', lights: 1 }, chain)).toEqual({
      met: false,
      reason: 'too-dim',
    });
  });

  it('needs the requested number of bulbs', () => {
    const two = circuit(bulb('a', ['+', '-']), bulb('b', ['+', '-']));
    expect(checkGoal({ kind: 'light-up', lights: 2 }, two)).toEqual({ met: true });
    expect(checkGoal({ kind: 'light-up', lights: 2 }, circuit(bulb('a', ['+', '-'])))).toEqual({
      met: false,
      reason: 'too-few-lit',
    });
  });

  it('closes switches before checking', () => {
    const open = circuit(
      { id: 's', kind: 'switch', pins: ['+', 'x'], closed: false },
      bulb('b', ['x', '-']),
    );
    expect(checkGoal(goal, open)).toEqual({ met: true });
  });
});

describe('checkGoal: control-lights', () => {
  const goal = { kind: 'control-lights', lights: 1 } as const;

  it('is met when a switch in the loop turns the bulb on and off', () => {
    const c = circuit(
      { id: 's', kind: 'switch', pins: ['+', 'x'], closed: false },
      bulb('b', ['x', '-']),
    );
    expect(checkGoal(goal, c)).toEqual({ met: true });
  });

  it('is met with a push button', () => {
    const c = circuit(
      { id: 'p', kind: 'button', pins: ['+', 'x'], pressed: false },
      bulb('b', ['x', '-']),
    );
    expect(checkGoal(goal, c)).toEqual({ met: true });
  });

  it('is not met without a switch or button', () => {
    expect(checkGoal(goal, circuit(bulb('b', ['+', '-'])))).toEqual({
      met: false,
      reason: 'no-control',
    });
  });

  it('is not met when the switch is not in the loop', () => {
    const c = circuit(
      { id: 's', kind: 'switch', pins: ['x', 'y'], closed: false },
      bulb('b', ['+', '-']),
    );
    expect(checkGoal(goal, c)).toEqual({ met: false, reason: 'not-controlled' });
  });

  it('is not met when closing the switch shorts the battery', () => {
    const c = circuit(bulb('b', ['+', '-']), {
      id: 's',
      kind: 'switch',
      pins: ['+', '-'],
      closed: false,
    });
    expect(checkGoal(goal, c)).toEqual({ met: false, reason: 'short-circuit' });
  });
});

describe('checkGoal: every-control', () => {
  const goal = { kind: 'every-control', lights: 1 } as const;
  const button = (id: string, pins: Pins): Part => ({ id, kind: 'button', pins, pressed: false });

  it('is met when the bulb needs both buttons in a row', () => {
    const c = circuit(button('p', ['+', 'x']), button('q', ['x', 'y']), bulb('b', ['y', '-']));
    expect(checkGoal(goal, c)).toEqual({ met: true });
  });

  it('is not met when either button alone lights the bulb', () => {
    const c = circuit(button('p', ['+', 'x']), button('q', ['+', 'x']), bulb('b', ['x', '-']));
    expect(checkGoal(goal, c)).toEqual({ met: false, reason: 'not-every-control' });
    // The same circuit does control the bulb, which is all control-bulbs asks.
    expect(checkGoal({ kind: 'control-lights', lights: 1 }, c)).toEqual({ met: true });
  });

  it('is not met when one of the buttons is outside the loop', () => {
    const c = circuit(button('p', ['+', 'x']), button('q', ['y', 'z']), bulb('b', ['x', '-']));
    expect(checkGoal(goal, c)).toEqual({ met: false, reason: 'not-every-control' });
  });

  it('still needs the bulbs dark with everything off', () => {
    const c = circuit(button('p', ['y', 'z']), bulb('b', ['+', '-']));
    expect(checkGoal(goal, c)).toEqual({ met: false, reason: 'not-controlled' });
  });
});

describe('checkGoal: bright lights', () => {
  const goal = { kind: 'light-up', lights: 2, bright: true } as const;

  it('is met by two bulbs side by side, each with the whole battery across it', () => {
    expect(checkGoal(goal, circuit(bulb('a', ['+', '-']), bulb('b', ['+', '-'])))).toEqual({
      met: true,
    });
  });

  it('says two bulbs in a row are too dim, though they count as lit', () => {
    const inARow = circuit(bulb('a', ['+', 'x']), bulb('b', ['x', '-']));
    expect(checkGoal(goal, inARow)).toEqual({ met: false, reason: 'too-dim' });
    expect(checkGoal({ kind: 'light-up', lights: 2 }, inARow)).toEqual({ met: true });
  });
});

describe('checkGoal: LEDs', () => {
  const goal = { kind: 'light-up', lights: 1 } as const;
  const led = (id: string, pins: Pins, blown = false): Part => ({
    id,
    kind: 'led',
    pins,
    forwardVolts: 2,
    ohms: 10,
    ratedAmps: 0.02,
    blown,
  });
  const resistor = (id: string, pins: Pins): Part => ({ id, kind: 'resistor', pins, ohms: 100 });

  it('counts a lit LED as a light', () => {
    const c = circuit(led('led', ['+', 'x']), resistor('r', ['x', '-']));
    expect(checkGoal(goal, c)).toEqual({ met: true });
    expect(litNow(c)).toBe(1);
  });

  it('says when an LED is dark because it is the wrong way round', () => {
    const c = circuit(led('led', ['x', '+']), resistor('r', ['x', '-']));
    expect(checkGoal(goal, c)).toEqual({ met: false, reason: 'led-backwards' });
  });

  it('says when an LED is dark because it has popped', () => {
    const c = circuit(led('led', ['+', '-'], true));
    expect(checkGoal(goal, c)).toEqual({ met: false, reason: 'led-blown' });
  });

  it('gives the usual reason for an LED that is dark only because the loop is broken', () => {
    const c = circuit(led('led', ['+', 'x']), resistor('r', ['x', 'y']));
    expect(checkGoal(goal, c)).toEqual({ met: false, reason: 'too-few-lit' });
  });

  it('does not count an LED that switching on would pop, and says it needs a resistor', () => {
    // The switch is open, so the LED hasn't popped yet; switched on, it would.
    const c = circuit(
      { id: 's', kind: 'switch', pins: ['+', 'x'], closed: false },
      led('led', ['x', '-']),
    );
    expect(checkGoal({ kind: 'control-lights', lights: 1 }, c)).toEqual({
      met: false,
      reason: 'led-overdriven',
    });
  });

  it('asks for a resistor before turning round a backwards LED that turned round would pop', () => {
    const c = circuit(led('led', ['-', '+']));
    expect(checkGoal(goal, c)).toEqual({ met: false, reason: 'led-overdriven' });
  });
});

describe('meterUnlocked', () => {
  const level = (id: string, chapter: number): Level => ({
    id,
    chapter,
    board: { kind: 'snap', rows: 2, columns: 2 },
    parts: [],
    goal: { kind: 'light-up', lights: 1 },
    tray: [],
    par: 0,
    solution: { place: [] },
  });
  const levels = [level('early', METER_CHAPTER - 1), level('meter', METER_CHAPTER)];

  it('unlocks once a level of the meter chapter or later is finished, and not before', () => {
    expect(meterUnlocked(levels, {})).toBe(false);
    expect(meterUnlocked(levels, { early: 3 })).toBe(false);
    expect(meterUnlocked(levels, { meter: 1 })).toBe(true);
  });
});

describe('sandboxTray', () => {
  const level = (id: string, kinds: readonly PartKind[]): Level => ({
    id,
    chapter: 1,
    board: { kind: 'snap', rows: 2, columns: 2 },
    parts: [],
    goal: { kind: 'light-up', lights: 1 },
    tray: kinds.map((kind) => ({ kind, count: 1 })),
    par: 0,
    solution: { place: [] },
  });
  const levels = [level('loop', ['bulb', 'wire']), level('leds', ['led', 'resistor', 'wire'])];
  const kinds = (stars: Record<string, number>) =>
    sandboxTray(levels, stars).map((allowance) => allowance.kind);

  it('starts with bulbs and wires', () => {
    expect(kinds({})).toEqual(['bulb', 'wire']);
  });

  it('grows with the parts of each level finished, wires last', () => {
    expect(kinds({ leds: 1 })).toEqual(['bulb', 'led', 'resistor', 'wire']);
  });

  it('offers plenty of each', () => {
    expect(sandboxTray(levels, {}).every((allowance) => allowance.count >= 8)).toBe(true);
  });
});

describe('starsFor', () => {
  const level: Level = {
    id: 'loop-1',
    chapter: 1,
    board: { kind: 'snap', rows: 2, columns: 2 },
    parts: [],
    goal: { kind: 'light-up', lights: 1 },
    tray: [{ kind: 'wire', count: 4 }],
    par: 2,
    solution: { place: [] },
  };

  it('gives three stars at par with no hints', () => {
    expect(starsFor(level, 2, 0)).toBe(3);
    expect(starsFor(level, 1, 0)).toBe(3);
  });

  it('takes a star each for extra parts and for hints', () => {
    expect(starsFor(level, 3, 0)).toBe(2);
    expect(starsFor(level, 2, 1)).toBe(2);
    expect(starsFor(level, 4, 3)).toBe(1);
  });
});

describe('litNow', () => {
  it('counts bulbs lit with switches as they are', () => {
    const c = (closed: boolean) =>
      circuit({ id: 's', kind: 'switch', pins: ['+', 'x'], closed }, bulb('b', ['x', '-']));
    expect(litNow(c(false))).toBe(0);
    expect(litNow(c(true))).toBe(1);
  });

  it('counts nothing while the battery is shorted', () => {
    expect(litNow(circuit(bulb('b', ['+', '-']), wire('w', ['+', '-'])))).toBe(0);
  });
});
