#!/usr/bin/env node
/**
 * Full-Bible ingestion for the World English Bible (WEB, public domain).
 *
 * The seed migration ships only ~37 curated verses so the app is buildable.
 * This script loads a complete translation into `public.verses` so the
 * reader, search, and AI retrieval actually have Scripture to work with.
 *
 * USAGE
 *   SUPABASE_URL=...                # your project URL
 *   SUPABASE_SERVICE_ROLE_KEY=...   # service role (server-only secret)
 *   WEB_BIBLE_JSON=./web.json       # local file  (OR)
 *   WEB_BIBLE_URL=https://.../web.json   # remote source
 *   node scripts/ingest-web-bible.mjs
 *
 * EXPECTED INPUT
 *   A JSON array of verse objects. The script is permissive about field
 *   names and accepts any of:
 *     { book, chapter, verse, text }
 *     { book_name, chapter, verse, text }
 *     { b, c, v, t }
 *   Book names are normalized to the app's canonical forms (e.g. "Psalm" →
 *   "Psalms", "Song of Songs" → "Song of Solomon", "1 Cor" → "1 Corinthians").
 *
 * AFTER RUNNING
 *   Generate embeddings for semantic retrieval by invoking the in-app admin
 *   job `embedVerses` (see src/lib/ai-study.functions.ts) in batches until it
 *   reports done. Until then, retrieval falls back to full-text search.
 */

import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, WEB_BIBLE_JSON, WEB_BIBLE_URL } =
  process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
if (!WEB_BIBLE_JSON && !WEB_BIBLE_URL) {
  console.error("Provide WEB_BIBLE_JSON (local path) or WEB_BIBLE_URL (remote).");
  process.exit(1);
}

// Canonical book names, matching the aliases the AI guardrail normalizes to
// (src/lib/bible-refs.server.ts). DB book names MUST use these exact strings
// so citation validation lines up.
const CANON = new Map(
  Object.entries({
    genesis: "Genesis", exodus: "Exodus", leviticus: "Leviticus",
    numbers: "Numbers", deuteronomy: "Deuteronomy", joshua: "Joshua",
    judges: "Judges", ruth: "Ruth",
    "1samuel": "1 Samuel", "2samuel": "2 Samuel",
    "1kings": "1 Kings", "2kings": "2 Kings",
    "1chronicles": "1 Chronicles", "2chronicles": "2 Chronicles",
    ezra: "Ezra", nehemiah: "Nehemiah", esther: "Esther", job: "Job",
    psalm: "Psalms", psalms: "Psalms",
    proverbs: "Proverbs", ecclesiastes: "Ecclesiastes",
    songofsolomon: "Song of Solomon", songofsongs: "Song of Solomon",
    isaiah: "Isaiah", jeremiah: "Jeremiah", lamentations: "Lamentations",
    ezekiel: "Ezekiel", daniel: "Daniel", hosea: "Hosea", joel: "Joel",
    amos: "Amos", obadiah: "Obadiah", jonah: "Jonah", micah: "Micah",
    nahum: "Nahum", habakkuk: "Habakkuk", zephaniah: "Zephaniah",
    haggai: "Haggai", zechariah: "Zechariah", malachi: "Malachi",
    matthew: "Matthew", mark: "Mark", luke: "Luke", john: "John",
    acts: "Acts", romans: "Romans",
    "1corinthians": "1 Corinthians", "2corinthians": "2 Corinthians",
    galatians: "Galatians", ephesians: "Ephesians", philippians: "Philippians",
    colossians: "Colossians",
    "1thessalonians": "1 Thessalonians", "2thessalonians": "2 Thessalonians",
    "1timothy": "1 Timothy", "2timothy": "2 Timothy",
    titus: "Titus", philemon: "Philemon", hebrews: "Hebrews", james: "James",
    "1peter": "1 Peter", "2peter": "2 Peter",
    "1john": "1 John", "2john": "2 John", "3john": "3 John",
    jude: "Jude", revelation: "Revelation",
  }),
);

function canonBook(raw) {
  if (!raw) return null;
  const key = String(raw).toLowerCase().replace(/[\s.]+/g, "");
  return CANON.get(key) ?? null;
}

function pickField(row, ...names) {
  for (const n of names) if (row[n] != null) return row[n];
  return undefined;
}

async function loadSource() {
  if (WEB_BIBLE_JSON) {
    return JSON.parse(await readFile(WEB_BIBLE_JSON, "utf8"));
  }
  const res = await fetch(WEB_BIBLE_URL);
  if (!res.ok) throw new Error(`Fetch ${WEB_BIBLE_URL} → ${res.status}`);
  return res.json();
}

// Which translation to load — defaults to WEB; override for KJV/ASV/DRA/etc.
const ABBR = process.env.VERSION_ABBR || "WEB";
const VNAME = process.env.VERSION_NAME || "World English Bible";
const VLICENSE = process.env.VERSION_LICENSE || "Public domain";

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  console.log(`Ingesting translation: ${ABBR} (${VNAME})`);

  // Ensure the target version row exists.
  let { data: version } = await supabase
    .from("bible_versions")
    .select("id")
    .eq("abbreviation", ABBR)
    .maybeSingle();
  if (!version) {
    const { data, error } = await supabase
      .from("bible_versions")
      .insert({
        name: VNAME,
        abbreviation: ABBR,
        language: "en",
        license_notes: VLICENSE,
        is_public_domain: true,
      })
      .select("id")
      .single();
    if (error) throw error;
    version = data;
  }

  const raw = await loadSource();
  const source = Array.isArray(raw) ? raw : raw.verses ?? [];
  console.log(`Source rows: ${source.length}`);

  const rows = [];
  const unknownBooks = new Set();
  for (const r of source) {
    const book = canonBook(pickField(r, "book", "book_name", "b", "name"));
    const chapter = Number(pickField(r, "chapter", "c", "chap"));
    const verse = Number(pickField(r, "verse", "v", "num"));
    const text = String(pickField(r, "text", "t", "content") ?? "").trim();
    if (!book) {
      unknownBooks.add(pickField(r, "book", "book_name", "b", "name"));
      continue;
    }
    if (!Number.isInteger(chapter) || !Number.isInteger(verse) || !text) continue;
    rows.push({ version_id: version.id, book, chapter, verse, text });
  }

  if (unknownBooks.size) {
    console.warn(
      `Skipped unrecognized books: ${[...unknownBooks].slice(0, 20).join(", ")}`,
    );
  }
  console.log(`Prepared ${rows.length} verses for upsert.`);

  const CHUNK = 500;
  let done = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK);
    const { error } = await supabase
      .from("verses")
      .upsert(batch, { onConflict: "version_id,book,chapter,verse" });
    if (error) throw error;
    done += batch.length;
    process.stdout.write(`\rUpserted ${done}/${rows.length}`);
  }
  process.stdout.write("\n");
  console.log("Done. Next: run the in-app admin `embedVerses` job to backfill embeddings.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
