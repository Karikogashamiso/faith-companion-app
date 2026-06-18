import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";

/**
 * Scheduled sender for reminder push notifications (closed-app delivery).
 *
 * Call this every ~5 minutes from an external scheduler (cron-job.org, GitHub
 * Actions schedule, Supabase pg_cron + pg_net, etc.):
 *   POST https://<your-project>.lovable.app/api/cron/push-due
 *   Header: Authorization: Bearer <CRON_SECRET>
 *
 * For each enabled reminder it computes the user's LOCAL time (from the
 * reminder's IANA tz), and if it's due (once per local day, within a catch-up
 * window) sends a Web Push to all of that user's subscriptions. Dead
 * subscriptions (404/410) are pruned. Requires VAPID_* env to be configured.
 */
export const Route = createFileRoute("/api/cron/push-due")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        if (!secret) return new Response("server not configured", { status: 500 });

        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        const a = Buffer.from(token);
        const b = Buffer.from(secret);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("unauthorized", { status: 401 });
        }

        const { vapidConfig, sendPush } = await import("@/lib/web-push.server");
        const vapid = vapidConfig();
        if (!vapid) return new Response("push not configured (VAPID_*)", { status: 500 });

        const { zonedNow, isReminderDue, reminderMessage } = await import("@/lib/push-schedule");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const admin = supabaseAdmin as any;

        const now = new Date();

        const { data: reminders, error } = await admin
          .from("reminders")
          .select("id, user_id, kind, label, at_time, days, tz, last_pushed_on")
          .eq("enabled", true);
        if (error) return new Response(`db: ${error.message}`, { status: 500 });

        // Resolve which reminders are due, grouped by user.
        const dueByUser = new Map<string, any[]>();
        const zoneCache = new Map<string, ReturnType<typeof zonedNow>>();
        for (const r of (reminders ?? []) as any[]) {
          const tz = r.tz || "UTC";
          let z = zoneCache.get(tz);
          if (!z) {
            try {
              z = zonedNow(now, tz);
            } catch {
              z = zonedNow(now, "UTC"); // bad tz string → fail safe to UTC
            }
            zoneCache.set(tz, z);
          }
          if (isReminderDue(r, z)) {
            const list = dueByUser.get(r.user_id) ?? [];
            list.push({ ...r, _localDate: z.localDate });
            dueByUser.set(r.user_id, list);
          }
        }

        let sent = 0;
        let pruned = 0;
        const firedReminderIds: { id: string; localDate: string }[] = [];

        for (const [userId, list] of dueByUser) {
          const { data: subs } = await admin
            .from("push_subscriptions")
            .select("endpoint, p256dh, auth")
            .eq("user_id", userId);
          if (!subs?.length) {
            // No device to notify, but still mark fired so we don't reconsider
            // it all day once they have one.
            for (const r of list) firedReminderIds.push({ id: r.id, localDate: r._localDate });
            continue;
          }

          for (const r of list) {
            const msg = reminderMessage(r);
            const payload = JSON.stringify({
              title: msg.title,
              body: msg.body,
              url: msg.url,
              tag: `reminder-${r.id}`,
            });
            for (const s of subs as any[]) {
              try {
                const res = await sendPush(s, payload, vapid);
                if (res.ok) sent++;
                if (res.gone) {
                  await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
                  pruned++;
                }
              } catch {
                /* network/crypto error — skip this device this run */
              }
            }
            firedReminderIds.push({ id: r.id, localDate: r._localDate });
          }
        }

        // Mark fired so each reminder sends at most once per local day.
        for (const f of firedReminderIds) {
          await admin.from("reminders").update({ last_pushed_on: f.localDate }).eq("id", f.id);
        }

        return Response.json({
          ok: true,
          due: firedReminderIds.length,
          sent,
          pruned,
        });
      },
    },
  },
});
