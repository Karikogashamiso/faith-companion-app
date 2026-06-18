// Anonymous, client-side analytics for the marketing site. Uses a localStorage
// anon_id and posts to /api/public/track. Click events use sendBeacon so they
// survive the navigation to /auth.

const ANON_KEY = "fc_anon_id";
const CONV_KEY = "fc_conv_fired";

export function getAnonId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = localStorage.getItem(ANON_KEY);
    if (!id) {
      id =
        (typeof crypto !== "undefined" && crypto.randomUUID?.()) ||
        `a${Date.now()}${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

export function trackLanding(event: string, props: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return;
  const anon_id = getAnonId();
  if (!anon_id) return;

  const payload = JSON.stringify({
    event,
    anon_id,
    path: window.location.pathname,
    referrer: document.referrer || undefined,
    props,
  });

  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/public/track",
        new Blob([payload], { type: "application/json" }),
      );
      return;
    }
  } catch {
    /* fall through to fetch */
  }
  void fetch("/api/public/track", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {});
}

/**
 * Returns the visitor's anon_id exactly once (the first time after they sign
 * up), so the authenticated side can fire a single `landing_conversion` event
 * linking the anonymous funnel to the new account. Returns null thereafter.
 */
export function takeConversionAnonId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    if (localStorage.getItem(CONV_KEY)) return null;
    const id = localStorage.getItem(ANON_KEY);
    if (!id) return null;
    localStorage.setItem(CONV_KEY, "1");
    return id;
  } catch {
    return null;
  }
}
