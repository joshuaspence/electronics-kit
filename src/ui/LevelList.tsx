import type { Level } from '../core/levels';
import type { Progress } from '../core/progress';
import { chapterTitles, levelText } from '../levels/strings';
import { strings } from './strings';
import { UpdatePrompt } from './UpdatePrompt';

interface LevelListProps {
  levels: readonly Level[];
  progress: Progress;
  onPlay: (level: Level) => void;
  onSandbox: () => void;
}

/**
 * Every level by chapter, with the best stars earned on each, and the sandbox. All are open from
 * the start.
 */
export function LevelList({ levels, progress, onPlay, onSandbox }: LevelListProps) {
  const chapters = [...new Set(levels.map((level) => level.chapter))];
  return (
    <main>
      <header className="list-header">
        <h1>{strings.title}</h1>
        <button type="button" className="primary" onClick={onSandbox}>
          {strings.sandbox}
        </button>
      </header>
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
