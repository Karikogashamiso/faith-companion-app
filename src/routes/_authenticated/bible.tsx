import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { Icon } from "@/components/app/icon";
import { Button, Card, Sheet, Skeleton } from "@/components/app/ui";
import { VerseImageSheet } from "@/components/app/verse-image";
import { explainChapter } from "@/lib/bible.functions";
import { getReadingPosition, setReadingPosition } from "@/lib/reading-position";
import {
  BASE_PX,
  SCALES,
  getReaderPrefs,
  setReaderPrefs,
} from "@/lib/reader-prefs";

export const Route = createFileRoute("/_authenticated/bible")({
  head: () => ({ meta: [{ title: "Bible · Faith Companion" }] }),
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
  const [imageVerse, setImageVerse] = useState<Verse | null>(null);
  const [books, setBooks] = useState<string[]>([]);
  const [bookChapters, setBookChapters] = useState<Record<string, number>>({});
  const [scale, setScale] = useState(1);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const explainFn = useServerFn(explainChapter);
  const [explainText, setExplainText] = useState<string | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);

  useEffect(() => {
    setScale(getReaderPrefs().scale);
  }, []);

  useEffect(() => {
    void (async () => {
      // Only show translations that actually have verse text (hides
      // seeded-but-not-yet-ingested versions). Falls back to the full list.
      let vs: Version[] = [];
      const { data: wc } = await (supabase as any).rpc("versions_with_content");
      if (wc && (wc as any[]).length) {
        vs = wc as Version[];
      } else {
        const { data } = await supabase
          .from("bible_versions")
          .select("id, name, abbreviation");
        vs = (data ?? []) as Version[];
      }
      setVersions(vs);

      // Resume where the reader left off, if we have a saved position.
      const saved = getReadingPosition();
      if (saved && (vs ?? []).some((v: any) => v.id === saved.versionId)) {
        setVersionId(saved.versionId);
        setBook(saved.book);
        setChapter(saved.chapter);
        return;
      }
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
    setExplainText(null);
    setReadingPosition({ versionId, book, chapter });
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
  async function saveBookmark(v: Verse) {
    const { error } = await (supabase as any)
      .from("bookmarks")
      .insert({ user_id: user.id, verse_id: v.id });
    setSelected(null);
    if (!error) toast("Saved to your collection");
    else if (error.code === "23505") toast("Already saved");
    else toast.error("Couldn't save", { description: error.message });
  }

  async function memorize(v: Verse) {
    const { error } = await (supabase as any).from("memory_verses").insert({
      user_id: user.id,
      verse_ref: `${v.book} ${v.chapter}:${v.verse}`,
      verse_text: v.text,
    });
    setSelected(null);
    if (!error) toast("Added to memorization");
    else if (error.code === "23505") toast("Already memorizing this");
    else toast.error("Couldn't add", { description: error.message });
  }

  function prevChapter() {
    if (chapter > 1) setChapter(chapter - 1);
  }
  function nextChapter() {
    if (chapter < maxChapter) setChapter(chapter + 1);
  }

  async function toggleHighlight(v: Verse) {
    if (highlights.has(v.id)) {
      const { error } = await supabase
        .from("user_highlights")
        .delete()
        .eq("user_id", user.id)
        .eq("verse_id", v.id);
      if (error) {
        toast.error("Couldn't remove highlight", { description: error.message });
        return;
      }
      const next = new Set(highlights);
      next.delete(v.id);
      setHighlights(next);
    } else {
      const { error } = await supabase
        .from("user_highlights")
        .insert({ user_id: user.id, verse_id: v.id });
      if (error) {
        toast.error("Couldn't highlight", { description: error.message });
        return;
      }
      setHighlights(new Set([...highlights, v.id]));
    }
  }

  function changeScale(s: number) {
    setScale(s);
    setReaderPrefs({ scale: s });
  }

  async function runExplain() {
    if (!versionId || !book) return;
    setExplainLoading(true);
    try {
      const r = await explainFn({
        data: { version_id: versionId, book, chapter },
      });
      setExplainText(
        r && !r.disabled
          ? r.summary
          : "AI explanations are off or unavailable for this chapter.",
      );
    } catch {
      setExplainText("Couldn't generate an explanation right now.");
    } finally {
      setExplainLoading(false);
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

        {/* Chapter header — label-caps subtitle + gilded divider + italic headline */}
        <header className="text-center mb-stack-lg">
          <span className="label-caps text-primary tracking-widest">
            {bookCategory(book)}
          </span>
          <div className="gilded-divider my-4 mx-auto w-32" />
          <h1 className="font-serif text-3xl md:text-4xl mt-2 italic text-primary">
            {book} {chapter}
          </h1>
          <div className="flex items-center justify-center gap-1 mt-4">
            <button
              onClick={() => setSettingsOpen(true)}
              aria-label="Reading settings"
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-divider-soft bg-card text-primary transition-colors hover:border-wood-warm"
            >
              <Icon name="text_fields" className="text-base" />
            </button>
            <button
              onClick={prevChapter}
              disabled={chapter <= 1}
              aria-label="Previous chapter"
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-divider-soft bg-card text-primary transition-colors hover:border-wood-warm disabled:opacity-40"
            >
              <Icon name="arrow_back" className="text-base" />
            </button>
            <button
              onClick={nextChapter}
              disabled={chapter >= maxChapter}
              aria-label="Next chapter"
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-divider-soft bg-card text-primary transition-colors hover:border-wood-warm disabled:opacity-40"
            >
              <Icon name="arrow_forward" className="text-base" />
            </button>
          </div>
        </header>

        {/* AI chapter summary (citation-locked to this chapter) */}
        {verses.length > 0 &&
          (explainText ? (
            <Card tone="info" className="space-y-2">
              <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-wood-warm">
                <Icon name="auto_awesome" filled className="text-base" />
                Chapter summary
              </p>
              <p className="measure leading-relaxed text-on-surface">
                {explainText}
              </p>
            </Card>
          ) : explainLoading ? (
            <Skeleton className="h-24" />
          ) : (
            <button
              onClick={runExplain}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-divider-soft bg-card py-3 text-sm font-semibold text-primary transition-gentle hover:border-wood-warm"
            >
              <Icon name="auto_awesome" filled className="text-base text-wood-warm" />
              Explain this chapter
            </button>
          ))}

        {/* Scripture body — calm, book-like reading at a ~66ch measure */}
        <article
          className="measure mx-auto space-y-1 text-on-surface"
          style={{ fontSize: `${Math.round(BASE_PX * scale)}px` }}
        >
          {verses.length === 0 ? (
            <p className="font-sans text-base text-on-surface-variant">
              No verses for this chapter in the current translation.
            </p>
          ) : (
            verses.map((v, i) => (
              <p
                key={v.id}
                onClick={() => setSelected(v)}
                className={`-mx-2 cursor-pointer rounded-lg px-2 py-1 font-serif leading-[1.8] transition-gentle hover:bg-surface-container ${
                  highlights.has(v.id) ? "bg-secondary-container/40" : ""
                } ${i === 0 ? "drop-cap" : ""}`}
              >
                <sup className="verse-number">
                  {v.verse}
                </sup>
                {v.text}
                {i === Math.floor(verses.length / 2) && verses.length > 3 && (
                  <span className="block mt-4">
                    <span className="gilded-divider block w-full" />
                  </span>
                )}
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
                leftIcon="bookmark_add"
                onClick={() => saveBookmark(selected)}
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="secondary"
                leftIcon="neurology"
                onClick={() => memorize(selected)}
              >
                Memorize
              </Button>
              <Button
                size="sm"
                variant="secondary"
                leftIcon="ios_share"
                onClick={() => {
                  setImageVerse(selected);
                  setSelected(null);
                }}
              >
                Share image
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

      {imageVerse && (
        <VerseImageSheet
          open
          onClose={() => setImageVerse(null)}
          reference={`${imageVerse.book} ${imageVerse.chapter}:${imageVerse.verse}`}
          text={imageVerse.text}
        />
      )}

      <Sheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Reading"
      >
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-wood-warm">
            Text size
          </p>
          <div className="flex items-center gap-2">
            <span className="font-serif text-sm text-on-surface-variant">A</span>
            <div className="flex flex-1 gap-1">
              {SCALES.map((s) => (
                <button
                  key={s}
                  onClick={() => changeScale(s)}
                  aria-label={`Text size ${Math.round(s * 100)} percent`}
                  aria-pressed={scale === s}
                  className={`flex h-11 flex-1 items-center justify-center rounded-md border transition-gentle ${
                    scale === s
                      ? "border-primary bg-primary text-on-primary"
                      : "border-divider-soft text-on-surface-variant hover:border-wood-warm"
                  }`}
                >
                  <span className="font-serif" style={{ fontSize: `${Math.round(11 * s)}px` }}>
                    A
                  </span>
                </button>
              ))}
            </div>
            <span className="font-serif text-2xl text-on-surface-variant">A</span>
          </div>
          <Card tone="info" padding="sm">
            <p
              className="font-serif text-on-surface"
              style={{ fontSize: `${Math.round(BASE_PX * scale)}px`, lineHeight: 1.8 }}
            >
              “For God so loved the world, that he gave his one and only Son…”
            </p>
          </Card>
          <Link
            to="/settings"
            onClick={() => setSettingsOpen(false)}
            className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-wood-warm"
          >
            <Icon name="dark_mode" className="text-base" />
            Light / dark theme in Settings
          </Link>
        </div>
      </Sheet>
    </AppShell>
  );
}

function bookCategory(book: string): string {
  const ot = ["Genesis","Exodus","Leviticus","Numbers","Deuteronomy","Joshua","Judges","Ruth","1 Samuel","2 Samuel","1 Kings","2 Kings","1 Chronicles","2 Chronicles","Ezra","Nehemiah","Esther","Job","Psalms","Proverbs","Ecclesiastes","Song of Solomon","Isaiah","Jeremiah","Lamentations","Ezekiel","Daniel","Hosea","Joel","Amos","Obadiah","Jonah","Micah","Nahum","Habakkuk","Zephaniah","Haggai","Zechariah","Malachi"];
  const gospels = ["Matthew","Mark","Luke","John"];
  const epistles = ["Romans","1 Corinthians","2 Corinthians","Galatians","Ephesians","Philippians","Colossians","1 Thessalonians","2 Thessalonians","1 Timothy","2 Timothy","Titus","Philemon","Hebrews","James","1 Peter","2 Peter","1 John","2 John","3 John","Jude"];
  if (gospels.includes(book)) return `The Gospel According to ${book}`;
  if (epistles.includes(book)) return `The Epistle of ${book}`;
  if (ot.includes(book)) return book;
  if (book === "Acts") return "The Acts of the Apostles";
  if (book === "Revelation") return "The Revelation of Jesus Christ";
  return book;
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
