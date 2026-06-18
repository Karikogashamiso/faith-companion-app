# Native iOS & Android app (Capacitor + RevenueCat)

This ships the **existing web app** as native iOS/Android apps via **Capacitor**
— no UI rewrite. The same screens run inside a native shell that adds in-app
purchases (RevenueCat) and native push. The web build is unaffected: the native
bridge (`src/lib/native.ts`, `src/lib/native-iap.ts`) loads the RevenueCat
plugin only at runtime inside the shell, so `bun install` / the web build never
depend on any Capacitor package.

> **Why Capacitor, not Expo/React Native?** The app is already a complete web
> app. Capacitor wraps it as-is; Expo would mean rebuilding every screen in
> React Native. Capacitor reuses 100% of the work.

## How billing routes itself

| Surface | Purchase path | Records entitlement via |
|---------|---------------|--------------------------|
| Web browser | Stripe Checkout | Stripe webhook |
| iOS / Android app | RevenueCat IAP (required by the stores) | RevenueCat webhook (already built) |

`companion.tsx` calls `isNativePlatform()` and picks the right path. Both write
the **same `entitlements` table**, so the rest of the app is billing-agnostic.

## Prerequisites (on your machine, not the cloud sandbox)

- Node 18+, and either Xcode (iOS) or Android Studio (Android).
- Apple Developer account ($99/yr) and/or Google Play Console ($25 once).
- A RevenueCat account (free tier is fine).

## 1. Install Capacitor + plugins

```bash
npm install @capacitor/core @capacitor/cli \
  @capacitor/ios @capacitor/android \
  @capacitor/push-notifications \
  @revenuecat/purchases-capacitor
```

`capacitor.config.json` is already committed (appId `app.faithcompanion`).
Change `appId`/`appName` if you want your own bundle id.

## 2. Choose how the shell loads the app

This is an SSR app, so the simplest, most reliable option is to point the shell
at your **hosted** deployment. Add this to `capacitor.config.json`:

```jsonc
"server": {
  "url": "https://YOUR-PROJECT.lovable.app",
  "androidScheme": "https"
}
```

(Alternatively, produce a static client build and set `webDir` to its output —
more work with SSR; the hosted URL is recommended to start.)

## 3. Add the platforms

```bash
npx cap add ios
npx cap add android
npx cap sync
```

## 4. Configure RevenueCat

1. In RevenueCat, create an app for iOS and one for Android.
2. Create products in App Store Connect / Play Console with identifiers that
   match the plan ids the app requests: `companion_weekly`, `companion_monthly`,
   `companion_annual` (or map them in RevenueCat offerings).
3. Put the products in a RevenueCat **Offering** marked *current*.
4. Set the **public SDK keys** as env vars (safe in the client):
   - `VITE_RC_IOS_KEY`, `VITE_RC_ANDROID_KEY`
5. Point the RevenueCat **webhook** at
   `https://YOUR-PROJECT.lovable.app/api/public/hooks/revenuecat` with the
   `Authorization: Bearer <REVENUECAT_WEBHOOK_AUTH>` header (already implemented).

Because we call `Purchases.configure({ appUserID: <supabase uid> })`, the
webhook's `app_user_id` matches `auth.users.id` and reconciles automatically.

## 5. Run / build

```bash
npx cap open ios       # opens Xcode → run on a device/simulator
npx cap open android   # opens Android Studio
```

Test a sandbox purchase; confirm the `entitlements` row flips to `companion`
(via the RevenueCat webhook) and the app shows Companion.

## 6. Native push (optional, later)

`@capacitor/push-notifications` gives APNs/FCM tokens. That's a separate delivery
channel from web push (it would post to APNs/FCM rather than the Web Push
endpoints). The reminder data model already exists; wiring native tokens is a
follow-up. Web push (PWA) already works today — see `docs/PUSH_SETUP.md`.

## 7. Store submission checklist

- App icons & splash (`npx @capacitor/assets generate`).
- Privacy policy URL + data-safety / privacy-nutrition labels (you collect
  email, prayer, reading, and AI history — declare accordingly).
- Subscription metadata, screenshots, and review notes (give reviewers a test
  account; mention AI study is citation-locked).
- iOS: enable In-App Purchase capability; Android: upload to a testing track first.
