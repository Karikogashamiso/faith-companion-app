import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PLANS = [
  "companion_weekly",
  "companion_monthly",
  "companion_annual",
  "companion_lifetime",
] as const;

const CheckoutInput = z.object({
  plan: z.enum(PLANS),
  origin: z.string().url(),
});

const PortalInput = z.object({ origin: z.string().url() });

/**
 * Start a Stripe Checkout for the signed-in user. Returns the hosted URL to
 * redirect to. If Stripe isn't configured (no STRIPE_SECRET_KEY), returns
 * `{ configured: false }` so the UI can fall back to the mobile-app message.
 */
export const createCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CheckoutInput.parse(input))
  .handler(async ({ data, context }) => {
    const stripe = await import("./stripe.server");
    if (!stripe.stripeConfigured()) return { configured: false as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    // Reuse an existing Stripe customer if the user has one.
    const { data: ent } = await admin
      .from("entitlements")
      .select("stripe_customer_id")
      .eq("user_id", context.userId)
      .maybeSingle();

    const email = (context.claims as { email?: string })?.email;
    const customerId = await stripe.ensureCustomer({
      existingId: ent?.stripe_customer_id ?? null,
      email,
      userId: context.userId,
    });

    // Persist the customer id NOW so the webhook can reconcile subscription
    // events even if the user abandons checkout. Leaves tier untouched.
    await admin.from("entitlements").upsert(
      {
        user_id: context.userId,
        stripe_customer_id: customerId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    // Lifetime is a one-time purchase; the rest are subscriptions (annual gets
    // the advertised 7-day trial).
    const lifetime = data.plan === "companion_lifetime";
    const trialDays = data.plan === "companion_annual" ? 7 : undefined;

    const url = await stripe.createCheckoutSession({
      plan: data.plan,
      customerId,
      userId: context.userId,
      successUrl: `${data.origin}/companion?checkout=success`,
      cancelUrl: `${data.origin}/companion?checkout=cancelled`,
      trialDays,
      mode: lifetime ? "payment" : "subscription",
    });

    return { configured: true as const, url };
  });

/**
 * Open the Stripe Billing Portal so the user can manage or cancel. Returns
 * `{ url: null }` if the user has no Stripe customer yet (e.g. they subscribed
 * via the mobile app / RevenueCat instead).
 */
export const createBillingPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PortalInput.parse(input))
  .handler(async ({ data, context }) => {
    const stripe = await import("./stripe.server");
    if (!stripe.stripeConfigured()) return { configured: false as const, url: null };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { data: ent } = await admin
      .from("entitlements")
      .select("stripe_customer_id")
      .eq("user_id", context.userId)
      .maybeSingle();

    const customerId = ent?.stripe_customer_id as string | undefined;
    if (!customerId) return { configured: true as const, url: null };

    const url = await stripe.createPortalSession({
      customerId,
      returnUrl: `${data.origin}/companion`,
    });
    return { configured: true as const, url };
  });
