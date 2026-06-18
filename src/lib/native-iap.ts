/**
 * Native in-app purchases via RevenueCat, used ONLY inside the Capacitor native
 * shell. The web build never depends on the RevenueCat plugin: it's loaded with
 * a runtime dynamic import behind an `isNativePlatform()` guard, so on the web
 * this module is inert and the app falls back to Stripe checkout.
 *
 * Flow: purchase here → RevenueCat → the existing /api/public/hooks/revenuecat
 * webhook writes the `entitlements` row → the app reflects Companion. We set the
 * RevenueCat appUserID to the Supabase auth uid so the webhook reconciles cleanly.
 */
import { isNativePlatform, nativePlatform } from "./native";

// Dynamic, non-statically-analyzable specifier so bundlers never try to resolve
// the native-only package at web build time.
const RC_PACKAGE = "@revenuecat/purchases-capacitor";

async function loadPurchases(): Promise<any | null> {
  if (!isNativePlatform()) return null;
  try {
    const mod: any = await import(/* @vite-ignore */ RC_PACKAGE);
    return mod.Purchases ?? null;
  } catch {
    return null;
  }
}

let configured = false;

/** Configure the RevenueCat SDK with the public store key + the user's uid. */
export async function configureIap(appUserId: string): Promise<boolean> {
  if (configured || !isNativePlatform()) return configured;
  const Purchases = await loadPurchases();
  if (!Purchases) return false;
  const apiKey =
    nativePlatform() === "ios"
      ? (import.meta.env.VITE_RC_IOS_KEY as string | undefined)
      : (import.meta.env.VITE_RC_ANDROID_KEY as string | undefined);
  if (!apiKey) return false;
  try {
    await Purchases.configure({ apiKey, appUserID: appUserId });
    configured = true;
    return true;
  } catch {
    return false;
  }
}

export type PurchaseResult = { ok: boolean; reason?: string; message?: string };

/** Buy a plan by its store product identifier (e.g. "companion_monthly"). */
export async function purchasePlan(planId: string): Promise<PurchaseResult> {
  if (!isNativePlatform()) return { ok: false, reason: "not_native" };
  const Purchases = await loadPurchases();
  if (!Purchases) return { ok: false, reason: "unavailable" };
  try {
    const offerings = await Purchases.getOfferings();
    const pkgs = offerings?.current?.availablePackages ?? [];
    const pkg =
      pkgs.find(
        (p: any) => p.product?.identifier === planId || p.identifier === planId,
      ) ?? null;
    if (!pkg) return { ok: false, reason: "no_offering" };
    await Purchases.purchasePackage({ aPackage: pkg });
    return { ok: true };
  } catch (e: any) {
    // RevenueCat surfaces user cancellation distinctly; treat it as a quiet no-op.
    if (e?.userCancelled || e?.code === "PURCHASE_CANCELLED") {
      return { ok: false, reason: "cancelled" };
    }
    return { ok: false, reason: "error", message: e?.message };
  }
}

/** Restore previous purchases (App Store / Play). */
export async function restoreNative(): Promise<{ ok: boolean }> {
  const Purchases = await loadPurchases();
  if (!Purchases) return { ok: false };
  try {
    await Purchases.restorePurchases();
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
