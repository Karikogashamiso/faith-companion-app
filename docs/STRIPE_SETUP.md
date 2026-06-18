# Stripe web checkout — setup

The web app can now actually charge money. Checkout, the billing portal, and a
webhook are wired to the existing `entitlements` table (the same one RevenueCat
writes), so `is_companion()` is source-agnostic — a user is Companion whether
they paid on the web (Stripe) or in a mobile app (RevenueCat).

Implemented with the Stripe REST API (`src/lib/stripe.server.ts`) — **no `stripe`
npm dependency**, matching the dependency-free style of the RevenueCat webhook.

## 1. Create the products & prices in Stripe

In the Stripe dashboard create **one product** ("Faith Companion") with **three
recurring prices**:

| Plan | Interval | Suggested price |
|------|----------|-----------------|
| Weekly  | every 1 week  | $2.99 |
| Monthly | every 1 month | $4.99 |
| Annual  | every 1 year  | $39.99 |

> Localized prices shown in-app come from `src/lib/pricing.ts`. To charge in
> local currencies, add per-currency prices in Stripe (Stripe picks the buyer's
> currency automatically) or use Stripe Adaptive Pricing.

Copy each Price id (`price_…`).

## 2. Set environment variables

Set these in the Lovable/hosting environment (server-side secrets — never
`VITE_`-prefixed):

```
STRIPE_SECRET_KEY=sk_live_…            # or sk_test_… while testing
STRIPE_WEBHOOK_SECRET=whsec_…          # from step 3
STRIPE_PRICE_WEEKLY=price_…
STRIPE_PRICE_MONTHLY=price_…
STRIPE_PRICE_ANNUAL=price_…
```

If `STRIPE_SECRET_KEY` is unset, the paywall safely falls back to the
"continue in the mobile app" message — nothing breaks.

## 3. Add the webhook

Stripe dashboard → Developers → Webhooks → Add endpoint:

- **URL:** `https://<your-project>.lovable.app/api/public/hooks/stripe`
- **Events:** `checkout.session.completed`, `customer.subscription.created`,
  `customer.subscription.updated`, `customer.subscription.deleted`
- Copy the **Signing secret** → `STRIPE_WEBHOOK_SECRET`.

## 4. Apply the migration

Run `supabase/_apply_new_migrations.sql` (or just the
`20260617040000_stripe_billing.sql` block) so `entitlements.stripe_customer_id`
exists, then regenerate types.

## How it flows

1. User taps a plan → `createCheckout` server fn (authenticated) creates/reuses a
   Stripe customer, stores `stripe_customer_id` on their entitlement row, and
   returns a hosted Checkout URL. Annual includes a 7-day trial.
2. User pays on Stripe → redirected back to `/companion?checkout=success`.
3. Stripe calls the webhook → entitlement upserted to `tier='companion'` with the
   period end as `expires_at`. Renewals/cancellations keep it in sync.
4. "Manage or restore subscription" → `createBillingPortal` opens the Stripe
   Billing Portal (or, for mobile purchasers with no Stripe customer, points
   them to their store account).

## Test mode

Use `sk_test_…` + test price ids + the test webhook secret. Stripe test card
`4242 4242 4242 4242`, any future expiry/CVC. Verify the entitlement row flips to
`companion` after checkout and back to `free` after canceling in the portal.
