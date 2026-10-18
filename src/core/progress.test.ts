import { describe, expect, it } from 'vitest';
import { loadProgress, mergeProgress, NO_PROGRESS, recordStars, totalStars } from './progress';

describe('loadProgress', () => {
  it('round-trips saved progress through JSON', () => {
    const progress = recordStars(recordStars(NO_PROGRESS, 'loop-1', 3), 'loop-2', 2);
    expect(loadProgress(JSON.parse(JSON.stringify(progress)))).toEqual(progress);
  });

  it('loads nothing saved, corrupt data and unknown versions as no progress', () => {
    for (const saved of [
      undefined,
      null,
      'stars',
      [],
      {},
      { version: '1' },
      { version: 99, stars: {} },
    ]) {
      expect(loadProgress(saved)).toEqual(NO_PROGRESS);
    }
  });

  it('drops entries it cannot read and keeps the rest', () => {
    const saved = { version: 1, stars: { good: 2, zero: 0, four: 4, text: '3', also: 1 } };
    expect(loadProgress(saved).stars).toEqual({ good: 2, also: 1 });
    expect(loadProgress({ version: 1, stars: 'nope' }).stars).toEqual({});
  });
});

describe('recordStars', () => {
  it('keeps the best stars earned', () => {
    let progress = recordStars(NO_PROGRESS, 'loop-1', 2);
    progress = recordStars(progress, 'loop-1', 1);
    expect(progress.stars['loop-1']).toBe(2);
    progress = recordStars(progress, 'loop-1', 3);
    expect(progress.stars['loop-1']).toBe(3);
  });

  it('does not change the progress it is given', () => {
    recordStars(NO_PROGRESS, 'loop-1', 3);
    expect(NO_PROGRESS.stars).toEqual({});
  });

  it('totals stars across levels', () => {
    const progress = recordStars(recordStars(NO_PROGRESS, 'a', 3), 'b', 2);
    expect(totalStars(progress)).toBe(5);
  });
});

describe('mergeProgress', () => {
  it('keeps the best stars from both, level by level', () => {
    const saved = recordStars(recordStars(NO_PROGRESS, 'a', 3), 'b', 1);
    const earned = recordStars(recordStars(NO_PROGRESS, 'b', 2), 'c', 1);
    expect(mergeProgress(saved, earned).stars).toEqual({ a: 3, b: 2, c: 1 });
    expect(mergeProgress(earned, saved).stars).toEqual({ a: 3, b: 2, c: 1 });
  });
});
