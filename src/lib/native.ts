/**
 * Native-shell detection. When the web app runs inside the Capacitor native
 * shell, Capacitor injects `window.Capacitor` — so we can detect the native
 * runtime WITHOUT importing any Capacitor npm package (keeps the web build free
 * of native dependencies).
 */

type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
};

function cap(): CapacitorGlobal | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
}

export function isNativePlatform(): boolean {
  return Boolean(cap()?.isNativePlatform?.());
}

export function nativePlatform(): "ios" | "android" | "web" {
  const p = cap()?.getPlatform?.() ?? "web";
  return p === "ios" || p === "android" ? p : "web";
}
