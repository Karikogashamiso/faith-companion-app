import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/app-shell";
import { Icon } from "@/components/app/icon";

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
    <AppShell title="Bible">
      <div className="space-y-stack-md">
        {/* Reference & translation selectors, styled as soft chips */}
        <div className="flex flex-wrap items-center gap-2">
          <SelectChip
            icon="bookmark"
            value={book}
            onChange={setBook}
            options={books.map((b) => ({ value: b, label: b }))}
          />
          <SelectChip
            value={String(chapter)}
            onChange={(v) => setChapter(Number(v))}
            options={chapters.map((c) => ({
              value: String(c),
              label: `Chapter ${c}`,
            }))}
          />
          <SelectChip
            icon="translate"
            value={versionId ?? ""}
            onChange={setVersionId}
            options={versions.map((v) => ({
              value: v.id,
              label: v.abbreviation,
            }))}
          />
        </div>

        <header className="border-b border-divider-soft pb-stack-sm">
          <h1 className="font-serif text-3xl text-primary">
            {book} {chapter}
          </h1>
        </header>

        {/* Scripture body — serif, generous line-height for meditative reading */}
        <article className="space-y-1 font-serif text-[19px] leading-9 text-on-surface">
          {verses.length === 0 ? (
            <p className="font-sans text-on-surface-variant">
              No verses for this chapter in the current translation.
            </p>
          ) : (
            verses.map((v) => (
              <p
                key={v.id}
                onClick={() => setSelected(v)}
                className={`-mx-2 cursor-pointer rounded-lg px-2 py-1 transition-colors hover:bg-surface-container ${
                  highlights.has(v.id) ? "bg-secondary-container/40" : ""
                }`}
              >
                <sup className="mr-1.5 align-super font-sans text-xs font-bold text-wood-warm">
                  {v.verse}
                </sup>
                {v.text}
              </p>
            ))
          )}
        </article>
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-primary/40 backdrop-blur-sm sm:items-center"
          onClick={() => setSelected(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md space-y-4 rounded-t-xl border border-divider-soft bg-scripture-cream p-6 shadow-[0_4px_20px_rgba(4,22,46,0.08)] sm:rounded-xl"
          >
            <span className="inline-flex items-center gap-1 rounded-lg bg-crisis-blue px-2.5 py-1 text-xs font-bold text-primary">
              {selected.book} {selected.chapter}:{selected.verse}
            </span>
            <p className="font-serif text-lg leading-relaxed text-on-surface">
              {selected.text}
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                onClick={() => {
                  void toggleHighlight(selected);
                  setSelected(null);
                }}
                className="flex h-10 items-center gap-1.5 rounded-lg border border-divider-soft bg-white px-3 text-sm font-medium text-primary hover:border-wood-warm"
              >
                <Icon name="ink_highlighter" className="text-base" />
                {highlights.has(selected.id) ? "Remove highlight" : "Highlight"}
              </button>
              <button
                onClick={() => {
                  void navigator.clipboard?.writeText(
                    `${selected.text} — ${selected.book} ${selected.chapter}:${selected.verse}`,
                  );
                }}
                className="flex h-10 items-center gap-1.5 rounded-lg border border-divider-soft bg-white px-3 text-sm font-medium text-primary hover:border-wood-warm"
              >
                <Icon name="content_copy" className="text-base" />
                Copy
              </button>
              <button
                onClick={() => setSelected(null)}
                className="ml-auto flex h-10 items-center rounded-lg px-3 text-sm text-on-surface-variant hover:text-primary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function SelectChip({
  value,
  onChange,
  options,
  icon,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  icon?: string;
}) {
  return (
    <div className="relative inline-flex items-center gap-1.5 rounded-lg border border-divider-soft bg-white px-3 py-2 text-sm font-semibold text-primary">
      {icon && <Icon name={icon} className="text-base text-wood-warm" />}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer appearance-none bg-transparent pr-4 font-semibold text-primary focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Icon
        name="expand_more"
        className="pointer-events-none absolute right-2 text-base text-outline"
      />
    </div>
  );
}
