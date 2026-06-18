// Pure decision logic for the RevenueCat webhook, extracted from the route so
// the event→entitlement mapping is unit-testable without HTTP/DB.

export type RcDecision =
  | { kind: "noop"; reason: string }
  | { kind: "ignore"; reason: string }
  | {
      kind: "write";
      tier: "companion" | "free";
      expires_at: string | null;
      trial_ends_at: string | null;
      product_id: string | null;
      store: string | null;
    };

/**
 * Map a RevenueCat `event` to an entitlement decision.
 *   purchase/renewal/trial/cancellation/billing-issue → companion (still
 *     entitled until expires_at)
 *   expiration/trial-cancelled                         → free (expired now)
 *   alias/transfer/test                                → noop
 *   anything else                                      → ignore (ack, no write)
 */
export function revenueCatEventToEntitlement(event: any, nowIso: string): RcDecision {
  const productId: string | null = event?.product_id ?? null;
  const expiresMs: number | null = event?.expiration_at_ms ?? null;
  const trialEndsMs: number | null = event?.period_type === "TRIAL" ? expiresMs : null;
  const store: string | null = event?.store ?? null;
  const expiresIso = expiresMs ? new Date(expiresMs).toISOString() : null;
  const trialIso = trialEndsMs ? new Date(trialEndsMs).toISOString() : null;

  switch (event?.type) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "PRODUCT_CHANGE":
    case "UNCANCELLATION":
    case "TRIAL_STARTED":
    case "TRIAL_CONVERTED":
    case "CANCELLATION": // entitled until expires_at
    case "BILLING_ISSUE": // short grace; trust event expires_at
      return {
        kind: "write",
        tier: "companion",
        expires_at: expiresIso,
        trial_ends_at: trialIso,
        product_id: productId,
        store,
      };
    case "EXPIRATION":
    case "TRIAL_CANCELLED":
      return {
        kind: "write",
        tier: "free",
        expires_at: nowIso,
        trial_ends_at: null,
        product_id: productId,
        store,
      };
    case "SUBSCRIBER_ALIAS":
    case "TRANSFER":
    case "TEST":
      return { kind: "noop", reason: event.type };
    default:
      return { kind: "ignore", reason: event?.type ?? "unknown" };
  }
}
