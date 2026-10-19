import { describe, expect, it } from 'vitest';
import { gateQuestion, passesGate } from './gate';

describe('gateQuestion', () => {
  it('picks two numbers from 21 to 49', () => {
    expect(gateQuestion(() => 0)).toEqual({ a: 21, b: 21 });
    expect(gateQuestion(() => 0.9999)).toEqual({ a: 49, b: 49 });
    for (let i = 0; i < 100; i++) {
      const { a, b } = gateQuestion();
      for (const n of [a, b]) {
        expect(Number.isInteger(n) && n >= 21 && n <= 49, String(n)).toBe(true);
      }
    }
  });
});

describe('passesGate', () => {
  const question = { a: 37, b: 48 };

  it('passes the sum, with spaces around it', () => {
    expect(passesGate(question, '85')).toBe(true);
    expect(passesGate(question, ' 85 ')).toBe(true);
  });

  it('refuses a wrong answer, an empty one, and anything that isn’t whole digits', () => {
    for (const answer of ['84', '', '  ', '85.0', '8 5', '+85', '0x55', '85a']) {
      expect(passesGate(question, answer), answer).toBe(false);
    }
  });
});
