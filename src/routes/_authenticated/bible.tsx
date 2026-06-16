import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/bible")({
  head: () => ({ meta: [{ title: "Bible · Discipleship Companion" }] }),
  component: Bible,
});

type Version = { id: string; name: string; abbreviation: string };
type Verse = { id: number; book: string; chapter: number; verse: number; text: string };

function Bible() {
  const [versions, setVersions] = useState<Version[]>([]);
  const [versionId, setVersionId] = useState<string | null>(null);
  const [book, setBook] = useState<string>("");
  const [chapter, setChapter] = useState<number>(1);
  const [verses, setVerses] = useState<Verse[]>([]);
  const [highlights, setHighlights] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<Verse | null>(null);

  useEffect(() => {
    void (async () => {
      const { data: vs } = await supabase
        .from("bible_versions")
        .select("id, name, abbreviation");
      setVersions((vs ?? []) as Version[]);
      const { data: u } = await supabase.auth.getUser();
      let vid: string | null = null;
      if (u.user) {
        const { data: p } = await supabase
          .from("profiles")
          .select("default_version_id")
          .eq("id", u.user.id)
          .maybeSingle();
        vid = (p?.default_version_id as string | null) ?? null;
      }
      vid = vid ?? (vs?.[0]?.id ?? null);
      setVersionId(vid);
    })();
  }, []);

  // Load books for selected version
  const [books, setBooks] = useState<string[]>([]);
  useEffect(() => {
    if (!versionId) return;
    void (async () => {
      const { data } = await supabase
        .from("verses")
        .select("book")
        .eq("version_id", versionId);
      const uniq = Array.from(new Set((data ?? []).map((r: any) => r.book as string)));
      setBooks(uniq);
      if (uniq.length && !uniq.includes(book)) setBook(uniq[0]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versionId]);

  // Load chapter verses
  useEffect(() => {
    if (!versionId || !book) return;
    void (async () => {
      const { data } = await supabase
        .from("verses")
        .select("id, book, chapter, verse, text")
        .eq("version_id", versionId)
        .eq("book", book)
        .eq("chapter", chapter)
        .order("verse");
      setVerses((data ?? []) as Verse[]);
      const { data: u } = await supabase.auth.getUser();
      if (u.user && data?.length) {
        const { data: h } = await supabase
          .from("user_highlights")
          .select("verse_id")
          .eq("user_id", u.user.id)
          .in("verse_id", data.map((v: any) => v.id));
        setHighlights(new Set((h ?? []).map((x: any) => x.verse_id)));
      }
    })();
  }, [versionId, book, chapter]);

  const chapters = useMemo(() => {
    // best-effort: 1..max found in DB; for small seed just 1..10
    return Array.from({ length: 50 }, (_, i) => i + 1);
  }, []);

  async function toggleHighlight(v: Verse) {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    if (highlights.has(v.id)) {
      await supabase
        .from("user_highlights")
        .delete()
        .eq("user_id", u.user.id)
        .eq("verse_id", v.id);
      const next = new Set(highlights);
      next.delete(v.id);
      setHighlights(next);
    } else {
      await supabase
        .from("user_highlights")
        .insert({ user_id: u.user.id, verse_id: v.id });
      setHighlights(new Set([...highlights, v.id]));
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Bible</h1>
        <Link to="/home" className="text-sm text-muted-foreground hover:text-foreground">
          ← Today
        </Link>
      </header>

      <div className="flex flex-wrap gap-2">
        <select
          value={versionId ?? ""}
          onChange={(e) => setVersionId(e.target.value)}
          className="rounded border bg-background px-3 py-2 text-sm"
        >
          {versions.map((v) => (
            <option key={v.id} value={v.id}>
              {v.abbreviation} — {v.name}
            </option>
          ))}
        </select>
        <select
          value={book}
          onChange={(e) => setBook(e.target.value)}
          className="rounded border bg-background px-3 py-2 text-sm"
        >
          {books.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <select
          value={chapter}
          onChange={(e) => setChapter(Number(e.target.value))}
          className="rounded border bg-background px-3 py-2 text-sm"
        >
          {chapters.map((c) => (
            <option key={c} value={c}>
              Chapter {c}
            </option>
          ))}
        </select>
      </div>

      <article className="space-y-2 leading-relaxed">
        {verses.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No verses for this chapter in the current translation.
          </p>
        ) : (
          verses.map((v) => (
            <p
              key={v.id}
              onClick={() => setSelected(v)}
              className={`cursor-pointer rounded px-2 py-1 -mx-2 hover:bg-muted ${
                highlights.has(v.id) ? "bg-yellow-100 dark:bg-yellow-900/30" : ""
              }`}
            >
              <sup className="mr-1 text-xs text-muted-foreground">{v.verse}</sup>
              {v.text}
            </p>
          ))
        )}
      </article>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
          onClick={() => setSelected(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md space-y-3 rounded-t-xl bg-background p-5 sm:rounded-xl"
          >
            <p className="text-xs text-muted-foreground">
              {selected.book} {selected.chapter}:{selected.verse}
            </p>
            <p className="text-base leading-relaxed">{selected.text}</p>
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                onClick={() => {
                  void toggleHighlight(selected);
                  setSelected(null);
                }}
                className="h-9 rounded-md border px-3 text-sm hover:bg-muted"
              >
                {highlights.has(selected.id) ? "Remove highlight" : "Highlight"}
              </button>
              <button
                onClick={() => {
                  void navigator.clipboard?.writeText(
                    `${selected.text} — ${selected.book} ${selected.chapter}:${selected.verse}`,
                  );
                }}
                className="h-9 rounded-md border px-3 text-sm hover:bg-muted"
              >
                Copy
              </button>
              <button
                onClick={() => setSelected(null)}
                className="ml-auto h-9 rounded-md px-3 text-sm text-muted-foreground hover:text-foreground"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
