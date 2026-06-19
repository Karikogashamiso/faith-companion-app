/**
 * Region-aware price *display*. The actual charge is set per-store in
 * RevenueCat; this localizes what we show so prices feel fair in each market
 * (Hallow adjusts Poland/Philippines rather than charging US prices globally,
 * and growth is highest in LatAm/PH). Pure + locale-injectable for testing.
 *
 * Amounts are PPP-adjusted price points in each market's local currency.
 */

export type LocalPricing = {
  region: string;
  currency: string;
  weekly: string;
  monthly: string;
  annual: string;
  annualPerMonth: string;
  /** % saved by paying annually instead of 12× monthly (rounded). */
  annualSavingsPct: number;
};

const MARKETS: Record<
  string,
  { currency: string; weekly: number; monthly: number; annual: number; locale: string }
> = {
  US: { currency: "USD", weekly: 2.99, monthly: 4.99, annual: 39.99, locale: "en-US" },
  GB: { currency: "GBP", weekly: 2.49, monthly: 3.99, annual: 32.99, locale: "en-GB" },
  PH: { currency: "PHP", weekly: 49, monthly: 149, annual: 999, locale: "en-PH" },
  IN: { currency: "INR", weekly: 99, monthly: 299, annual: 1999, locale: "en-IN" },
  BR: { currency: "BRL", weekly: 7.9, monthly: 19.9, annual: 119, locale: "pt-BR" },
  MX: { currency: "MXN", weekly: 39, monthly: 99, annual: 699, locale: "es-MX" },
  NG: { currency: "NGN", weekly: 900, monthly: 2500, annual: 17000, locale: "en-NG" },
  PL: { currency: "PLN", weekly: 9.99, monthly: 24.99, annual: 159, locale: "pl-PL" },
};

/** Pull the region subtag from a BCP-47 locale ("en-PH" → "PH"); US fallback. */
export function regionFromLocale(locale: string | undefined): string {
  const region = locale?.split("-")[1]?.toUpperCase();
  return region && MARKETS[region] ? region : "US";
}

export function getLocalizedPricing(locale?: string): LocalPricing {
  const resolved =
    locale ??
    (typeof navigator !== "undefined" ? navigator.language : "en-US");
  const region = regionFromLocale(resolved);
  const m = MARKETS[region];
  const fmt = (n: number) =>
    new Intl.NumberFormat(m.locale, {
      style: "currency",
      currency: m.currency,
      maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
    }).format(n);
  return {
    region,
    currency: m.currency,
    weekly: fmt(m.weekly),
    monthly: fmt(m.monthly),
    annual: fmt(m.annual),
    annualPerMonth: fmt(Math.round((m.annual / 12) * 100) / 100),
    annualSavingsPct: Math.round((1 - m.annual / (m.monthly * 12)) * 100),
  };
}
