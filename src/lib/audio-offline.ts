// Offline audio store (premium feature). Audio lives in the Supabase Storage
// 'audio' bucket (cross-origin), which the service worker deliberately doesn't
// cache — so we download the file as a Blob and keep it in IndexedDB, then play
// it from an object URL. Dependency-free.

const DB_NAME = "fc-audio";
const STORE = "tracks";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
      }),
  );
}

/** Download a track to IndexedDB for offline playback. */
export async function saveTrack(id: string, url: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const blob = await res.blob();
  await run("readwrite", (s) => s.put(blob, id));
}

/** Object URL for a saved track, or null if not downloaded. Caller revokes it. */
export async function getOfflineUrl(id: string): Promise<string | null> {
  try {
    const blob = await run<Blob | undefined>("readonly", (s) => s.get(id));
    return blob ? URL.createObjectURL(blob) : null;
  } catch {
    return null;
  }
}

export async function deleteTrack(id: string): Promise<void> {
  try {
    await run("readwrite", (s) => s.delete(id));
  } catch {
    /* ignore */
  }
}

export async function savedTrackIds(): Promise<string[]> {
  try {
    const keys = await run<IDBValidKey[]>("readonly", (s) => s.getAllKeys());
    return (keys ?? []).map(String);
  } catch {
    return [];
  }
}
