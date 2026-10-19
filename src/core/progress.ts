/**
 * A child's progress: the best stars earned on each level. Each player profile keeps its own
 * (`profiles.ts`), and the profiles are what's saved.
 *
 * Saved data carries a schema version, migrated forward on loading, so an update never wipes
 * progress (docs/design.md §2): version 1 was this record alone. Data that can't be read (corrupt,
 * or from a newer version after a downgrade) loads as no progress rather than throwing, and is
 * never written back over until the child earns something or changes players.
 */

export const PROGRESS_VERSION = 1;

export type Stars = 1 | 2 | 3;

export interface Progress {
  readonly version: typeof PROGRESS_VERSION;
  /** Best stars per level id; a level absent here hasn't been finished. */
  readonly stars: Readonly<Record<string, Stars>>;
}

export const NO_PROGRESS: Progress = { version: PROGRESS_VERSION, stars: {} };

export function loadProgress(saved: unknown): Progress {
  if (!isRecord(saved) || typeof saved['version'] !== 'number') {
    return NO_PROGRESS;
  }
  switch (saved['version']) {
    case 1:
      return readV1(saved);
    default:
      return NO_PROGRESS;
  }
}

/** Records a finished level, keeping the best stars ever earned on it. */
export function recordStars(progress: Progress, levelId: string, stars: Stars): Progress {
  const best = progress.stars[levelId];
  if (best !== undefined && best >= stars) {
    return progress;
  }
  return { ...progress, stars: { ...progress.stars, [levelId]: stars } };
}

/** The best stars from either, level by level: for progress earned before saved progress loaded. */
export function mergeProgress(a: Progress, b: Progress): Progress {
  let merged = a;
  for (const [id, stars] of Object.entries(b.stars)) {
    merged = recordStars(merged, id, stars);
  }
  return merged;
}

export function totalStars(progress: Progress): number {
  return Object.values(progress.stars).reduce((sum, stars) => sum + stars, 0);
}

function readV1(saved: Record<string, unknown>): Progress {
  const stars: Record<string, Stars> = {};
  const raw = saved['stars'];
  if (isRecord(raw)) {
    for (const [id, value] of Object.entries(raw)) {
      if (value === 1 || value === 2 || value === 3) {
        stars[id] = value;
      }
    }
  }
  return { version: 1, stars };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
