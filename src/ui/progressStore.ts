import { loadProgress, NO_PROGRESS, type Progress } from '../core/progress';

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

/** The saved progress, or no progress if there is none or it can't be read. */
export async function loadSavedProgress(): Promise<Progress> {
  try {
    return loadProgress(await run('readonly', (store) => store.get(KEY)));
  } catch {
    return NO_PROGRESS;
  }
}

/** Saves progress, replacing what was saved before. */
export async function saveProgress(progress: Progress): Promise<void> {
  try {
    await run('readwrite', (store) => store.put(progress, KEY));
    // Ask the browser not to clear it under storage pressure (Safari clears unused sites' data).
    await navigator.storage?.persist?.();
  } catch {
    // Playing on without saving is better than an error a child can't do anything about.
  }
}
