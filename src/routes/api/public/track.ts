import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Public, anonymous analytics sink for the marketing site (no auth). Records
 * top-of-funnel events keyed by a client-generated anon_id so we can measure
 * landing → CTA → signup conversion. Only an allowlist of event names is
 * accepted (prevents the open endpoint from being used as arbitrary storage),
 * and writes are best-effort so they never affect the visitor.
 */
const ALLOWED = new Set([
  "landing_view",
  "cta_click",
  "store_badge_click",
  "demo_ask",
  "pricing_view",
]);

const Body = z.object({
  event: z.string().min(1).max(40),
  anon_id: z.string().min(8).max(64),
  path: z.string().max(200).optional(),
  referrer: z.string().max(300).optional(),
  props: z.record(z.string(), z.unknown()).optional(),
});

export const Route = createFileRoute("/api/public/track")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return new Response("bad json", { status: 400 });
        }
        const parsed = Body.safeParse(raw);
        if (!parsed.success) return Response.json({ ok: false }, { status: 400 });

        const { event, anon_id, path, referrer, props } = parsed.data;
        if (!ALLOWED.has(event)) return Response.json({ ok: true, ignored: true });

        // Keep props small (the open endpoint shouldn't store arbitrary blobs).
        let safeProps: Record<string, unknown> = {};
        try {
          if (props && JSON.stringify(props).length <= 1000) safeProps = props;
        } catch {
          safeProps = {};
        }

        try {
          const { supabaseAdmin } = await import(
            "@/integrations/supabase/client.server"
          );
          const admin = supabaseAdmin as any;

          // Per-IP throttle so the open endpoint can't be used to inflate the
          // funnel. Prefer the trusted Cloudflare header over spoofable XFF, and
          // namespace the key so it doesn't share the demo's rate bucket.
          const ip =
            request.headers.get("cf-connecting-ip") ??
            request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
            "anon";
          const { data: rl } = await admin.rpc("demo_rate_check", {
            _ip: `track:${ip}`,
            _max: 60,
            _window_seconds: 600,
          });
          const allowed = Array.isArray(rl) ? rl[0]?.allowed : rl?.allowed;
          if (allowed === false) return Response.json({ ok: true, throttled: true });

          await admin.from("landing_events").insert({
            anon_id,
            event,
            path: path ?? null,
            referrer: referrer ?? null,
            props: safeProps,
          });
        } catch {
          /* analytics must never break — swallow */
        }
        return Response.json({ ok: true });
      },
    },
  },
});
