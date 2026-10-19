import { describe, expect, it } from 'vitest';
import type { Battery, Bulb, Buzzer, Circuit, Led, Motor, Part, Pins } from './circuit';
import { blinkerOn, CONDUCTOR_OHMS, lightSensorOhms, validateCircuit } from './circuit';
import { newSpec } from './catalogue';
import {
  bulbBrightness,
  buzzerSounds,
  isShorted,
  LED_MAX_AMPS,
  ledBrightness,
  ledPops,
  motorSpeed,
  solveDc,
} from './dc';

const battery = (pins: Pins, volts = 3, internalOhms = 0.5): Battery => ({
  id: 'battery',
  kind: 'battery',
  pins,
  volts,
  internalOhms,
});
const bulb = (id: string, pins: Pins, ohms = 10): Bulb => ({
  id,
  kind: 'bulb',
  pins,
  ohms,
  ratedWatts: 0.5,
});
const wire = (id: string, pins: Pins): Part => ({ id, kind: 'wire', pins });

function reading(circuit: Circuit, id: string) {
  const r = solveDc(circuit).parts.get(id);
  if (!r) {
    throw new Error(`No reading for ${id}`);
  }
  return r;
}

describe('solveDc', () => {
  it('lights a bulb in a complete loop', () => {
    const circuit = { parts: [battery(['+', '-']), bulb('bulb', ['+', '-'])] };
    const amps = 3 / (10 + 0.5);
    expect(reading(circuit, 'bulb').current).toBeCloseTo(amps, 6);
    expect(reading(circuit, 'bulb').voltage).toBeCloseTo(amps * 10, 6);
    // The battery delivers current, so it flows through it from − to +.
    expect(reading(circuit, 'battery').current).toBeCloseTo(-amps, 6);
  });

  it('gives no current when the loop is not closed', () => {
    const circuit = { parts: [battery(['+', '-']), bulb('bulb', ['+', 'loose'])] };
    expect(Math.abs(reading(circuit, 'bulb').current)).toBeLessThan(1e-6);
  });

  it('dims two bulbs in series and keeps two in parallel bright', () => {
    const single = { parts: [battery(['+', '-']), bulb('a', ['+', '-'])] };
    const series = {
      parts: [battery(['+', '-']), bulb('a', ['+', 'mid']), bulb('b', ['mid', '-'])],
    };
    const parallel = { parts: [battery(['+', '-']), bulb('a', ['+', '-']), bulb('b', ['+', '-'])] };
    const power = (c: Circuit) => reading(c, 'a').power;

    expect(power(series)).toBeLessThan(power(single) / 3);
    expect(power(parallel)).toBeGreaterThan(power(single) * 0.8);
    expect(reading(series, 'a').current).toBeCloseTo(reading(series, 'b').current, 9);
  });

  it('follows a switch and a push button', () => {
    const withSwitch = (closed: boolean): Circuit => ({
      parts: [
        battery(['+', '-']),
        { id: 'switch', kind: 'switch', pins: ['+', 's'], closed },
        bulb('bulb', ['s', '-']),
      ],
    });
    const withButton = (pressed: boolean): Circuit => ({
      parts: [
        battery(['+', '-']),
        { id: 'button', kind: 'button', pins: ['+', 's'], pressed },
        bulb('bulb', ['s', '-']),
      ],
    });
    expect(Math.abs(reading(withSwitch(false), 'bulb').current)).toBeLessThan(1e-6);
    expect(reading(withSwitch(true), 'bulb').current).toBeGreaterThan(0.2);
    expect(Math.abs(reading(withButton(false), 'bulb').current)).toBeLessThan(1e-6);
    expect(reading(withButton(true), 'bulb').current).toBeGreaterThan(0.2);
  });

  it('carries the loop current through wires, shared between parallel wires', () => {
    const circuit = {
      parts: [
        battery(['+', '-']),
        wire('w1', ['+', 'a']),
        wire('w2', ['+', 'a']),
        bulb('bulb', ['a', '-']),
      ],
    };
    const bulbAmps = reading(circuit, 'bulb').current;
    expect(reading(circuit, 'w1').current).toBeCloseTo(bulbAmps / 2, 6);
    expect(reading(circuit, 'w2').current).toBeCloseTo(bulbAmps / 2, 6);
  });

  it('detects a short circuit across the battery', () => {
    const shorted = { parts: [battery(['+', '-']), wire('w', ['+', '-'])] };
    const normal = { parts: [battery(['+', '-']), bulb('bulb', ['+', '-'])] };
    const b = battery(['+', '-']);
    expect(reading(shorted, 'battery').current).toBeCloseTo(-3 / (0.5 + CONDUCTOR_OHMS), 3);
    expect(isShorted(b, reading(shorted, 'battery'))).toBe(true);
    expect(isShorted(b, reading(normal, 'battery'))).toBe(false);
  });

  it('bypasses a bulb with a wire across it', () => {
    const circuit = {
      parts: [battery(['+', '-']), bulb('bulb', ['+', '-']), wire('w', ['+', '-'])],
    };
    expect(reading(circuit, 'bulb').power).toBeLessThan(1e-3);
  });

  it('ignores a part with both pins on one point', () => {
    const circuit = { parts: [battery(['+', '-']), bulb('bulb', ['+', '+'])] };
    expect(reading(circuit, 'bulb').current).toBe(0);
  });

  it('solves separate circuits independently', () => {
    const circuit = {
      parts: [
        battery(['+', '-']),
        bulb('a', ['+', '-']),
        { ...battery(['p', 'n'], 1.5), id: 'other' },
        bulb('b', ['p', 'n']),
      ],
    };
    expect(reading(circuit, 'a').current).toBeCloseTo(3 / 10.5, 6);
    expect(reading(circuit, 'b').current).toBeCloseTo(1.5 / 10.5, 6);
  });

  it('reverses current when the battery is turned around', () => {
    const circuit = { parts: [battery(['-', '+']), bulb('bulb', ['+', '-'])] };
    expect(reading(circuit, 'bulb').current).toBeCloseTo(-3 / 10.5, 6);
  });

  it('reports bulb brightness from power, capped at full', () => {
    const dim = bulb('bulb', ['+', '-'], 100);
    const bright = bulb('bulb', ['+', '-'], 2);
    const brightness = (b: Bulb) =>
      bulbBrightness(b, reading({ parts: [battery(['+', '-']), b] }, 'bulb'));
    expect(brightness(dim)).toBeGreaterThan(0);
    expect(brightness(dim)).toBeLessThan(0.5);
    expect(brightness(bright)).toBe(1);
  });

  describe('LEDs', () => {
    const led = (id: string, pins: Pins): Led => ({
      id,
      kind: 'led',
      pins,
      forwardVolts: 2,
      ohms: 10,
      ratedAmps: 0.02,
      blown: false,
    });
    const lit = (circuit: Circuit, id: string) => {
      const part = circuit.parts.find((p) => p.id === id) as Led;
      return ledBrightness(part, reading(circuit, id));
    };

    it('conduct forwards above their forward voltage, through their series resistance', () => {
      const circuit = { parts: [battery(['+', '-']), led('led', ['+', '-'])] };
      expect(reading(circuit, 'led').current).toBeCloseTo((3 - 2) / (10 + 0.5), 6);
      expect(lit(circuit, 'led')).toBe(1);
    });

    it('stay dark the wrong way round', () => {
      const circuit = { parts: [battery(['+', '-']), led('led', ['-', '+'])] };
      expect(reading(circuit, 'led').current).toBeCloseTo(0, 6);
      expect(lit(circuit, 'led')).toBe(0);
    });

    it('stay dark below their forward voltage', () => {
      const circuit = { parts: [battery(['+', '-'], 1.5), led('led', ['+', '-'])] };
      expect(lit(circuit, 'led')).toBe(0);
    });

    it('stay dark two in a row on 3 V, which is less than their 4 V together', () => {
      const circuit = {
        parts: [battery(['+', '-']), led('a', ['+', 'x']), led('b', ['x', '-'])],
      };
      expect(lit(circuit, 'a')).toBe(0);
      expect(lit(circuit, 'b')).toBe(0);
    });

    it('light only the one facing the right way of two back to back', () => {
      const circuit = {
        parts: [battery(['+', '-']), led('forward', ['+', '-']), led('backward', ['-', '+'])],
      };
      expect(lit(circuit, 'forward')).toBe(1);
      expect(lit(circuit, 'backward')).toBe(0);
    });

    it('share the battery with a bulb beside them', () => {
      const circuit = {
        parts: [battery(['+', '-']), led('led', ['+', '-']), bulb('bulb', ['+', '-'])],
      };
      // Both lit: the battery's terminals sit at the same voltage across each.
      const volts = reading(circuit, 'led').voltage;
      expect(reading(circuit, 'bulb').voltage).toBeCloseTo(volts, 6);
      expect(reading(circuit, 'led').current).toBeCloseTo((volts - 2) / 10, 6);
      expect(lit(circuit, 'led')).toBeGreaterThan(0);
    });

    it('pop above their maximum current', () => {
      expect(ledPops({ current: LED_MAX_AMPS * 1.01, voltage: 2.3, power: 0 })).toBe(true);
      expect(ledPops({ current: LED_MAX_AMPS * 0.99, voltage: 2.3, power: 0 })).toBe(false);
    });
  });

  it('solves an empty circuit', () => {
    expect(solveDc({ parts: [] }).parts.size).toBe(0);
  });

  it('rejects invalid parts', () => {
    expect(() => solveDc({ parts: [bulb('a', ['x', 'y'], 0)] })).toThrow(/ohms must be positive/);
    expect(() => solveDc({ parts: [battery(['x', 'y'], 3, -1)] })).toThrow(/internalOhms/);
    const led: Part = {
      id: 'a',
      kind: 'led',
      pins: ['x', 'y'],
      forwardVolts: 0,
      ohms: 10,
      ratedAmps: 1,
      blown: false,
    };
    expect(() => solveDc({ parts: [led] })).toThrow(/forwardVolts/);
    expect(() => solveDc({ parts: [bulb('a', ['x', 'y']), bulb('a', ['x', 'y'])] })).toThrow(
      /Duplicate part id a/,
    );
  });
});

