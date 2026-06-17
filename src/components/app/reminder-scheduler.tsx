import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { nextOccurrence } from "@/lib/reminders";

/**
 * Fires in-app notifications for enabled reminders while the app is open.
 * RLS scopes the query to the signed-in user. Renders nothing. (Background
 * delivery when the app is closed requires push infra — stored server-side
 * and ready for that; this covers the open-app case.)
 */
export function ReminderScheduler() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    function fire(r: { kind: string; label: string }) {
      if (typeof Notification === "undefined" || Notification.permission !== "granted")
        return;
      const title =
        r.kind === "verse"
          ? "Today's verse is ready"
          : r.label || "Time to pray";
      const body =
        r.kind === "verse"
          ? "Open Discipleship Companion for today's Scripture."
          : "Take a quiet moment to pray.";
      try {
        new Notification(title, { body });
      } catch {
        /* notifications unavailable */
      }
    }

    async function arm() {
      if (cancelled) return;
      const { data } = await (supabase as any)
        .from("reminders")
        .select("id, kind, label, at_time, days, enabled")
        .eq("enabled", true);
      if (cancelled || !data?.length) return;

      const now = new Date();
      let soonest: { when: Date; r: any } | null = null;
      for (const r of data as any[]) {
        const when = nextOccurrence(now, String(r.at_time).slice(0, 5), r.days ?? []);
        if (when && (!soonest || when < soonest.when)) soonest = { when, r };
      }
      if (!soonest) return;

      const ms = soonest.when.getTime() - now.getTime();
      // setTimeout is unreliable for very long delays — re-check every ≤6h.
      if (ms > 6 * 3600 * 1000) {
        timer = setTimeout(arm, 6 * 3600 * 1000);
        return;
      }
      timer = setTimeout(() => {
        fire(soonest!.r);
        void arm();
      }, ms);
    }

    void arm();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return null;
}
