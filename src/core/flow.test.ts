import { describe, expect, it } from 'vitest';
import { flowSpeed } from './flow';

describe('flowSpeed', () => {
  it('shows no flow below a milliamp', () => {
    expect(flowSpeed(0)).toBe(0);
    expect(flowSpeed(1e-6)).toBe(0);
    expect(flowSpeed(-0.0009)).toBe(0);
    expect(flowSpeed(Number.NaN)).toBe(0);
  });

  it('speeds up with each tenfold increase in current', () => {
    expect(flowSpeed(0.001)).toBeCloseTo(20);
    expect(flowSpeed(0.01)).toBeCloseTo(40);
    expect(flowSpeed(0.1)).toBeCloseTo(60);
  });

  it('races for a short circuit, up to a cap', () => {
    // A kit battery shorted by a wire delivers about 6 A; a lit bulb about 0.3 A.
    expect(flowSpeed(6)).toBeGreaterThan(flowSpeed(0.3) + 25);
    expect(flowSpeed(1000)).toBe(120);
  });

  it('follows the direction of the current', () => {
    expect(flowSpeed(-0.01)).toBeCloseTo(-40);
  });
});
