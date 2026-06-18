import { describe, expect, it } from "bun:test";
import { createHmac } from "node:crypto";
import {
  subStatusToTier,
  subPeriodEndMs,
  verifyStripeSignature,
} from "../src/lib/stripe.server";

const SECRET = "whsec_test_secret";

function sign(body: string, secret = SECRET, t = Math.floor(Date.now() / 1000)) {
  const v1 = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  return `t=${t},v1=${v1}`;
}

describe("subStatusToTier", () => {
  it("treats active and trialing as companion", () => {
    expect(subStatusToTier("active")).toBe("companion");
    expect(subStatusToTier("trialing")).toBe("companion");
  });
  it("treats dunning states as grace (keep access)", () => {
    expect(subStatusToTier("past_due")).toBe("grace");
    expect(subStatusToTier("unpaid")).toBe("grace");
  });
  it("treats terminal/incomplete states as free", () => {
    expect(subStatusToTier("canceled")).toBe("free");
    expect(subStatusToTier("incomplete")).toBe("free");
    expect(subStatusToTier("incomplete_expired")).toBe("free");
    expect(subStatusToTier("anything_else")).toBe("free");
  });
});

describe("subPeriodEndMs", () => {
  it("reads the top-level current_period_end", () => {
    expect(subPeriodEndMs({ current_period_end: 1_700_000_000 })).toBe(1_700_000_000_000);
  });
  it("falls back to the subscription item period end", () => {
    const sub = { items: { data: [{ current_period_end: 1_700_000_500 }] } };
    expect(subPeriodEndMs(sub)).toBe(1_700_000_500_000);
  });
  it("returns null when neither is present", () => {
    expect(subPeriodEndMs({})).toBeNull();
    expect(subPeriodEndMs({ items: { data: [{}] } })).toBeNull();
  });
});

describe("verifyStripeSignature", () => {
  const body = JSON.stringify({ id: "evt_1", type: "checkout.session.completed" });

  it("accepts a correctly signed payload", () => {
    expect(verifyStripeSignature(body, sign(body), SECRET)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const header = sign(body);
    expect(verifyStripeSignature(body + "x", header, SECRET)).toBe(false);
  });

  it("rejects a wrong secret", () => {
    expect(verifyStripeSignature(body, sign(body, "whsec_other"), SECRET)).toBe(false);
  });

  it("rejects a missing or malformed header", () => {
    expect(verifyStripeSignature(body, null, SECRET)).toBe(false);
    expect(verifyStripeSignature(body, "t=123", SECRET)).toBe(false);
    expect(verifyStripeSignature(body, "v1=abc", SECRET)).toBe(false);
  });

  it("rejects a stale timestamp (replay) outside tolerance", () => {
    const old = Math.floor(Date.now() / 1000) - 10_000;
    expect(verifyStripeSignature(body, sign(body, SECRET, old), SECRET)).toBe(false);
  });

  it("accepts an old timestamp when tolerance is widened", () => {
    const old = Math.floor(Date.now() / 1000) - 10_000;
    expect(verifyStripeSignature(body, sign(body, SECRET, old), SECRET, 20_000)).toBe(true);
  });
});
