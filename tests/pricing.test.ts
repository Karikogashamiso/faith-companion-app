import { describe, expect, it } from "bun:test";
import { getLocalizedPricing, regionFromLocale } from "../src/lib/pricing";

describe("regionFromLocale", () => {
  it("extracts a known region subtag", () => {
    expect(regionFromLocale("en-PH")).toBe("PH");
    expect(regionFromLocale("pt-BR")).toBe("BR");
  });
  it("falls back to US for unknown or missing regions", () => {
    expect(regionFromLocale("en-ZZ")).toBe("US");
    expect(regionFromLocale("en")).toBe("US");
    expect(regionFromLocale(undefined)).toBe("US");
  });
});

describe("getLocalizedPricing", () => {
  it("prices in the local currency for a known market", () => {
    const ph = getLocalizedPricing("en-PH");
    expect(ph.region).toBe("PH");
    expect(ph.currency).toBe("PHP");
    expect(ph.weekly).toContain("49");
  });
  it("defaults to USD", () => {
    const us = getLocalizedPricing("en-US");
    expect(us.currency).toBe("USD");
    expect(us.monthly).toContain("4.99");
  });
  it("computes a per-month figure for the annual plan", () => {
    const us = getLocalizedPricing("en-US");
    expect(us.annualPerMonth).toContain("3.33");
  });
});
