/** Reader typography preferences (persisted locally). */
export const BASE_PX = 19;
export const SCALES = [0.85, 1, 1.15, 1.3, 1.5] as const;

export type FontFamily = "serif" | "sans" | "dyslexic";
export type LineSpacing = "tight" | "normal" | "relaxed" | "loose";
export type Density = "comfortable" | "compact";

export type ReaderPrefs = {
  scale: number;
  family: FontFamily;
  lineSpacing: LineSpacing;
  density: Density;
};

const KEY = "reader-prefs";

export const LINE_HEIGHTS: Record<LineSpacing, number> = {
  tight: 1.45,
  normal: 1.7,
  relaxed: 1.85,
  loose: 2.1,
};

export const FONT_STACKS: Record<FontFamily, string> = {
  serif: "'Libre Baskerville', Georgia, 'Times New Roman', serif",
  sans: "'Inter', system-ui, -apple-system, sans-serif",
  dyslexic:
    "'OpenDyslexic', 'Atkinson Hyperlegible', Verdana, system-ui, sans-serif",
};

const DEFAULT: ReaderPrefs = {
  scale: 1,
  family: "serif",
  lineSpacing: "relaxed",
  density: "comfortable",
};

export function getReaderPrefs(): ReaderPrefs {
  if (typeof localStorage === "undefined") return DEFAULT;
  try {
    const s = localStorage.getItem(KEY);
    const p = s ? JSON.parse(s) : {};
    return {
      scale: typeof p.scale === "number" ? p.scale : DEFAULT.scale,
      family:
        p.family === "sans" || p.family === "dyslexic" ? p.family : "serif",
      lineSpacing:
        p.lineSpacing === "tight" ||
        p.lineSpacing === "normal" ||
        p.lineSpacing === "loose"
          ? p.lineSpacing
          : "relaxed",
      density: p.density === "compact" ? "compact" : "comfortable",
    };
  } catch {
    return DEFAULT;
  }
}

export function setReaderPrefs(p: Partial<ReaderPrefs>): void {
  if (typeof localStorage === "undefined") return;
  try {
    const current = getReaderPrefs();
    localStorage.setItem(KEY, JSON.stringify({ ...current, ...p }));
  } catch {
    /* storage unavailable */
  }
}
