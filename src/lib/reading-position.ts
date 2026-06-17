/** Last-read Bible position, persisted locally so the reader resumes where you
 *  left off and home can show a "Continue reading" card. */
export type ReadingPosition = {
  versionId: string;
  book: string;
  chapter: number;
};

const KEY = "reading-position";

export function getReadingPosition(): ReadingPosition | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const s = localStorage.getItem(KEY);
    if (!s) return null;
    const p = JSON.parse(s);
    if (p && p.versionId && p.book && typeof p.chapter === "number") return p;
    return null;
  } catch {
    return null;
  }
}

export function setReadingPosition(p: ReadingPosition): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable */
  }
}