describe('buzzers and motors', () => {
  const buzzer = (pins: Pins): Buzzer => ({ ...(newSpec('buzzer') as Buzzer), id: 'buzzer', pins });
  const motor = (pins: Pins): Motor => ({ ...(newSpec('motor') as Motor), id: 'motor', pins });
  const resistor = (pins: Pins, ohms: number): Part => ({ id: 'r', kind: 'resistor', pins, ohms });

  it('sounds a buzzer across the battery, either way round, and in a row with a bulb', () => {
    for (const pins of [['+', '-'] as const, ['-', '+'] as const]) {
      const circuit = { parts: [battery(['+', '-']), buzzer(pins)] };
      expect(buzzerSounds(buzzer(pins), reading(circuit, 'buzzer'))).toBe(true);
    }
    const withBulb = { parts: [battery(['+', '-']), buzzer(['+', 'x']), bulb('b', ['x', '-'])] };
    expect(buzzerSounds(buzzer(['+', 'x']), reading(withBulb, 'buzzer'))).toBe(true);
  });

  it('keeps a buzzer quiet behind a 100 Ω resistor or in a broken loop', () => {
    const behind = { parts: [battery(['+', '-']), buzzer(['+', 'x']), resistor(['x', '-'], 100)] };
    expect(buzzerSounds(buzzer(['+', 'x']), reading(behind, 'buzzer'))).toBe(false);
    const broken = { parts: [battery(['+', '-']), buzzer(['+', 'x'])] };
    expect(buzzerSounds(buzzer(['+', 'x']), reading(broken, 'buzzer'))).toBe(false);
  });

  it('turns a motor at full speed across the battery, the other way when turned round', () => {
    const forwards = { parts: [battery(['+', '-']), motor(['+', '-'])] };
    expect(motorSpeed(motor(['+', '-']), reading(forwards, 'motor'))).toBe(1);
    const backwards = { parts: [battery(['+', '-']), motor(['-', '+'])] };
    expect(motorSpeed(motor(['-', '+']), reading(backwards, 'motor'))).toBe(-1);
  });

  it('turns a motor slowly in a row with a bulb, and not at all below its starting current', () => {
    const withBulb = { parts: [battery(['+', '-']), motor(['+', 'x']), bulb('b', ['x', '-'])] };
    const speed = motorSpeed(motor(['+', 'x']), reading(withBulb, 'motor'));
    expect(speed).toBeGreaterThan(0.25);
    expect(speed).toBeLessThan(0.5);
    const behind = { parts: [battery(['+', '-']), motor(['+', 'x']), resistor(['x', '-'], 100)] };
    expect(motorSpeed(motor(['+', 'x']), reading(behind, 'motor'))).toBe(0);
  });

  it('refuses a motor that starts at or above its full-speed current', () => {
    const bad: Motor = { ...motor(['+', '-']), startAmps: 0.5, ratedAmps: 0.5 };
    expect(() => validateCircuit({ parts: [battery(['+', '-']), bad] })).toThrow(RangeError);
    expect(() =>
      validateCircuit({ parts: [battery(['+', '-']), motor(['+', '-'])] }),
    ).not.toThrow();
  });
});

