import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/app-shell";
import { Icon } from "@/components/app/icon";
import { Button, Sheet } from "@/components/app/ui";

export const Route = createFileRoute("/_authenticated/bible")({
  head: () => ({ meta: [{ title: "Bible · Discipleship Companion" }] }),
  component: Bible,
});

type Version = { id: string; name: string; abbreviation: string };
type Verse = { id: number; book: string; chapter: number; verse: number; text: string };

function Bible() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [versions, setVersions] = useState<Version[]>([]);
  const [versionId, setVersionId] = useState<string | null>(null);
  const [book, setBook] = useState<string>("");
  const [chapter, setChapter] = useState<number>(1);
  const [verses, setVerses] = useState<Verse[]>([]);
  const [highlights, setHighlights] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<Verse | null>(null);
  const [books, setBooks] = useState<string[]>([]);
  const [bookChapters, setBookChapters] = useState<Record<string, number>>({});

  useEffect(() => {
    void (async () => {
      const { data: vs } = await supabase
        .from("bible_versions")
        .select("id, name, abbreviation");
      setVersions((vs ?? []) as Version[]);
      const { data: p } = await supabase
        .from("profiles")
        .select("default_version_id")
        .eq("id", user.id)
        .maybeSingle();
      const vid =
        (p?.default_version_id as string | null) ?? (vs?.[0]?.id ?? null);
      setVersionId(vid);
    })();
  }, [user.id]);

  // Books (+ chapter counts) for the selected version via a cheap aggregate RPC.
  useEffect(() => {
    if (!versionId) return;
    void (async () => {
      const { data } = await supabase.rpc("bible_books" as any, {
        p_version_id: versionId,
      });
      const rows = ((data ?? []) as unknown) as { book: string; chapters: number }[];
      setBooks(rows.map((r) => r.book));
      setBookChapters(Object.fromEntries(rows.map((r) => [r.book, r.chapters])));
      if (rows.length && !rows.some((r) => r.book === book)) {
        setBook(rows[0].book);
        setChapter(1);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versionId]);

  // Chapter verses + this user's highlights for them.
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
      if (data?.length) {
        const { data: h } = await supabase
          .from("user_highlights")
          .select("verse_id")
          .eq("user_id", user.id)
          .in("verse_id", data.map((v: any) => v.id));
        setHighlights(new Set((h ?? []).map((x: any) => x.verse_id)));
      } else {
        setHighlights(new Set());
      }
    })();
  }, [versionId, book, chapter, user.id]);

  const maxChapter = bookChapters[book] ?? 1;
  const chapters = useMemo(
    () => Array.from({ length: maxChapter }, (_, i) => i + 1),
    [maxChapter],
  );

  function selectBook(b: string) {
    setBook(b);
    setChapter(1);
  }
  function prevChapter() {
    if (chapter > 1) setChapter(chapter - 1);
  }
  function nextChapter() {
    if (chapter < maxChapter) setChapter(chapter + 1);
  }

  async function toggleHighlight(v: Verse) {
    if (highlights.has(v.id)) {
      await supabase
        .from("user_highlights")
        .delete()
        .eq("user_id", user.id)
        .eq("verse_id", v.id);
      const next = new Set(highlights);
      next.delete(v.id);
      setHighlights(next);
    } else {
      await supabase
        .from("user_highlights")
        .insert({ user_id: user.id, verse_id: v.id });
      setHighlights(new Set([...highlights, v.id]));
    }
  }

  return (
    <AppShell title="Bible">
      <div className="space-y-stack-md">
        {/* Reference & translation selectors */}
        <div className="flex flex-wrap items-center gap-2">
          <SelectChip
            icon="bookmark"
            value={book}
            onChange={selectBook}
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

        <header className="flex items-center justify-between border-b border-divider-soft pb-stack-sm">
          <h1 className="font-serif text-3xl text-primary">
            {book} {chapter}
          </h1>
          <div className="flex items-center gap-1">
            <button
              onClick={prevChapter}
              disabled={chapter <= 1}
              aria-label="Previous chapter"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-divider-soft bg-card text-primary transition-colors hover:border-wood-warm disabled:opacity-40"
            >
              <Icon name="arrow_back" className="text-base" />
            </button>
            <button
              onClick={nextChapter}
              disabled={chapter >= maxChapter}
              aria-label="Next chapter"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-divider-soft bg-card text-primary transition-colors hover:border-wood-warm disabled:opacity-40"
            >
              <Icon name="arrow_forward" className="text-base" />
            </button>
          </div>
        </header>

        {/* Scripture body — calm, book-like reading at a ~66ch measure */}
        <article className="measure mx-auto space-y-1 text-on-surface">
          {verses.length === 0 ? (
            <p className="font-sans text-on-surface-variant">
              No verses for this chapter in the current translation.
            </p>
          ) : (
            verses.map((v) => (
              <p
                key={v.id}
                onClick={() => setSelected(v)}
                className={`text-scripture -mx-2 cursor-pointer rounded-lg px-2 py-1 transition-gentle hover:bg-surface-container ${
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
        <Sheet
          open
          onClose={() => setSelected(null)}
          title={`${selected.book} ${selected.chapter}:${selected.verse}`}
        >
          <div className="space-y-4">
            <p className="text-scripture text-on-surface">{selected.text}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                leftIcon="auto_awesome"
                onClick={() =>
                  navigate({
                    to: "/study",
                    search: {
                      q: `What does ${selected.book} ${selected.chapter}:${selected.verse} mean?`,
                    },
                  })
                }
              >
                Ask
              </Button>
              <Button
                size="sm"
                variant="secondary"
                leftIcon="ink_highlighter"
                onClick={() => {
                  void toggleHighlight(selected);
                  setSelected(null);
                }}
              >
                {highlights.has(selected.id) ? "Remove highlight" : "Highlight"}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                leftIcon="content_copy"
                onClick={() => {
                  void navigator.clipboard?.writeText(
                    `${selected.text} — ${selected.book} ${selected.chapter}:${selected.verse}`,
                  );
                }}
              >
                Copy
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto"
                onClick={() => setSelected(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </Sheet>
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
    <div className="relative inline-flex items-center gap-1.5 rounded-lg border border-divider-soft bg-card px-3 py-2 text-sm font-semibold text-primary">
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
