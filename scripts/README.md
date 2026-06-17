# Operator scripts

## Load the full Bible (`ingest-web-bible.mjs`)

The seed migration ships only ~37 curated WEB verses so the project builds and
the AI demo has something to retrieve. Before launch you must load a complete
translation so the reader, search, and AI retrieval have real Scripture.

The World English Bible (WEB) is public domain — no licensing required.

### 1. Get a WEB verse dump

Use any WEB JSON dump that is (or can be flattened to) a list of verses with
`book`, `chapter`, `verse`, `text`. Field-name variants (`book_name`, `b/c/v/t`,
`content`) are accepted. Book names are normalized to the app's canonical forms.

### 2. Run the ingest

```bash
export SUPABASE_URL="https://YOUR-PROJECT.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="…"          # server-only secret, never ship to client
export WEB_BIBLE_JSON="./web.json"            # local file
# or: export WEB_BIBLE_URL="https://…/web.json"

node scripts/ingest-web-bible.mjs
```

It creates the `WEB` row in `bible_versions` if missing, then upserts every
verse in batches of 500 (idempotent — safe to re-run).

### 3. Backfill embeddings (enables semantic search)

Until embeddings exist, AI retrieval falls back to full-text search. Generate
them with the in-app admin job `embedVerses`
(`src/lib/ai-study.functions.ts`), called in batches until it returns
`{ done: true }`. The caller must hold the `admin` role and `LOVABLE_API_KEY`
must be configured.

> The same script works for any additional public-domain translation; for
> licensed translations (NIV, ESV, …) confirm distribution rights first and set
> `bible_versions.is_public_domain = false`.
