import { createFileRoute } from "@tanstack/react-router";

/**
 * Stripe → app webhook (web subscriptions). Receiving end of Stripe Checkout.
 *
 * Configure in Stripe dashboard → Developers → Webhooks:
 *   URL:    https://<your-project>.lovable.app/api/public/hooks/stripe
 *   Events: checkout.session.completed,
 *           customer.subscription.created,
 *           customer.subscription.updated,
 *           customer.subscription.deleted
 *   Signing secret → STRIPE_WEBHOOK_SECRET env var.
 *
 * Writes the same `entitlements` table as the RevenueCat webhook, so the
 * entitlement check (`is_companion`) is source-agnostic. We reconcile the user
 * by `client_reference_id` (the auth uid we set at checkout) and fall back to
 * the `stripe_customer_id` column for renewal/cancellation events.
 */
export const Route = createFileRoute("/api/public/hooks/stripe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!secret) return new Response("server not configured", { status: 500 });

        // Signature must be verified against the RAW body, not re-serialized JSON.
        const raw = await request.text();
        const sig = request.headers.get("stripe-signature");

        const stripe = await import("@/lib/stripe.server");
        if (!stripe.verifyStripeSignature(raw, sig, secret)) {
          return new Response("invalid signature", { status: 400 });
        }

        let event: any;
        try {
          event = JSON.parse(raw);
        } catch {
          return new Response("bad json", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const admin = supabaseAdmin as any;
        const now = new Date().toISOString();

        async function userByCustomer(customerId: string | null): Promise<string | null> {
          if (!customerId) return null;
          const { data } = await admin
            .from("entitlements")
            .select("user_id")
            .eq("stripe_customer_id", customerId)
            .maybeSingle();
          return (data?.user_id as string | undefined) ?? null;
        }

        async function writeEntitlement(row: Record<string, unknown>) {
          const { error } = await admin
            .from("entitlements")
            .upsert({ ...row, source: "stripe", store: "stripe", updated_at: now }, {
              onConflict: "user_id",
            });
          if (error) throw new Error(error.message);
        }

        const type: string = event.type ?? "";
        const obj: any = event.data?.object ?? {};

        try {
          if (type === "checkout.session.completed") {
            const customerId: string | null = obj.customer ?? null;
            const userId =
              (obj.client_reference_id as string | undefined) ??
              (obj.metadata?.user_id as string | undefined) ??
              (await userByCustomer(customerId));
            if (!userId) return Response.json({ ignored: "unknown_user" });

            let expires_at: string | null = null;
            let trial_ends_at: string | null = null;
            let product_id: string | null = obj.metadata?.plan ?? null;

            if (obj.subscription) {
              const sub = await stripe.retrieveSubscription(String(obj.subscription));
              const ms = stripe.subPeriodEndMs(sub);
              expires_at = ms ? new Date(ms).toISOString() : null;
              trial_ends_at = sub?.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null;
              product_id = sub?.items?.data?.[0]?.price?.id ?? product_id;
            }

            await writeEntitlement({
              user_id: userId,
              tier: "companion",
              product_id,
              expires_at,
              trial_ends_at,
              stripe_customer_id: customerId,
            });
            return Response.json({ ok: true });
          }

          if (
            type === "customer.subscription.created" ||
            type === "customer.subscription.updated" ||
            type === "customer.subscription.deleted"
          ) {
            const customerId: string | null = obj.customer ?? null;
            const userId = await userByCustomer(customerId);
            if (!userId) return Response.json({ ignored: "unknown_user" });

            const deleted = type === "customer.subscription.deleted";
            const mapped = deleted ? "free" : stripe.subStatusToTier(obj.status ?? "");
            const tier: "free" | "companion" = mapped === "free" ? "free" : "companion";

            const ms = stripe.subPeriodEndMs(obj);
            await writeEntitlement({
              user_id: userId,
              tier,
              product_id: obj.items?.data?.[0]?.price?.id ?? null,
              expires_at: tier === "free" ? now : ms ? new Date(ms).toISOString() : null,
              trial_ends_at: obj.trial_end ? new Date(obj.trial_end * 1000).toISOString() : null,
              stripe_customer_id: customerId,
            });
            return Response.json({ ok: true });
          }

          // Unhandled event types: ack so Stripe stops retrying.
          return Response.json({ ok: true, ignored: type });
        } catch (e: any) {
          return new Response(`handler error: ${e?.message ?? "unknown"}`, { status: 500 });
        }
      },
    },
  },
});
