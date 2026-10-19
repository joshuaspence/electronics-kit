import { describe, expect, it } from 'vitest';
import { CAPACITOR_SERIES_OHMS, type Circuit, type Part } from './circuit';
import { solveDc } from './dc';
import { inputsBetween, TIME_STEP_SECONDS, TransientSimulation } from './transient';

// 3 V through 1 kΩ into 1000 µF: a time constant of about one second.
const VOLTS = 3;
const INTERNAL_OHMS = 0.5;
const OHMS = 1000;
const FARADS = 0.001;
const TAU = (OHMS + INTERNAL_OHMS + CAPACITOR_SERIES_OHMS) * FARADS;

const rc = (closed = true): Circuit => ({
  parts: [
    { id: 'battery', kind: 'battery', pins: ['+', '-'], volts: VOLTS, internalOhms: INTERNAL_OHMS },
    { id: 'switch', kind: 'switch', pins: ['+', 's'], closed },
    { id: 'r', kind: 'resistor', pins: ['s', 'c'], ohms: OHMS },
    { id: 'cap', kind: 'capacitor', pins: ['c', '-'], farads: FARADS },
  ],
});

const stepsFor = (seconds: number) => Math.round(seconds / TIME_STEP_SECONDS);

describe('TransientSimulation', () => {
  it('starts with capacitors discharged, conducting the inrush current', () => {
    const sim = new TransientSimulation(rc());
    expect(sim.time).toBe(0);
    expect(sim.capacitorVoltage('cap')).toBe(0);
    expect(sim.solution.parts.get('r')!.current).toBeCloseTo(
      VOLTS / (OHMS + INTERNAL_OHMS + CAPACITOR_SERIES_OHMS),
      6,
    );
  });

  it('charges a capacitor along the RC curve', () => {
    const sim = new TransientSimulation(rc());
    sim.run(stepsFor(TAU));
    expect(sim.time).toBeCloseTo(TAU, 2);
    // Backward Euler at 1 ms is within a fraction of a percent of 1 − e^−1.
    expect(sim.capacitorVoltage('cap')).toBeCloseTo(VOLTS * (1 - Math.exp(-1)), 2);
    sim.run(stepsFor(10 * TAU));
    expect(sim.capacitorVoltage('cap')).toBeCloseTo(VOLTS, 3);
    expect(Math.abs(sim.solution.parts.get('r')!.current)).toBeLessThan(1e-6);
  });

  it('keeps the charge when a switch is opened, unlike an edit', () => {
    const sim = new TransientSimulation(rc());
    sim.run(stepsFor(3 * TAU));
    const charged = sim.capacitorVoltage('cap');
    expect(charged).toBeGreaterThan(2.8);

    sim.applyInput({ kind: 'switch', partId: 'switch', closed: false });
    sim.run(stepsFor(TAU));
    // Nothing can discharge it but the tiny leak to ground, so it holds its charge.
    expect(sim.capacitorVoltage('cap')).toBeCloseTo(charged, 3);
    expect(sim.time).toBeCloseTo(4 * TAU, 2);

    // An edit is a new simulation: discharged again.
    expect(new TransientSimulation(sim.circuit).capacitorVoltage('cap')).toBe(0);
  });

  it('charges only while a button is held', () => {
    const circuit: Circuit = {
      parts: rc().parts.map((part): Part =>
        part.kind === 'switch'
          ? { id: 'button', kind: 'button', pins: part.pins, pressed: false }
          : part,
      ),
    };
    const sim = new TransientSimulation(circuit);
    sim.run(stepsFor(TAU));
    expect(Math.abs(sim.capacitorVoltage('cap'))).toBeLessThan(1e-3);

    sim.applyInput({ kind: 'button', partId: 'button', pressed: true });
    sim.run(stepsFor(TAU));
    expect(sim.capacitorVoltage('cap')).toBeCloseTo(VOLTS * (1 - Math.exp(-1)), 2);
  });

  it('changes the light on a light sensor while it runs', () => {
    const sensor: Part = {
      id: 'sensor',
      kind: 'light-sensor',
      pins: ['+', 'x'],
      brightOhms: 5,
      darkOhms: 10_000,
      light: 1,
    };
    const bulb: Part = { id: 'bulb', kind: 'bulb', pins: ['x', '-'], ohms: 10, ratedWatts: 0.5 };
    const sim = new TransientSimulation({ parts: [rc().parts[0]!, sensor, bulb] });
    expect(sim.solution.parts.get('bulb')!.current).toBeCloseTo(3 / 15.5, 5);

    sim.applyInput({ kind: 'light-sensor', partId: 'sensor', light: 0 });
    expect(sim.run(1).parts.get('bulb')!.current).toBeCloseTo(3 / 10_010.5, 7);
    expect(() => sim.applyInput({ kind: 'switch', partId: 'sensor', closed: true })).toThrow(
      RangeError,
    );
  });

  it('discharges a capacitor through a bulb', () => {
    const circuit: Circuit = {
      parts: [
        ...rc().parts,
        { id: 'bulb', kind: 'bulb', pins: ['c', '-'], ohms: 10, ratedWatts: 0.5 },
      ],
    };
    const sim = new TransientSimulation(circuit);
    sim.run(stepsFor(1));
    // The bulb divides the voltage, so the capacitor charges only to the bulb's share.
    const share = (VOLTS * 10) / (10 + OHMS + INTERNAL_OHMS);
    expect(sim.capacitorVoltage('cap')).toBeCloseTo(share, 3);

    sim.applyInput({ kind: 'switch', partId: 'switch', closed: false });
    sim.run(stepsFor(0.1));
    // τ = 10 Ω × 1000 µF = 10 ms, so after 100 ms it is all but empty.
    expect(sim.capacitorVoltage('cap')).toBeLessThan(share * 0.001);
  });

  it('gives the DC operating point for a circuit without capacitors', () => {
    const circuit: Circuit = {
      parts: [
        { id: 'battery', kind: 'battery', pins: ['+', '-'], volts: 3, internalOhms: 0.5 },
        { id: 'bulb', kind: 'bulb', pins: ['+', '-'], ohms: 10, ratedWatts: 0.5 },
      ],
    };
    const dc = solveDc(circuit).parts.get('bulb')!.current;
    const sim = new TransientSimulation(circuit);
    expect(sim.solution.parts.get('bulb')!.current).toBeCloseTo(dc, 12);
    expect(sim.run(50).parts.get('bulb')!.current).toBeCloseTo(dc, 12);
  });

  it('is deterministic', () => {
    const run = () => {
      const sim = new TransientSimulation(rc());
      sim.run(250);
      sim.applyInput({ kind: 'switch', partId: 'switch', closed: false });
      sim.run(250);
      return [sim.stepCount, sim.capacitorVoltage('cap')];
    };
    expect(run()).toEqual(run());
    expect(run()[0]).toBe(500);
  });

  it('turns an LED on once the capacitor beside it charges past its forward voltage', () => {
    const led: Part = {
      id: 'led',
      kind: 'led',
      pins: ['c', '-'],
      forwardVolts: 2,
      ohms: 10,
      ratedAmps: 0.02,
      blown: false,
    };
    const sim = new TransientSimulation({ parts: [...rc().parts, led] });
    expect(sim.solution.parts.get('led')!.current).toBeCloseTo(0, 9);
    sim.run(stepsFor(10 * TAU));
    // The LED now takes all the current and holds the capacitor just above 2 V.
    const amps = (VOLTS - 2) / (OHMS + INTERNAL_OHMS + 10);
    expect(sim.solution.parts.get('led')!.current).toBeCloseTo(amps, 5);
    expect(sim.capacitorVoltage('cap')).toBeCloseTo(2 + 10 * amps, 3);
  });

  it('rejects inputs to missing or mismatched parts', () => {
    const sim = new TransientSimulation(rc());
    expect(() => sim.applyInput({ kind: 'switch', partId: 'nope', closed: true })).toThrow(
      /No part/,
    );
    expect(() => sim.applyInput({ kind: 'button', partId: 'switch', pressed: true })).toThrow(
      /is a switch, not a button/,
    );
    expect(() => sim.capacitorVoltage('r')).toThrow(/No capacitor/);
  });

  it('runs 1,000 steps of a 50-point circuit well within budget', () => {
    // A ladder: a battery feeding 49 rungs, each a bulb and a capacitor, joined by resistors; about
    // the largest sandbox circuit expected (docs/design.md §9).
    const parts: Part[] = [
      { id: 'battery', kind: 'battery', pins: ['p0', 'gnd'], volts: 3, internalOhms: 0.5 },
    ];
    for (let i = 1; i < 50; i++) {
      parts.push({ id: `r${i}`, kind: 'resistor', pins: [`p${i - 1}`, `p${i}`], ohms: 10 });
      parts.push({ id: `b${i}`, kind: 'bulb', pins: [`p${i}`, 'gnd'], ohms: 100, ratedWatts: 0.5 });
      parts.push({ id: `c${i}`, kind: 'capacitor', pins: [`p${i}`, 'gnd'], farads: 1e-4 });
    }
    const sim = new TransientSimulation({ parts });
    const start = Date.now();
    sim.run(1000);
    const elapsedMs = Date.now() - start;
    // Generous for slow CI runners; locally this takes a fraction of it.
    expect(elapsedMs).toBeLessThan(5000);
  });
});

