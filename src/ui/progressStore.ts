import { loadPlayers, NO_PLAYERS, type Players, savePlayers } from '../core/profiles';

// Saved progress lives in IndexedDB in this browser only; nothing leaves the device
// (docs/design.md §2). Every failure falls back to playing without saving rather than breaking
// the game: private windows and locked-down school devices may refuse storage.

const DATABASE = 'electronics-kit';
const STORE = 'progress';
const KEY = 'progress';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open storage'));
  });
}

function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
  return open().then((db) =>
    new Promise<T>((resolve, reject) => {
      const request = action(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Storage request failed'));
    }).finally(() => db.close()),
  );
}

/**
 * The saved players and their progress, or one player with none if nothing can be read. Older
 * saved data, one child's progress, is migrated (`loadPlayers`).
 */
export async function loadSavedPlayers(): Promise<Players> {
  try {
    return loadPlayers(await run('readonly', (store) => store.get(KEY)));
  } catch {
    return NO_PLAYERS;
  }
}

/** Saves the players, replacing what was saved before. */
export async function saveSavedPlayers(players: Players): Promise<void> {
  try {
    await run('readwrite', (store) => store.put(savePlayers(players), KEY));
    // Ask the browser not to clear it under storage pressure (Safari clears unused sites' data).
    await navigator.storage?.persist?.();
  } catch {
    // Playing on without saving is better than an error a child can't do anything about.
  }
}
