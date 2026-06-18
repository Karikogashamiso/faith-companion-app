import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";

/**
 * RevenueCat → Lovable webhook.
 *
 * Configure in RevenueCat dashboard → Integrations → Webhooks:
 *   URL:    https://<your-project>.lovable.app/api/public/hooks/revenuecat
 *   Header: Authorization: Bearer <REVENUECAT_WEBHOOK_AUTH secret>
 *
 * RevenueCat sends an `event` envelope. We map:
 *   INITIAL_PURCHASE / RENEWAL / PRODUCT_CHANGE / UNCANCELLATION → tier='companion'
 *   CANCELLATION (still entitled)                                → keep tier, set expires_at
 *   EXPIRATION                                                   → tier='free'
 *   BILLING_ISSUE                                                 → keep tier, mark expires_at (grace)
 *
 * We expect `event.app_user_id` to match either auth.users.id (uuid) or a value
 * the app set via Purchases.logIn(userId). We reconcile by uuid first, then
 * fall back to the rc_app_user_id column.
 */
export const Route = createFileRoute("/api/public/hooks/revenuecat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.REVENUECAT_WEBHOOK_AUTH;
        if (!secret) {
          return new Response("server not configured", { status: 500 });
        }
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        const a = Buffer.from(token);
        const b = Buffer.from(secret);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("unauthorized", { status: 401 });
        }

        let payload: any;
        try {
          payload = await request.json();
        } catch {
          return new Response("bad json", { status: 400 });
        }
        const event = payload?.event;
        if (!event?.type || !event?.app_user_id) {
          return new Response("missing event fields", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Resolve user
        const appUserId: string = String(event.app_user_id);
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(appUserId);
        let userId: string | null = isUuid ? appUserId : null;
        if (!userId) {
          const { data: row } = await supabaseAdmin
            .from("entitlements")
            .select("user_id")
            .eq("rc_app_user_id", appUserId)
            .maybeSingle();
          userId = (row?.user_id as string | undefined) ?? null;
        }
        if (!userId) {
          // Unknown user (anonymous RC id with no prior reconciliation). 200 to stop retries.
          return Response.json({ ignored: "unknown_user" });
        }

        const now = new Date();
        const { revenueCatEventToEntitlement } = await import(
          "@/lib/revenuecat.server"
        );
        const decision = revenueCatEventToEntitlement(event, now.toISOString());
        if (decision.kind === "noop") {
          return Response.json({ ok: true, noop: decision.reason });
        }
        if (decision.kind === "ignore") {
          // Unknown type — ack so RevenueCat's retry queue doesn't pile up.
          return Response.json({ ok: true, ignored: decision.reason });
        }

        const { error } = await supabaseAdmin.from("entitlements").upsert(
          {
            user_id: userId,
            tier: decision.tier,
            source: "revenuecat",
            product_id: decision.product_id,
            store: decision.store,
            trial_ends_at: decision.trial_ends_at,
            expires_at: decision.expires_at,
            rc_app_user_id: appUserId,
            updated_at: now.toISOString(),
          },
          { onConflict: "user_id" },
        );
        if (error) {
          return new Response(`db: ${error.message}`, { status: 500 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
