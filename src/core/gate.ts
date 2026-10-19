/**
 * The grown-ups' gate in front of teacher settings (docs/design.md §2): a sum of two two-digit
 * numbers, typed in. It stops a child tapping into the settings by accident, and makes changing
 * them a deliberate act. An older child can work it out, so it is a speed bump, not security; the
 * settings it guards only open more of the game, so nothing worse can come of passing it.
 */
export interface GateQuestion {
  readonly a: number;
  readonly b: number;
}

/** A new question, from `random` (0 inclusive to 1 exclusive), with both numbers from 21 to 49. */
export function gateQuestion(random: () => number = Math.random): GateQuestion {
  const pick = () => 21 + Math.floor(random() * 29);
  return { a: pick(), b: pick() };
}

/** Whether `answer`, as typed, is the sum: whole digits only, spaces around them allowed. */
export function passesGate(question: GateQuestion, answer: string): boolean {
  const trimmed = answer.trim();
  return /^\d+$/.test(trimmed) && Number(trimmed) === question.a + question.b;
}
