import { describe, expect, it } from 'vitest';
import {
  addProfile,
  AVATARS,
  currentProfile,
  loadPlayers,
  mergePlayers,
  NAME_LENGTH,
  NO_PLAYERS,
  savePlayers,
  setUnlockAll,
  switchProfile,
  updateProgress,
} from './profiles';
import { NO_PROGRESS, recordStars } from './progress';

describe('loadPlayers', () => {
  it('keeps every star of version 1 progress, as the first player', () => {
    const players = loadPlayers({ version: 1, stars: { 'loop-1': 3, 'loop-2': 1 } });
    expect(players.profiles).toHaveLength(1);
    expect(currentProfile(players).progress.stars).toEqual({ 'loop-1': 3, 'loop-2': 1 });
  });

  it('loads version 2 players with nothing unlocked, and keeps the teacher’s unlock in version 3', () => {
    const v2 = { version: 2, current: 'p1', profiles: [{ id: 'p1', name: 'Ana', stars: {} }] };
    expect(loadPlayers(v2).unlockAll).toBe(false);
    expect(loadPlayers({ ...v2, unlockAll: true }).unlockAll).toBe(false);
    expect(loadPlayers({ ...v2, version: 3, unlockAll: true }).unlockAll).toBe(true);
    expect(loadPlayers({ ...v2, version: 3, unlockAll: 'yes' }).unlockAll).toBe(false);
  });

  it('round-trips players through saving and JSON', () => {
    let players = updateProgress(NO_PLAYERS, (p) => recordStars(p, 'loop-1', 2));
    players = setUnlockAll(players, true);
    players = addProfile(players, 'Mia', AVATARS[3]);
    players = updateProgress(players, (p) => recordStars(p, 'loop-3', 3));
    expect(loadPlayers(JSON.parse(JSON.stringify(savePlayers(players))))).toEqual(players);
  });

  it('loads nothing saved, corrupt data and unknown versions as one player with no progress', () => {
    for (const saved of [undefined, null, 'x', [], {}, { version: 99 }, { version: 2 }]) {
      expect(loadPlayers(saved)).toEqual(NO_PLAYERS);
    }
    expect(loadPlayers({ version: 2, profiles: [{ id: 3 }] })).toEqual(NO_PLAYERS);
  });

  it('mends what it can: a missing current player, an unknown avatar, a blank name', () => {
    const players = loadPlayers({
      version: 2,
      current: 'gone',
      profiles: [{ id: 'a', name: '  ', avatar: '🦖', stars: { x: 2 } }],
    });
    expect(players.current).toBe('a');
    expect(players.profiles[0]).toMatchObject({ name: 'Player 1', avatar: AVATARS[0] });
    expect(players.profiles[0]!.progress.stars).toEqual({ x: 2 });
  });
});

describe('profiles', () => {
  it('adds a player, who starts with no progress and is then the one playing', () => {
    const players = addProfile(
      updateProgress(NO_PLAYERS, (p) => recordStars(p, 'loop-1', 3)),
      '  Sam  ',
      AVATARS[1],
    );
    expect(currentProfile(players)).toMatchObject({ name: 'Sam', progress: NO_PROGRESS });
    expect(players.profiles[0]!.progress.stars).toEqual({ 'loop-1': 3 });
  });

  it('refuses a blank name and shortens a long one', () => {
    expect(addProfile(NO_PLAYERS, '   ', AVATARS[0])).toBe(NO_PLAYERS);
    const long = addProfile(NO_PLAYERS, 'x'.repeat(50), AVATARS[0]);
    expect(currentProfile(long).name).toHaveLength(NAME_LENGTH);
  });

  it('switches between players, each keeping their own stars', () => {
    let players = addProfile(NO_PLAYERS, 'Sam', AVATARS[1]);
    players = updateProgress(players, (p) => recordStars(p, 'loop-1', 2));
    players = switchProfile(players, NO_PLAYERS.current);
    expect(currentProfile(players).progress.stars).toEqual({});
    expect(switchProfile(players, 'nobody')).toBe(players);
  });

  it('merges progress earned before saved players loaded into whoever is playing', () => {
    const saved = addProfile(NO_PLAYERS, 'Sam', AVATARS[1]);
    const merged = mergePlayers(saved, recordStars(NO_PROGRESS, 'loop-1', 3));
    expect(currentProfile(merged).progress.stars).toEqual({ 'loop-1': 3 });
    expect(merged.profiles[0]!.progress.stars).toEqual({});
  });
});
