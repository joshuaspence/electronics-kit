import { useRegisterSW } from 'virtual:pwa-register/react';
import { strings } from './strings';

/**
 * Registers the service worker that keeps the game working offline, and offers a new version when
 * one has downloaded. It never reloads by itself, so a child is never thrown out of a level.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) {
    return null;
  }
  return (
    <div className="update" role="status">
      {strings.updateReady}
      <button type="button" className="primary" onClick={() => void updateServiceWorker(true)}>
        {strings.update}
      </button>
    </div>
  );
}