describe('applyInput', () => {
  it('re-solves at once, with the capacitors still charged', () => {
    const sim = new TransientSimulation(rc());
    sim.run(stepsFor(5 * TAU));
    const volts = sim.capacitorVoltage('cap');
    sim.applyInput({ kind: 'switch', partId: 'switch', closed: false });
    // Cut off from the battery, nothing flows through the resistor, and the charge stays put.
    expect(sim.solution.parts.get('r')!.current).toBeCloseTo(0, 6);
    expect(sim.solution.parts.get('cap')!.voltage).toBeCloseTo(volts, 6);
  });
});

describe('inputsBetween', () => {
  const sensor: Part = {
    id: 'sensor',
    kind: 'light-sensor',
    pins: ['+', 's'],
    brightOhms: 5,
    darkOhms: 10_000,
    light: 0.5,
  };
  const with_ = (change: (part: Part) => Part): Circuit => ({ parts: rc().parts.map(change) });

  it('finds the switches, buttons and light sensors that changed', () => {
    const before: Circuit = { parts: [...rc().parts, sensor] };
    const after: Circuit = {
      parts: [...rc(false).parts, { ...sensor, light: 1 } as Part],
    };
    expect(inputsBetween(before, after)).toEqual([
      { kind: 'switch', partId: 'switch', closed: false },
      { kind: 'light-sensor', partId: 'sensor', light: 1 },
    ]);
    expect(inputsBetween(before, { parts: [...rc().parts, sensor] })).toEqual([]);
  });

  it('calls anything else an edit', () => {
    const moved = with_((part) => (part.id === 'r' ? { ...part, pins: ['s', 'x'] } : part));
    expect(inputsBetween(rc(), moved)).toBeNull();
    const resized = with_((part) => (part.id === 'r' ? { ...part, ohms: 10 } : part));
    expect(inputsBetween(rc(), resized)).toBeNull();
    expect(inputsBetween(rc(), { parts: rc().parts.slice(1) })).toBeNull();
  });
});

describe('blinker chips', () => {
  const blinky: Circuit = {
    parts: [
      rc().parts[0]!,
      { id: 'chip', kind: 'blinker', pins: ['+', 'x'], periodSeconds: 1 },
      { id: 'bulb', kind: 'bulb', pins: ['x', '-'], ohms: 10, ratedWatts: 0.5 },
    ],
  };
  const amps = (sim: TransientSimulation) => sim.solution.parts.get('bulb')!.current;

  it('conducts for the first half of each period and not the second', () => {
    expect(solveDc(blinky).parts.get('bulb')!.current).toBeGreaterThan(0.2);
    const sim = new TransientSimulation(blinky);
    expect(amps(sim)).toBeGreaterThan(0.2);
    sim.run(stepsFor(0.25));
    expect(amps(sim)).toBeGreaterThan(0.2);
    sim.run(stepsFor(0.5));
    expect(amps(sim)).toBeLessThan(1e-6);
    sim.run(stepsFor(0.5));
    expect(amps(sim)).toBeGreaterThan(0.2);
  });
});
