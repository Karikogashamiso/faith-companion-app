// Server-only Stripe client implemented against the Stripe REST API with
// `fetch` + Node `crypto` — no `stripe` npm dependency, matching the
// dependency-free style of the RevenueCat webhook. The `.server.ts` suffix
// keeps this out of the client bundle. Read env INSIDE functions (per-request).
import { createHmac, timingSafeEqual } from "node:crypto";

const STRIPE_API = "https://api.stripe.com/v1";

export type Plan = "companion_weekly" | "companion_monthly" | "companion_annual";

// Each plan's Stripe Price id comes from an env var so the same code works in
// test and live mode without redeploying.
const PRICE_ENV: Record<Plan, string> = {
  companion_weekly: "STRIPE_PRICE_WEEKLY",
  companion_monthly: "STRIPE_PRICE_MONTHLY",
  companion_annual: "STRIPE_PRICE_ANNUAL",
};

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

function secretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  return key;
}

export function priceForPlan(plan: Plan): string {
  const price = process.env[PRICE_ENV[plan]];
  if (!price) throw new Error(`No Stripe price configured for plan "${plan}" (set ${PRICE_ENV[plan]})`);
  return price;
}

// Flatten nested objects/arrays into Stripe's bracketed form-encoding, e.g.
// { line_items: [{ price: "x", quantity: 1 }] } -> line_items[0][price]=x&...
function encodeForm(obj: Record<string, unknown>, prefix = ""): string[] {
  const parts: string[] = [];
  for (const [rawKey, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;
    const key = prefix ? `${prefix}[${rawKey}]` : rawKey;
    if (Array.isArray(value)) {
      value.forEach((v, i) => {
        if (v !== null && typeof v === "object") {
          parts.push(...encodeForm(v as Record<string, unknown>, `${key}[${i}]`));
        } else {
          parts.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(v))}`);
        }
      });
    } else if (typeof value === "object") {
      parts.push(...encodeForm(value as Record<string, unknown>, key));
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts;
}

async function stripePost(path: string, body: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: encodeForm(body).join("&"),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message ?? `Stripe POST ${path} failed (${res.status})`);
  }
  return json;
}

async function stripeGet(path: string): Promise<any> {
  const res = await fetch(`${STRIPE_API}${path}`, {
    headers: { Authorization: `Bearer ${secretKey()}` },
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message ?? `Stripe GET ${path} failed (${res.status})`);
  }
  return json;
}

/** Reuse the user's Stripe customer if we have one, else create it. */
export async function ensureCustomer(opts: {
  existingId: string | null;
  email?: string;
  userId: string;
}): Promise<string> {
  if (opts.existingId) return opts.existingId;
  const customer = await stripePost("/customers", {
    email: opts.email,
    metadata: { user_id: opts.userId },
  });
  return customer.id as string;
}

/** Create a hosted Checkout session for a subscription; returns its URL. */
export async function createCheckoutSession(opts: {
  plan: Plan;
  customerId: string;
  userId: string;
  successUrl: string;
  cancelUrl: string;
  trialDays?: number;
}): Promise<string> {
  const session = await stripePost("/checkout/sessions", {
    mode: "subscription",
    customer: opts.customerId,
    client_reference_id: opts.userId,
    "line_items": [{ price: priceForPlan(opts.plan), quantity: 1 }],
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    allow_promotion_codes: true,
    subscription_data: {
      metadata: { user_id: opts.userId, plan: opts.plan },
      ...(opts.trialDays ? { trial_period_days: opts.trialDays } : {}),
    },
    metadata: { user_id: opts.userId, plan: opts.plan },
  });
  return session.url as string;
}

/** Create a Billing Portal session so users can manage/cancel; returns its URL. */
export async function createPortalSession(opts: {
  customerId: string;
  returnUrl: string;
}): Promise<string> {
  const session = await stripePost("/billing_portal/sessions", {
    customer: opts.customerId,
    return_url: opts.returnUrl,
  });
  return session.url as string;
}

export async function retrieveSubscription(id: string): Promise<any> {
  return stripeGet(`/subscriptions/${id}`);
}

/** Map a Stripe subscription status to our entitlement intent. */
export function subStatusToTier(status: string): "companion" | "free" | "grace" {
  switch (status) {
    case "active":
    case "trialing":
      return "companion";
    case "past_due":
    case "unpaid":
      return "grace"; // keep access through the paid period; webhook treats as companion
    default:
      return "free"; // canceled, incomplete, incomplete_expired
  }
}

/**
 * current_period_end moved to the subscription item level in newer Stripe API
 * versions; read whichever is present. Returns epoch milliseconds or null.
 */
export function subPeriodEndMs(sub: any): number | null {
  const top = sub?.current_period_end;
  if (typeof top === "number") return top * 1000;
  const item = sub?.items?.data?.[0]?.current_period_end;
  if (typeof item === "number") return item * 1000;
  return null;
}

export type EntitlementFields = {
  tier: "free" | "companion";
  expires_at: string | null;
  trial_ends_at: string | null;
  product_id: string | null;
};

/**
 * Pure mapping from a Stripe subscription object (+ whether the event was a
 * deletion) to the entitlement row fields. Extracted so the webhook's decision
 * logic is unit-testable without HTTP/DB. `free` tiers expire immediately;
 * active/grace tiers carry the current period end.
 */
export function subscriptionToEntitlement(opts: {
  sub: any;
  deleted: boolean;
  nowIso: string;
}): EntitlementFields {
  const tier: "free" | "companion" =
    opts.deleted || subStatusToTier(opts.sub?.status ?? "") === "free" ? "free" : "companion";
  const ms = subPeriodEndMs(opts.sub);
  return {
    tier,
    expires_at: tier === "free" ? opts.nowIso : ms ? new Date(ms).toISOString() : null,
    trial_ends_at: opts.sub?.trial_end ? new Date(opts.sub.trial_end * 1000).toISOString() : null,
    product_id: opts.sub?.items?.data?.[0]?.price?.id ?? null,
  };
}

/**
 * Verify a Stripe webhook signature (the scheme `stripe-signature: t=…,v1=…`).
 * HMAC-SHA256 over `${t}.${rawBody}`, constant-time compared, with a default
 * 5-minute timestamp tolerance to block replay. No `stripe` SDK needed.
 */
export function verifyStripeSignature(
  rawBody: string,
  sigHeader: string | null,
  secret: string,
  toleranceSec = 300,
): boolean {
  if (!sigHeader) return false;
  const fields: Record<string, string> = {};
  for (const part of sigHeader.split(",")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    fields[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  }
  const t = fields["t"];
  const v1 = fields["v1"];
  if (!t || !v1) return false;

  const ts = Number(t);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > toleranceSec) return false;

  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  return a.length === b.length && timingSafeEqual(a, b);
}
