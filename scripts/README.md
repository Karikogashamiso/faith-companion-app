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

## Bible translations (the common options)

The catalog seeds the **public-domain** translations across traditions —
these you can ship freely (load text with the ingest script below):

| Abbr | Translation | Tradition | Status |
|------|-------------|-----------|--------|
| WEB   | World English Bible | General (modern) | Public domain — ship now |
| WEBBE | World English Bible, British & Catholic Ed. | Incl. Deuterocanon | Public domain |
| KJV   | King James Version | Protestant (classic) | Public domain |
| ASV   | American Standard Version | Protestant | Public domain |
| YLT   | Young's Literal Translation | Study/literal | Public domain |
| DBY   | Darby Translation | Study/literal | Public domain |
| BBE   | Bible in Basic English | Simple English/ESL | Public domain |
| DRA   | Douay-Rheims | **Catholic** canon | Public domain |

Seeded rows are hidden in the reader until they have verse text. Ingest each
with the same script, overriding the version:

```bash
VERSION_ABBR=KJV VERSION_NAME="King James Version" \
SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… WEB_BIBLE_JSON=./kjv.json \
  node scripts/ingest-web-bible.mjs
```

### Licensed translations (require a publisher agreement)

The most-requested modern versions are **copyrighted** — do **not** load their
text without a signed license. The six most popular (NIV, ESV, NLT, NKJV, NASB,
CSB) are already **catalogued** with `is_public_domain=false`, so they're ready
to enable the moment you license them: just ingest the text exactly like the
public-domain versions above. They stay hidden in the in-app picker until
verses exist, so an un-licensed row never shows up empty.

| Translation | Catalog row | Publisher to license from |
|-------------|-------------|---------------------------|
| NIV | seeded (NIV) | Biblica / Zondervan |
| ESV | seeded (ESV) | Crossway |
| NLT | seeded (NLT) | Tyndale House |
| NKJV | seeded (NKJV) | Thomas Nelson (HarperCollins) |
| NASB | seeded (NASB) | The Lockman Foundation |
| CSB | seeded (CSB) | Holman / Lifeway |
| AMP | add as above | The Lockman Foundation |
| NABRE, NRSV-CE | add as above | (Catholic) USCCB / NCC |

Many publishers also offer the **API.Bible** (American Bible Society) gateway,
which can simplify licensing several at once.
