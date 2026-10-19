import type { Level } from '../core/levels';
import type { Profile } from '../core/profiles';
import type { Progress } from '../core/progress';
import { chapterTitles, levelText } from '../levels/strings';
import { strings } from './strings';
import { SmallScreenNote } from './ScreenNotes';
import { UpdatePrompt } from './UpdatePrompt';

interface LevelListProps {
  levels: readonly Level[];
  progress: Progress;
  /** Who's playing, shown so a child on a shared device can tell it's their progress. */
  profile: Profile;
  onPlay: (level: Level) => void;
  onSandbox: () => void;
  /** Null until saved players arrive, which would undo a change made before them. */
  onPlayers: (() => void) | null;
}

/**
 * Every level by chapter, with the best stars earned on each, and the sandbox. All are open from
 * the start.
 */
export function LevelList({
  levels,
  progress,
  profile,
  onPlay,
  onSandbox,
  onPlayers,
}: LevelListProps) {
  const chapters = [...new Set(levels.map((level) => level.chapter))];
  return (
    <main>
      <header className="list-header">
        <h1>{strings.title}</h1>
        <button type="button" className="primary" onClick={onSandbox}>
          {strings.sandbox}
        </button>
      </header>
      <p className="playing-as">
        <span className="avatar" aria-hidden="true">
          {profile.avatar}
        </span>
        {strings.playingAs(profile.name)}
        <button type="button" onClick={onPlayers ?? undefined} disabled={!onPlayers}>
          {strings.changePlayer}
        </button>
      </p>
      <SmallScreenNote />
      {/* Offered only between levels, never in the middle of one. */}
      <UpdatePrompt />
      {chapters.map((chapter) => (
        <section key={chapter} className="chapter">
          <h2>{strings.chapter(chapter, chapterTitles[chapter] ?? '')}</h2>
          <ol className="level-list">
            {levels
              .filter((level) => level.chapter === chapter)
              .map((level) => {
                const stars = progress.stars[level.id] ?? 0;
                return (
                  <li key={level.id}>
                    <button type="button" data-level={level.id} onClick={() => onPlay(level)}>
                      {levelText[level.id]?.title}
                      <span className="stars" aria-label={strings.starsLabel(stars)}>
                        {'★'.repeat(stars)}
                        <span className="stars-missing">{'★'.repeat(3 - stars)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
          </ol>
        </section>
      ))}
      <footer className="version">{strings.version(__APP_VERSION__, __APP_COMMIT__)}</footer>
    </main>
  );
}
