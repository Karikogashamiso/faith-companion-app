# Operations: reminder cron + audio library

## Automatic reminder push (GitHub Actions)

`.github/workflows/push-reminders.yml` calls `/api/cron/push-due` every ~5
minutes so closed-app reminders go out without a manual trigger.

Set two repo secrets (Settings → Secrets and variables → Actions):

- `APP_URL` — your deployment origin, e.g. `https://your-project.lovable.app`
- `CRON_SECRET` — the same value as the app's `CRON_SECRET` env var

You can also run it on demand from the Actions tab (workflow_dispatch). Prefer a
different scheduler? Any cron that POSTs to `/api/cron/push-due` with the bearer
secret works (cron-job.org, Supabase pg_cron + pg_net, etc.).

## Audio library (premium content — the main paywalled asset)

The Listen tab ships with a seeded catalog but no audio files. Fill it from the
app:

1. Grant yourself the **admin** role: insert a row into `public.user_roles`
   (`user_id` = your auth id, `role` = `'admin'`).
2. Apply the migrations (the bundle creates the public `audio` Storage bucket
   and admin write policies).
3. Go to **/admin → Manage audio library** (or `/admin/audio`).
4. **Add a track** (title, category, length, free/Companion), then **Upload
   audio** on that row — the file goes to the `audio` bucket and its public URL
   is saved to `audio_tracks.audio_url`. Toggle free vs Companion per track.

Categories: `prayer`, `scripture`, `sleep`, `worship`. Free tracks act as the
hook; the rest sit behind Companion. Licensing is your responsibility — only
upload audio you have the right to distribute.

> Files are public (so they stream without per-request auth), but uploads,
> edits, and deletes are admin-only via `has_role`.
