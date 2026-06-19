import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { savePushSubscription, deletePushSubscription } from "./push.functions";

// VAPID public key is safe to expose to the client (it's the *public* key).
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export type PushState = {
  supported: boolean;
  subscribed: boolean;
  busy: boolean;
  enable: () => Promise<{ ok: boolean; reason?: string }>;
  disable: () => Promise<void>;
};

/**
 * Client hook for enabling background (closed-app) push. Registers the service
 * worker, requests permission, subscribes via PushManager with the VAPID key,
 * and persists the subscription server-side.
 */
export function usePush(): PushState {
  const save = useServerFn(savePushSubscription);
  const del = useServerFn(deletePushSubscription);

  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    Boolean(VAPID_PUBLIC_KEY);

  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supported) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(Boolean(sub)))
      .catch(() => {});
  }, [supported]);

  const enable = useCallback(async (): Promise<{ ok: boolean; reason?: string }> => {
    if (!supported || !VAPID_PUBLIC_KEY) return { ok: false, reason: "unsupported" };
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return { ok: false, reason: "denied" };

      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
        });
      }

      const json = sub.toJSON();
      if (!json.keys?.p256dh || !json.keys?.auth) return { ok: false, reason: "no_keys" };
      await save({
        data: { endpoint: sub.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth },
      });
      setSubscribed(true);
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : "error" };
    } finally {
      setBusy(false);
    }
  }, [supported, save]);

  const disable = useCallback(async (): Promise<void> => {
    if (!supported) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await del({ data: { endpoint: sub.endpoint } });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }, [supported, del]);

  return { supported, subscribed, busy, enable, disable };
}
