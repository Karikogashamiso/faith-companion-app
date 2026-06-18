import { describe, expect, it } from "bun:test";
import { subscriptionToEntitlement } from "../src/lib/stripe.server";
import { revenueCatEventToEntitlement } from "../src/lib/revenuecat.server";

const NOW = "2026-06-18T12:00:00.000Z";
const periodEnd = 1_800_000_000; // epoch seconds

describe("subscriptionToEntitlement (Stripe)", () => {
  it("active subscription → companion with period end as expiry", () => {
    const f = subscriptionToEntitlement({
      sub: {
        status: "active",
        current_period_end: periodEnd,
        items: { data: [{ price: { id: "price_123" } }] },
      },
      deleted: false,
      nowIso: NOW,
    });
    expect(f.tier).toBe("companion");
    expect(f.expires_at).toBe(new Date(periodEnd * 1000).toISOString());
    expect(f.product_id).toBe("price_123");
  });

  it("trialing subscription → companion and carries trial_ends_at", () => {
    const trialEnd = 1_750_000_000;
    const f = subscriptionToEntitlement({
      sub: { status: "trialing", current_period_end: periodEnd, trial_end: trialEnd },
      deleted: false,
      nowIso: NOW,
    });
    expect(f.tier).toBe("companion");
    expect(f.trial_ends_at).toBe(new Date(trialEnd * 1000).toISOString());
  });

  it("past_due (grace) keeps companion", () => {
    const f = subscriptionToEntitlement({
      sub: { status: "past_due", current_period_end: periodEnd },
      deleted: false,
      nowIso: NOW,
    });
    expect(f.tier).toBe("companion");
  });

  it("canceled status → free, expires now", () => {
    const f = subscriptionToEntitlement({
      sub: { status: "canceled", current_period_end: periodEnd },
      deleted: false,
      nowIso: NOW,
    });
    expect(f.tier).toBe("free");
    expect(f.expires_at).toBe(NOW);
  });

  it("deleted event → free regardless of status", () => {
    const f = subscriptionToEntitlement({
      sub: { status: "active", current_period_end: periodEnd },
      deleted: true,
      nowIso: NOW,
    });
    expect(f.tier).toBe("free");
    expect(f.expires_at).toBe(NOW);
  });

  it("reads item-level period end when top-level is absent", () => {
    const f = subscriptionToEntitlement({
      sub: { status: "active", items: { data: [{ current_period_end: periodEnd }] } },
      deleted: false,
      nowIso: NOW,
    });
    expect(f.expires_at).toBe(new Date(periodEnd * 1000).toISOString());
  });
});

describe("revenueCatEventToEntitlement", () => {
  const baseExpiry = 1_800_000_000_000; // ms

  for (const type of [
    "INITIAL_PURCHASE",
    "RENEWAL",
    "PRODUCT_CHANGE",
    "UNCANCELLATION",
    "TRIAL_STARTED",
    "TRIAL_CONVERTED",
    "CANCELLATION",
    "BILLING_ISSUE",
  ]) {
    it(`${type} → companion`, () => {
      const d = revenueCatEventToEntitlement(
        { type, expiration_at_ms: baseExpiry, product_id: "companion_monthly", store: "app_store" },
        NOW,
      );
      expect(d.kind).toBe("write");
      if (d.kind === "write") {
        expect(d.tier).toBe("companion");
        expect(d.expires_at).toBe(new Date(baseExpiry).toISOString());
        expect(d.product_id).toBe("companion_monthly");
      }
    });
  }

  it("CANCELLATION keeps the original expiry (not now)", () => {
    const d = revenueCatEventToEntitlement({ type: "CANCELLATION", expiration_at_ms: baseExpiry }, NOW);
    if (d.kind === "write") expect(d.expires_at).toBe(new Date(baseExpiry).toISOString());
  });

  it("TRIAL_STARTED carries trial_ends_at when period_type is TRIAL", () => {
    const d = revenueCatEventToEntitlement(
      { type: "TRIAL_STARTED", period_type: "TRIAL", expiration_at_ms: baseExpiry },
      NOW,
    );
    if (d.kind === "write") expect(d.trial_ends_at).toBe(new Date(baseExpiry).toISOString());
  });

  for (const type of ["EXPIRATION", "TRIAL_CANCELLED"]) {
    it(`${type} → free, expires now`, () => {
      const d = revenueCatEventToEntitlement({ type, expiration_at_ms: baseExpiry }, NOW);
      expect(d.kind).toBe("write");
      if (d.kind === "write") {
        expect(d.tier).toBe("free");
        expect(d.expires_at).toBe(NOW);
      }
    });
  }

  for (const type of ["SUBSCRIBER_ALIAS", "TRANSFER", "TEST"]) {
    it(`${type} → noop`, () => {
      expect(revenueCatEventToEntitlement({ type }, NOW).kind).toBe("noop");
    });
  }

  it("unknown event type → ignore", () => {
    expect(revenueCatEventToEntitlement({ type: "WAT" }, NOW).kind).toBe("ignore");
  });
});
