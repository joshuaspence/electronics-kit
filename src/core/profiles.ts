import { loadProgress, mergeProgress, NO_PROGRESS, type Progress } from './progress';

/**
 * Local player profiles (docs/design.md §2): a name and an avatar each, no passwords, for a family
 * or classroom sharing a device. Each profile keeps its own progress.
 *
 * Saved data is versioned like progress always was. Version 1 was one child's progress; it loads
 * as a single profile with that progress, so the update keeps every star. Version 2 is the list of
 * profiles and which one is playing.
 */

export const SAVED_VERSION = 2;

/** A small set of pictures to choose from, so a child who can't spell their name yet knows theirs. */
export const AVATARS = ['🔋', '💡', '⚡', '🚀', '🐢', '🦉', '🐙', '🌈'] as const;
export type Avatar = (typeof AVATARS)[number];

/** The longest name kept, so a name fits on a button. */
export const NAME_LENGTH = 20;

export interface Profile {
  readonly id: string;
  readonly name: string;
  readonly avatar: Avatar;
  readonly progress: Progress;
}

export interface Players {
  readonly profiles: readonly Profile[];
  /** The id of the profile playing now: always one of `profiles`. */
  readonly current: string;
}

const FIRST: Profile = { id: 'p1', name: 'Player 1', avatar: AVATARS[0], progress: NO_PROGRESS };

/** One player with no progress: a first start, or saved data that can't be read. */
export const NO_PLAYERS: Players = { profiles: [FIRST], current: FIRST.id };

/** Saved data of any version this code has written, migrated forward; anything else, no players. */
export function loadPlayers(saved: unknown): Players {
  if (!isRecord(saved)) {
    return NO_PLAYERS;
  }
  if (saved['version'] === 1) {
    return { profiles: [{ ...FIRST, progress: loadProgress(saved) }], current: FIRST.id };
  }
  if (saved['version'] !== SAVED_VERSION || !Array.isArray(saved['profiles'])) {
    return NO_PLAYERS;
  }
  const profiles = saved['profiles'].flatMap((raw): Profile[] => {
    if (!isRecord(raw) || typeof raw['id'] !== 'string' || typeof raw['name'] !== 'string') {
      return [];
    }
    const avatar = AVATARS.find((a) => a === raw['avatar']) ?? AVATARS[0];
    const progress = loadProgress({ version: 1, stars: raw['stars'] });
    return [{ id: raw['id'], name: cleanName(raw['name']) || FIRST.name, avatar, progress }];
  });
  if (profiles.length === 0) {
    return NO_PLAYERS;
  }
  const current = profiles.some((p) => p.id === saved['current'])
    ? (saved['current'] as string)
    : profiles[0]!.id;
  return { profiles, current };
}

/** The players as saved data: version 2, each profile's stars beside its name and avatar. */
export function savePlayers(players: Players): unknown {
  return {
    version: SAVED_VERSION,
    current: players.current,
    profiles: players.profiles.map(({ id, name, avatar, progress }) => ({
      id,
      name,
      avatar,
      stars: progress.stars,
    })),
  };
}

export function currentProfile(players: Players): Profile {
  return players.profiles.find((p) => p.id === players.current) ?? players.profiles[0]!;
}

/** Adds a profile and makes it the one playing. A blank name is refused. */
export function addProfile(players: Players, name: string, avatar: Avatar): Players {
  const clean = cleanName(name);
  if (!clean) {
    return players;
  }
  const taken = new Set(players.profiles.map((p) => p.id));
  let n = players.profiles.length + 1;
  while (taken.has(`p${n}`)) {
    n++;
  }
  const profile: Profile = { id: `p${n}`, name: clean, avatar, progress: NO_PROGRESS };
  return { profiles: [...players.profiles, profile], current: profile.id };
}

export function switchProfile(players: Players, id: string): Players {
  return players.profiles.some((p) => p.id === id) ? { ...players, current: id } : players;
}

/** The players with the current profile's progress changed by `change`. */
export function updateProgress(
  players: Players,
  change: (progress: Progress) => Progress,
): Players {
  return {
    ...players,
    profiles: players.profiles.map((p) =>
      p.id === players.current ? { ...p, progress: change(p.progress) } : p,
    ),
  };
}

/**
 * Saved players with anything earned before they loaded: that progress was the current player's,
 * so it merges into whoever the saved data says is playing.
 */
export function mergePlayers(saved: Players, earned: Progress): Players {
  return updateProgress(saved, (progress) => mergeProgress(progress, earned));
}

function cleanName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').slice(0, NAME_LENGTH);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
