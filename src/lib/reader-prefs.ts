/** Reader typography preferences (persisted locally). `scale` multiplies the
 *  base 19px Scripture size. */
export const BASE_PX = 19;
export const SCALES = [0.85, 1, 1.15, 1.3, 1.5] as const;

export type ReaderPrefs = { scale: number };

const KEY = "reader-prefs";

export function getReaderPrefs(): ReaderPrefs {
  if (typeof localStorage === "undefined") return { scale: 1 };
  try {
    const s = localStorage.getItem(KEY);
    const p = s ? JSON.parse(s) : {};
    const scale = typeof p.scale === "number" ? p.scale : 1;
    return { scale };
  } catch {
    return { scale: 1 };
  }
}

export function setReaderPrefs(p: ReaderPrefs): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable */
  }
}
