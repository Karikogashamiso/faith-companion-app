# Web push notifications — setup

Reminders (daily verse / prayer) now deliver **even when the app is closed**,
via the Web Push protocol. Implemented dependency-free with `node:crypto`
(VAPID + RFC 8291 `aes128gcm`), proven correct by a round-trip test
(`tests/web-push.test.ts`).

## Pieces

| Piece | File |
|-------|------|
| Service worker (shows notifications) | `public/sw.js` |
| Client subscribe/unsubscribe hook | `src/lib/use-push.ts` |
| Store subscriptions (server fns) | `src/lib/push.functions.ts` |
| Send pipeline (VAPID + encryption) | `src/lib/web-push.server.ts` |
| Timezone-aware "is it due?" logic | `src/lib/push-schedule.ts` |
| Scheduled sender (cron target) | `/api/cron/push-due` |
| Subscriptions table + reminder tz | migration `20260617050000_web_push.sql` |

## 1. Generate VAPID keys (once)

```bash
node scripts/gen-vapid-keys.mjs
```

Set the output as environment variables:

```
VAPID_PUBLIC_KEY=…        # server (signing)
VAPID_PRIVATE_KEY=…       # server only — secret
VITE_VAPID_PUBLIC_KEY=…   # SAME public key, exposed to the browser
VAPID_SUBJECT=mailto:you@yourdomain.com
CRON_SECRET=…             # any long random string
```

If `VITE_VAPID_PUBLIC_KEY` is unset, the "Background delivery" toggle simply
doesn't show — nothing breaks.

## 2. Apply the migration

Run `supabase/_apply_new_migrations.sql` (or the `20260617050000_web_push.sql`
block). It adds `push_subscriptions` and gives `reminders` a `tz` +
`last_pushed_on`. Regenerate types afterward.

## 3. Schedule the sender

Point any scheduler at the cron endpoint, **every ~5 minutes**:

```
POST https://<your-project>.lovable.app/api/cron/push-due
Authorization: Bearer <CRON_SECRET>
```

Options: cron-job.org, a GitHub Actions `schedule` workflow, or Supabase
`pg_cron` + `pg_net`. The endpoint:

1. Loads all enabled reminders.
2. For each, computes the user's **local** time from the reminder's timezone.
3. If due (once per local day, within a 2-hour catch-up window), sends a push
   to every device the user has registered.
4. Prunes dead subscriptions (HTTP 404/410).

## How a user turns it on

Reminders screen → **Background delivery → Turn on**. This registers the
service worker, asks for notification permission, subscribes via `PushManager`,
and stores the subscription. The timezone is captured automatically when a
reminder is created.

## Notes / limits

- iOS Safari supports Web Push only for **installed PWAs** (Add to Home Screen),
  iOS 16.4+. Desktop Chrome/Firefox/Edge and Android Chrome work directly.
- This is the web path. Native iOS/Android push (APNs/FCM) comes with the Expo
  shell in a later step and would reuse the same `reminders` data.
