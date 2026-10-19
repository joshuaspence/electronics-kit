import { useState } from 'react';
import { type Avatar, AVATARS, NAME_LENGTH, type Players } from '../core/profiles';
import { totalStars } from '../core/progress';
import { strings } from './strings';

interface PlayersScreenProps {
  players: Players;
  onChoose: (id: string) => void;
  onAdd: (name: string, avatar: Avatar) => void;
  onBack: () => void;
}

/**
 * Who's playing: pick a player, or add one with a name and a picture. No passwords, since it's for
 * a family or classroom sharing a device (docs/design.md §2).
 */
export function PlayersScreen({ players, onChoose, onAdd, onBack }: PlayersScreenProps) {
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<Avatar>(AVATARS[1]);

  return (
    <main>
      <header className="level-header">
        <button type="button" onClick={onBack}>
          {strings.backToLevels}
        </button>
        <h1>{strings.whoIsPlaying}</h1>
      </header>
      <ul className="players">
        {players.profiles.map((profile) => (
          <li key={profile.id}>
            <button
              type="button"
              className="player"
              aria-pressed={profile.id === players.current}
              onClick={() => onChoose(profile.id)}
            >
              <span className="avatar" aria-hidden="true">
                {profile.avatar}
              </span>
              {profile.name}
              <span className="stars">{strings.starCount(totalStars(profile.progress))}</span>
            </button>
          </li>
        ))}
      </ul>
      <form
        className="new-player"
        onSubmit={(event) => {
          event.preventDefault();
          onAdd(name, avatar);
        }}
      >
        <h2>{strings.newPlayer}</h2>
        <label>
          {strings.playerName}{' '}
          <input
            value={name}
            maxLength={NAME_LENGTH}
            autoComplete="off"
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <fieldset className="avatars">
          <legend>{strings.pickAvatar}</legend>
          {AVATARS.map((choice) => (
            <button
              key={choice}
              type="button"
              className="avatar-choice"
              aria-pressed={choice === avatar}
              aria-label={strings.avatarLabel(choice)}
              onClick={() => setAvatar(choice)}
            >
              {choice}
            </button>
          ))}
        </fieldset>
        <button type="submit" className="primary" disabled={name.trim() === ''}>
          {strings.addPlayer}
        </button>
      </form>
    </main>
  );
}