describe('light sensors', () => {
  const sensor = (light: number) => ({
    ...(newSpec('light-sensor') as Extract<Part, { kind: 'light-sensor' }>),
    id: 'sensor',
    pins: ['+', 'x'] as const,
    light,
  });

  it('runs from its dark resistance to its bright one, by equal factors', () => {
    expect(lightSensorOhms(sensor(0))).toBeCloseTo(10_000, 6);
    expect(lightSensorOhms(sensor(1))).toBeCloseTo(5, 6);
    expect(lightSensorOhms(sensor(0.5))).toBeCloseTo(Math.sqrt(5 * 10_000), 6);
  });

  it('lights a bulb in a row with it in full light, but not in the dark', () => {
    const lit = (light: number) =>
      bulbBrightness(
        bulb('b', ['x', '-']),
        reading({ parts: [battery(['+', '-']), sensor(light), bulb('b', ['x', '-'])] }, 'b'),
      );
    expect(lit(1)).toBeGreaterThan(0.5);
    expect(lit(0)).toBeLessThan(0.001);
  });

  it('starts at half light, where neither a bulb nor a buzzer in a row with it works', () => {
    const start = newSpec('light-sensor') as Extract<Part, { kind: 'light-sensor' }>;
    const withBulb = { parts: [battery(['+', '-']), sensor(start.light), bulb('b', ['x', '-'])] };
    expect(bulbBrightness(bulb('b', ['x', '-']), reading(withBulb, 'b'))).toBeLessThan(0.05);
    const buzzer: Buzzer = { ...(newSpec('buzzer') as Buzzer), id: 'z', pins: ['x', '-'] };
    const withBuzzer = { parts: [battery(['+', '-']), sensor(start.light), buzzer] };
    expect(buzzerSounds(buzzer, reading(withBuzzer, 'z'))).toBe(false);
  });

  it('refuses light outside 0 to 1, and a dark resistance below the bright one', () => {
    expect(() => validateCircuit({ parts: [sensor(1.5)] })).toThrow(RangeError);
    expect(() => validateCircuit({ parts: [{ ...sensor(1), darkOhms: 1 }] })).toThrow(RangeError);
    expect(() => validateCircuit({ parts: [sensor(0.5)] })).not.toThrow();
  });
});

describe('blinkerOn', () => {
  const chip = { id: 'k', kind: 'blinker', pins: ['+', '-'], periodSeconds: 1 } as const;

  it('is on for the first half of each period', () => {
    expect([0, 0.25, 0.5, 0.75, 1, 1.4, 1.6].map((t) => blinkerOn(chip, t))).toEqual([
      true,
      true,
      false,
      false,
      true,
      true,
      false,
    ]);
  });

  it('refuses a period that isn’t positive', () => {
    expect(() => validateCircuit({ parts: [{ ...chip, periodSeconds: 0 }] })).toThrow(RangeError);
  });
});
