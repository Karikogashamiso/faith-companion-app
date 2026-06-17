/**
 * Theme controller for the dusk dark mode. Persists the user's choice, honors
 * the OS preference under "system", and toggles the `.dark` class that the
 * design tokens key off. Pure + SSR-safe (guards on window/document).
 */
export type Theme = "light" | "dark" | "system";

const KEY = "sanctuary-theme";

export function getStoredTheme(): Theme {
  if (typeof localStorage === "undefined") return "system";
  const t = localStorage.getItem(KEY);
  return t === "light" || t === "dark" || t === "system" ? t : "system";
}

export function prefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

export function resolveDark(theme: Theme): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return prefersDark();
}

export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", resolveDark(theme));
}

export function setTheme(theme: Theme): void {
  if (typeof localStorage !== "undefined") localStorage.setItem(KEY, theme);
  applyTheme(theme);
}

/**
 * Inline, render-blocking snippet for the document <head>: applies the saved
 * theme before first paint so there's no light→dark flash on load.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${KEY}')||'system';var d=t==='dark'||(t!=='light'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;
