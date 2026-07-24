import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { Icon } from "@/components/app/icon";
import { Button, Sheet, Skeleton } from "@/components/app/ui";
import { VerseImageSheet } from "@/components/app/verse-image";
import { explainChapter } from "@/lib/bible.functions";
import { relatedVerses } from "@/lib/search.functions";
import { getReadingPosition, setReadingPosition } from "@/lib/reading-position";
import {
  BASE_PX,
  SCALES,
  FONT_STACKS,
  LINE_HEIGHTS,
  getReaderPrefs,
  setReaderPrefs,
  type FontFamily,
  type LineSpacing,
  type Density,
} from "@/lib/reader-prefs";
import { getStoredTheme, setTheme, type Theme } from "@/lib/theme";

// Highlight palette — stored as the color name in user_highlights.color.
const HIGHLIGHT_COLORS = [
  { key: "yellow", swatch: "bg-[#e6c364]", row: "bg-[#e6c364]/20" },
  { key: "green", swatch: "bg-[#7fae6e]", row: "bg-[#7fae6e]/20" },
  { key: "blue", swatch: "bg-[#6e86c4]", row: "bg-[#6e86c4]/20" },
  { key: "rose", swatch: "bg-[#c47e9e]", row: "bg-[#c47e9e]/20" },
] as const;

function highlightRowClass(color: string | undefined): string {
  return HIGHLIGHT_COLORS.find((c) => c.key === color)?.row ?? "";
}

// Canonical book order — used to split the rail into Old / New Testament and
// to keep books in scripture order regardless of DB order.
const OT_BOOKS = ["Genesis","Exodus","Leviticus","Numbers","Deuteronomy","Joshua","Judges","Ruth","1 Samuel","2 Samuel","1 Kings","2 Kings","1 Chronicles","2 Chronicles","Ezra","Nehemiah","Esther","Job","Psalms","Proverbs","Ecclesiastes","Song of Solomon","Isaiah","Jeremiah","Lamentations","Ezekiel","Daniel","Hosea","Joel","Amos","Obadiah","Jonah","Micah","Nahum","Habakkuk","Zephaniah","Haggai","Zechariah","Malachi"];
const NT_BOOKS = ["Matthew","Mark","Luke","John","Acts","Romans","1 Corinthians","2 Corinthians","Galatians","Ephesians","Philippians","Colossians","1 Thessalonians","2 Thessalonians","1 Timothy","2 Timothy","Titus","Philemon","Hebrews","James","1 Peter","2 Peter","1 John","2 John","3 John","Jude","Revelation"];

export const Route = createFileRoute("/_authenticated/bible")({
  head: () => ({
    meta: [
      { title: "Bible · Faith Companion" },
      { name: "description", content: "Read the Bible in 8 translations with parallel compare, highlights, and study tools — designed like an illuminated manuscript." },
    ],
  }),
  component: Bible,
});

type Version = { id: string; name: string; abbreviation: string };
type Verse = { id: number; book: string; chapter: number; verse: number; text: string };

function Bible() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [versions, setVersions] = useState<Version[]>([]);
  const [versionId, setVersionId] = useState<string | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [compareVerses, setCompareVerses] = useState<{ verse: number; text: string }[]>([]);
  const [book, setBook] = useState<string>("");
  const [chapter, setChapter] = useState<number>(1);
  const [verses, setVerses] = useState<Verse[]>([]);
  const [versesLoading, setVersesLoading] = useState(false);
  const [highlights, setHighlights] = useState<Map<number, string>>(new Map());
  const [notes, setNotes] = useState<Map<number, { id: string; body: string }>>(new Map());
  const [noteDraft, setNoteDraft] = useState<string>("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [selected, setSelected] = useState<Verse | null>(null);
  const [imageVerse, setImageVerse] = useState<Verse | null>(null);
  const [books, setBooks] = useState<string[]>([]);
  const [bookChapters, setBookChapters] = useState<Record<string, number>>({});
  const [scale, setScale] = useState(1);
  const [family, setFamily] = useState<FontFamily>("serif");
  const [lineSpacing, setLineSpacing] = useState<LineSpacing>("relaxed");
  const [density, setDensity] = useState<Density>("comfortable");
  const [theme, setThemeState] = useState<Theme>("system");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false); // mobile drawer
  const [versionMenuOpen, setVersionMenuOpen] = useState(false);
  const [bookQuery, setBookQuery] = useState("");
  const [related, setRelated] = useState<{
    loading: boolean;
    hits: { id: number; book: string; chapter: number; verse: number; text: string }[];
  } | null>(null);
  const [explainText, setExplainText] = useState<string | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);
  const explainFn = useServerFn(explainChapter);
  const relatedFn = useServerFn(relatedVerses);
  const versionBtnRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const p = getReaderPrefs();
    setScale(p.scale);
    setFamily(p.family);
    setLineSpacing(p.lineSpacing);
    setDensity(p.density);
    setThemeState(getStoredTheme());
  }, []);

  const fontFamily = FONT_STACKS[family];
  const lineHeight = LINE_HEIGHTS[lineSpacing];
  const verseGapClass = density === "compact" ? "space-y-2" : "space-y-5";
  const versePadY = density === "compact" ? "py-0.5" : "py-1";


  // Seed the note editor when a verse is opened; clear when closed.
  useEffect(() => {
    if (selected) setNoteDraft(notes.get(selected.id)?.body ?? "");
    else setNoteDraft("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  // Close version menu on outside click / escape.
  useEffect(() => {
    if (!versionMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!versionBtnRef.current?.contains(e.target as Node)) setVersionMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setVersionMenuOpen(false); };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [versionMenuOpen]);

  useEffect(() => {
    void (async () => {
      // Load ALL translations (metadata) so the 8-version switcher is populated.
      const { data } = await supabase
        .from("bible_versions")
        .select("id, name, abbreviation");
      const vs = (data ?? []) as Version[];
      // Sort by our preferred display order.
      const order = ["KJV","WEB","ASV","BBE","YLT","DBY","WBT","AKJV"];
      vs.sort((a, b) => {
        const ai = order.indexOf(a.abbreviation);
        const bi = order.indexOf(b.abbreviation);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });
      setVersions(vs);

      // Prefer any translation that actually has verses cached so first load isn't empty.
      let contentIds: string[] = [];
      const { data: wc } = await (supabase as any).rpc("versions_with_content");
      if (wc && (wc as any[]).length) {
        contentIds = (wc as any[]).map((v: any) => v.id);
      }

      const saved = getReadingPosition();
      if (saved && vs.some((v) => v.id === saved.versionId)) {
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
        (p?.default_version_id as string | null) ??
        (contentIds[0] ?? vs[0]?.id ?? null);
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
      // If this translation has no cached content, fall back to the full canon
      // list so the rail still shows every book (chapter counts unknown → 1).
      if (!rows.length) {
        const allBooks = [...OT_BOOKS, ...NT_BOOKS];
        setBooks(allBooks);
        setBookChapters(Object.fromEntries(allBooks.map((b) => [b, 1])));
        if (!book) setBook("Philippians");
        return;
      }
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
    setVersesLoading(true);
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
        const ids = data.map((v: any) => v.id);
        const [{ data: h }, { data: n }] = await Promise.all([
          supabase.from("user_highlights").select("verse_id, color").eq("user_id", user.id).in("verse_id", ids),
          (supabase as any).from("user_notes").select("id, verse_id, body").eq("user_id", user.id).in("verse_id", ids),
        ]);
        setHighlights(new Map((h ?? []).map((x: any) => [x.verse_id, x.color || "yellow"])));
        setNotes(new Map((n ?? []).map((x: any) => [x.verse_id, { id: x.id, body: x.body }])));
      } else {
        setHighlights(new Map());
        setNotes(new Map());
      }
      setVersesLoading(false);
    })();
  }, [versionId, book, chapter, user.id]);

  // Parallel translation (compare) verses, keyed by verse number.
  useEffect(() => {
    if (!compareId || !book) {
      setCompareVerses([]);
      return;
    }
    void (async () => {
      const { data } = await supabase
        .from("verses")
        .select("verse, text")
        .eq("version_id", compareId)
        .eq("book", book)
        .eq("chapter", chapter)
        .order("verse");
      setCompareVerses((data ?? []) as { verse: number; text: string }[]);
    })();
  }, [compareId, book, chapter]);

  const compareMap = useMemo(() => {
    const m = new Map<number, string>();
    for (const v of compareVerses) m.set(v.verse, v.text);
    return m;
  }, [compareVerses]);
  const activeVersion = versions.find((v) => v.id === versionId);
  const activeAbbr = activeVersion?.abbreviation ?? "";
  const compareAbbr = versions.find((v) => v.id === compareId)?.abbreviation ?? "";

  const maxChapter = bookChapters[book] ?? 1;
  const chapters = useMemo(
    () => Array.from({ length: maxChapter }, (_, i) => i + 1),
    [maxChapter],
  );

  // Split the rail into OT / NT groups, honoring the actual books available
  // for this translation (falls back to full canon when unknown).
  const railGroups = useMemo(() => {
    const q = bookQuery.trim().toLowerCase();
    const has = new Set(books);
    const inSet = (name: string) => has.size === 0 || has.has(name);
    const matches = (name: string) => !q || name.toLowerCase().includes(q);
    return {
      ot: OT_BOOKS.filter((b) => inSet(b) && matches(b)),
      nt: NT_BOOKS.filter((b) => inSet(b) && matches(b)),
      other: books.filter((b) => !OT_BOOKS.includes(b) && !NT_BOOKS.includes(b) && matches(b)),
    };
  }, [books, bookQuery]);

  function selectBook(b: string) {
    setBook(b);
    setChapter(1);
    setLibraryOpen(false);
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

  function prevChapter() { if (chapter > 1) setChapter(chapter - 1); }
  function nextChapter() { if (chapter < maxChapter) setChapter(chapter + 1); }

  async function loadRelated(v: Verse) {
    if (!versionId) return;
    setRelated({ loading: true, hits: [] });
    try {
      const r = await relatedFn({
        data: { text: v.text, version_id: versionId, book: v.book, chapter: v.chapter, verse: v.verse },
      });
      setRelated({ loading: false, hits: r.results ?? [] });
    } catch {
      setRelated({ loading: false, hits: [] });
    }
  }

  async function removeHighlight(v: Verse) {
    const { error } = await supabase.from("user_highlights").delete().eq("user_id", user.id).eq("verse_id", v.id);
    if (error) { toast.error("Couldn't remove highlight", { description: error.message }); return; }
    const next = new Map(highlights); next.delete(v.id); setHighlights(next);
  }
  async function applyHighlight(v: Verse, color: string) {
    const existing = highlights.get(v.id);
    if (existing === color) return removeHighlight(v);
    const { error } = existing
      ? await supabase.from("user_highlights").update({ color }).eq("user_id", user.id).eq("verse_id", v.id)
      : await supabase.from("user_highlights").insert({ user_id: user.id, verse_id: v.id, color });
    if (error) { toast.error("Couldn't highlight", { description: error.message }); return; }
    const next = new Map(highlights); next.set(v.id, color); setHighlights(next);
  }

  async function saveNote(v: Verse) {
    const body = noteDraft.trim();
    const existing = notes.get(v.id);
    setNoteSaving(true);
    try {
      if (!body) {
        if (!existing) return;
        const { error } = await (supabase as any).from("user_notes").delete().eq("user_id", user.id).eq("verse_id", v.id);
        if (error) throw error;
        const next = new Map(notes); next.delete(v.id); setNotes(next);
        toast("Note removed");
        return;
      }
      if (existing) {
        const { error } = await (supabase as any).from("user_notes").update({ body }).eq("user_id", user.id).eq("verse_id", v.id);
        if (error) throw error;
        const next = new Map(notes); next.set(v.id, { id: existing.id, body }); setNotes(next);
      } else {
        const { data, error } = await (supabase as any).from("user_notes")
          .insert({ user_id: user.id, verse_id: v.id, body })
          .select("id").single();
        if (error) throw error;
        const next = new Map(notes); next.set(v.id, { id: data.id, body }); setNotes(next);
      }
      toast("Note saved");
    } catch (e: any) {
      toast.error("Couldn't save note", { description: e?.message });
    } finally {
      setNoteSaving(false);
    }
  }

  function stepScale(dir: 1 | -1) {
    const idx = (SCALES as readonly number[]).indexOf(scale);
    const nextIdx = Math.min(SCALES.length - 1, Math.max(0, (idx === -1 ? 1 : idx) + dir));
    changeScale(SCALES[nextIdx]);
  }
  function changeScale(s: (typeof SCALES)[number]) { setScale(s); setReaderPrefs({ scale: s }); }


  async function runExplain() {
    if (!versionId || !book) return;
    setExplainLoading(true);
    try {
      const r = await explainFn({ data: { version_id: versionId, book, chapter } });
      setExplainText(r && !r.disabled ? r.summary : "AI explanations are off or unavailable for this chapter.");
    } catch {
      setExplainText("Couldn't generate an explanation right now.");
    } finally {
      setExplainLoading(false);
    }
  }

  // Read the reading-position row for the sidebar footer badge.
  const readingBadge = book ? `${book} ${chapter}` : "";

  return (
    <AppShell title="Bible" maxWidth="max-w-none" contentClassName="!px-0 !pb-0">
      <div className="mx-auto flex w-full max-w-[1400px] min-h-[calc(100vh-9rem)] pb-24 md:pb-8">
        {/* ── LEFT RAIL — Library ─────────────────────────────────── */}
        <BibleLibraryRail
          bookQuery={bookQuery}
          setBookQuery={setBookQuery}
          railGroups={railGroups}
          book={book}
          selectBook={selectBook}
          chapters={chapters}
          chapter={chapter}
          setChapter={setChapter}
          readingBadge={readingBadge}
          userEmail={user.email ?? ""}
        />

        {/* ── MAIN ─────────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col relative min-w-0">
          {/* Sticky top: book·chapter · translation · parallel · type · nav */}
          <header className="h-14 md:h-16 border-b border-primary/10 px-4 md:px-6 flex items-center justify-between sticky top-16 bg-background/95 backdrop-blur-md z-20 gap-3">
            <div className="flex items-center gap-2 md:gap-4 min-w-0">
              <button
                type="button"
                onClick={() => setLibraryOpen(true)}
                aria-label="Open library"
                className="md:hidden shrink-0 flex h-9 w-9 items-center justify-center rounded-lg border border-primary/20 text-primary"
              >
                <Icon name="menu_book" className="text-lg" />
              </button>
              <h2 className="font-serif text-lg md:text-xl italic text-primary truncate">
                {book || "Select a book"} {book && chapter}
              </h2>
              <span className="hidden sm:block h-4 w-px bg-primary/20 shrink-0" />
              <div ref={versionBtnRef} className="relative">
                <button
                  type="button"
                  onClick={() => setVersionMenuOpen((o) => !o)}
                  aria-haspopup="menu"
                  aria-expanded={versionMenuOpen}
                  className="flex items-center gap-1.5 text-xs font-bold tracking-widest text-primary bg-primary/5 px-3 py-1.5 border border-primary/20 rounded-full hover:bg-primary/10 transition-colors"
                >
                  {activeAbbr || "—"}
                  <Icon name="expand_more" className="text-sm" />
                </button>
                {versionMenuOpen && (
                  <div
                    role="menu"
                    className="absolute top-full left-0 mt-2 w-72 bg-surface-container border border-primary/20 shadow-2xl rounded-md p-2 z-30"
                  >
                    <div className="px-2 py-1 text-[10px] uppercase tracking-widest text-primary/60 font-bold">
                      Translation
                    </div>
                    <div className="grid grid-cols-1 gap-0.5 max-h-[60vh] overflow-y-auto">
                      {versions.map((v) => (
                        <button
                          key={v.id}
                          role="menuitemradio"
                          aria-checked={v.id === versionId}
                          onClick={() => { setVersionId(v.id); setVersionMenuOpen(false); }}
                          className={`text-left px-3 py-2 text-xs rounded flex items-center justify-between gap-3 ${
                            v.id === versionId ? "bg-primary/10 text-primary" : "text-on-surface hover:bg-primary/5"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span className="font-bold tracking-wider w-10 shrink-0">{v.abbreviation}</span>
                            <span className="text-on-surface-variant">{v.name}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 pt-2 border-t border-primary/10 px-2 pb-1 text-[10px] text-on-surface-variant">
                      8 public-domain translations.
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-4 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (compareId) setCompareId(null);
                  else setCompareId(versions.find((v) => v.id !== versionId)?.id ?? null);
                }}
                aria-pressed={!!compareId}
                className={`hidden sm:flex items-center gap-2 text-[10px] tracking-widest uppercase font-semibold px-2 py-1 rounded transition-colors ${
                  compareId ? "bg-primary/15 text-primary" : "text-on-surface-variant hover:text-primary"
                }`}
              >
                <Icon name="compare" className="text-sm" /> Parallel
              </button>
              <div className="hidden md:flex items-center border border-primary/20 rounded-sm divide-x divide-primary/20">
                <button type="button" onClick={() => stepScale(-1)} aria-label="Smaller text" className="px-2.5 py-1 text-xs hover:bg-primary/5">A-</button>
                <button type="button" onClick={() => stepScale(1)} aria-label="Larger text" className="px-2.5 py-1 text-xs hover:bg-primary/5">A+</button>
              </div>
              <button type="button" onClick={() => setSettingsOpen(true)} aria-label="Reading settings" className="md:hidden flex h-9 w-9 items-center justify-center rounded-lg border border-primary/20 text-primary">
                <Icon name="text_fields" className="text-base" />
              </button>
              <div className="flex items-center gap-1 border-l border-primary/20 pl-2 md:pl-4">
                <button type="button" onClick={prevChapter} disabled={chapter <= 1} aria-label="Previous chapter" className="h-9 w-9 flex items-center justify-center rounded text-on-surface-variant hover:text-primary disabled:opacity-30">
                  <Icon name="arrow_back" className="text-base" />
                </button>
                <button type="button" onClick={nextChapter} disabled={chapter >= maxChapter} aria-label="Next chapter" className="h-9 w-9 flex items-center justify-center rounded text-on-surface-variant hover:text-primary disabled:opacity-30">
                  <Icon name="arrow_forward" className="text-base" />
                </button>
              </div>
            </div>
          </header>

          {/* Reader body */}
          <div className="flex-1 flex overflow-hidden">
            {/* Primary translation */}
            <article className={`flex-1 overflow-y-auto px-5 md:px-12 py-10 md:py-16 ${compareId ? "lg:border-r lg:border-primary/10" : ""}`}>
              <div className="max-w-2xl mx-auto">
                <div className="text-center mb-10 md:mb-14">
                  <div className="h-px w-12 bg-primary/40 mx-auto mb-5" />
                  <p className="text-primary text-[10px] uppercase tracking-[0.3em] font-medium">
                    {bookCategory(book)}
                  </p>
                  <h1 className="font-serif italic font-bold text-primary mt-2 text-4xl md:text-5xl">
                    {book} <span className="not-italic">{chapter}</span>
                  </h1>
                </div>

                {versesLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-6 w-11/12" />
                    <Skeleton className="h-6 w-10/12" />
                    <Skeleton className="h-6 w-full" />
                  </div>
                ) : verses.length === 0 ? (
                  <EmptyTranslation abbr={activeAbbr} />
                ) : (
                  <div className={verseGapClass} style={{ fontSize: `${Math.round(BASE_PX * scale)}px`, fontFamily }}>
                    {verses.map((v, i) => {
                      const hl = highlights.get(v.id);
                      const hasNote = notes.has(v.id);
                      return (
                        <div
                          key={v.id}
                          onClick={() => setSelected(v)}
                          className={`group relative -mx-3 md:-mx-4 rounded-md px-3 md:px-4 ${versePadY} cursor-pointer transition-colors hover:bg-primary/5 ${
                            hl ? highlightRowClass(hl) : ""
                          } ${selected?.id === v.id ? "ring-1 ring-primary/40 bg-primary/5" : ""}`}
                        >
                          <p className="text-on-surface selection:bg-primary/30" style={{ lineHeight, fontFamily }}>
                            {i === 0 && v.text.length > 0 && density !== "compact" && (
                              <span
                                aria-hidden="true"
                                className="float-left font-bold text-primary border-r border-primary/20 mr-3 pr-3 mt-2 leading-[0.8]"
                                style={{ fontSize: `${Math.round(BASE_PX * scale * 3.4)}px`, fontFamily }}
                              >
                                {v.text.charAt(0)}
                              </span>
                            )}
                            <sup className="text-primary font-bold text-[0.6em] mr-1 select-none align-super">{v.verse}</sup>
                            {i === 0 ? v.text.slice(1) : v.text}
                            {hasNote && (
                              <button
                                type="button"
                                aria-label={`Open note on verse ${v.verse}`}
                                onClick={(e) => { e.stopPropagation(); setSelected(v); }}
                                className="ml-1.5 inline-flex h-4 w-4 items-center translate-y-[-1px] justify-center rounded-full bg-primary/15 text-primary hover:bg-primary hover:text-on-primary transition-colors align-middle"
                              >
                                <Icon name="sticky_note_2" className="text-[11px]" />
                              </button>
                            )}
                          </p>
                          {/* Verse action affordance — appears on hover */}
                          <button
                            aria-label={`Actions for verse ${v.verse}`}
                            onClick={(e) => { e.stopPropagation(); setSelected(v); }}
                            className="absolute -left-2 md:-left-8 top-2 hidden group-hover:flex h-6 w-6 rounded-full bg-surface-container border border-primary/40 items-center justify-center text-primary hover:bg-primary hover:text-on-primary transition-all"
                          >
                            <Icon name="more_horiz" className="text-sm" />
                          </button>
                        </div>
                      );
                    })}
                    {verses.length > 3 && (
                      <div className="pt-8 flex justify-center">
                        <div className="h-px w-24 bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </article>

            {/* Right column: parallel + study tools */}
            {(compareId || verses.length > 0) && (
              <aside className="hidden lg:flex w-80 shrink-0 flex-col bg-surface-container border-l border-primary/10">
                {compareId ? (
                  <>
                    <div className="p-5 border-b border-primary/10 bg-background flex items-center justify-between">
                      <div>
                        <div className="text-[10px] text-on-surface-variant uppercase tracking-widest">Parallel</div>
                        <div className="text-sm font-bold text-primary">{compareAbbr}</div>
                      </div>
                      <button type="button" onClick={() => setCompareId(null)} className="text-[10px] text-on-surface-variant hover:text-on-surface uppercase tracking-widest">
                        Close
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-5 space-y-5">
                      {verses.length === 0 && (
                        <p className="text-xs text-on-surface-variant">Choose a chapter to compare translations.</p>
                      )}
                      {verses.map((v) => (
                        <p key={v.verse} className="font-serif text-sm text-on-surface-variant leading-relaxed">
                          <sup className="text-primary/60 font-bold text-[0.7em] mr-1">{v.verse}</sup>
                          {compareMap.get(v.verse) ?? <span className="opacity-40">—</span>}
                        </p>
                      ))}
                    </div>
                  </>
                ) : null}
                <div className={`${compareId ? "h-1/3 border-t" : "flex-1"} border-primary/20 p-5 overflow-y-auto`}>
                  <h4 className="text-[10px] text-primary uppercase tracking-widest font-bold mb-4 flex items-center gap-2">
                    <Icon name="auto_awesome" className="text-sm" /> Study Tools
                  </h4>
                  <div className="space-y-3">
                    {explainLoading ? (
                      <Skeleton className="h-24" />
                    ) : explainText ? (
                      <div className="p-3 bg-primary/5 border border-primary/20 rounded">
                        <p className="text-[10px] text-primary/60 mb-1 uppercase tracking-widest">Chapter Summary</p>
                        <p className="text-xs leading-snug text-on-surface">{explainText}</p>
                      </div>
                    ) : verses.length > 0 ? (
                      <button
                        type="button"
                        onClick={runExplain}
                        className="w-full p-3 rounded border border-primary/20 text-xs text-primary hover:bg-primary/5 flex items-center gap-2 justify-center"
                      >
                        <Icon name="auto_awesome" className="text-sm" /> Explain this chapter
                      </button>
                    ) : null}

                    {!compareId && versions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setCompareId(versions.find((v) => v.id !== versionId)?.id ?? null)}
                        className="w-full p-3 rounded border border-primary/10 text-xs text-on-surface-variant hover:border-primary/40 hover:text-primary flex items-center gap-2 justify-center"
                      >
                        <Icon name="compare" className="text-sm" /> Open parallel translation
                      </button>
                    )}

                    <Link
                      to="/search"
                      className="block p-3 rounded border border-primary/10 text-xs text-on-surface-variant hover:border-primary/40 hover:text-primary"
                    >
                      <span className="flex items-center gap-2 justify-center">
                        <Icon name="search" className="text-sm" /> Search scripture
                      </span>
                    </Link>
                  </div>
                </div>
              </aside>
            )}
          </div>

          {/* Desktop bottom pill chapter nav */}
          <div className="hidden md:flex fixed bottom-6 left-1/2 -translate-x-1/2 items-center gap-3 bg-surface-container border border-primary/30 rounded-full px-5 py-2.5 shadow-2xl z-30">
            <button type="button" onClick={prevChapter} disabled={chapter <= 1} className="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-primary disabled:opacity-30 transition-colors">
              <Icon name="chevron_left" className="text-base" /> Prev
            </button>
            <span className="h-3 w-px bg-primary/20" />
            <span className="text-[11px] font-bold text-primary tracking-widest uppercase">Ch. {chapter}</span>
            <span className="h-3 w-px bg-primary/20" />
            <button type="button" onClick={nextChapter} disabled={chapter >= maxChapter} className="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-primary disabled:opacity-30 transition-colors">
              Next <Icon name="chevron_right" className="text-base" />
            </button>
          </div>
        </main>
      </div>

      {/* ── Mobile library drawer ──────────────────────────────── */}
      <Sheet open={libraryOpen} onClose={() => setLibraryOpen(false)} title="Library">
        <div className="space-y-3">
          <input
            value={bookQuery}
            onChange={(e) => setBookQuery(e.target.value)}
            placeholder="Search books..."
            className="w-full bg-background border border-primary/20 rounded-sm px-3 py-2 text-sm placeholder:text-on-surface-variant focus:outline-none focus:border-primary"
          />
          <RailBookList group="Old Testament" items={railGroups.ot} book={book} onSelect={selectBook} chapters={chapters} chapter={chapter} onChapter={setChapter} />
          <RailBookList group="New Testament" items={railGroups.nt} book={book} onSelect={selectBook} chapters={chapters} chapter={chapter} onChapter={setChapter} />
          {railGroups.other.length > 0 && (
            <RailBookList group="Other" items={railGroups.other} book={book} onSelect={selectBook} chapters={chapters} chapter={chapter} onChapter={setChapter} />
          )}
        </div>
      </Sheet>

      {/* ── Verse action sheet ─────────────────────────────────── */}
      {selected && (
        <Sheet
          open
          onClose={() => { setSelected(null); setRelated(null); }}
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
                    search: { q: `What does ${selected.book} ${selected.chapter}:${selected.verse} mean?` },
                  })
                }
              >
                Ask
              </Button>
              <div className="flex items-center gap-1.5" role="group" aria-label="Highlight color">
                {HIGHLIGHT_COLORS.map((c) => (
                  <button
                    key={c.key}
                    aria-label={`Highlight ${c.key}`}
                    aria-pressed={highlights.get(selected.id) === c.key}
                    onClick={() => void applyHighlight(selected, c.key)}
                    className={`h-7 w-7 rounded-full ${c.swatch} transition-transform hover:scale-110 ${
                      highlights.get(selected.id) === c.key ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : ""
                    }`}
                  />
                ))}
                {highlights.has(selected.id) && (
                  <button
                    aria-label="Remove highlight"
                    onClick={() => void removeHighlight(selected)}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-divider-soft text-on-surface-variant transition-colors hover:text-destructive"
                  >
                    <Icon name="format_color_reset" className="text-base" />
                  </button>
                )}
              </div>
              <Button size="sm" variant="secondary" leftIcon="bookmark_add" onClick={() => saveBookmark(selected)}>Save</Button>
              <Button size="sm" variant="secondary" leftIcon="neurology" onClick={() => memorize(selected)}>Memorize</Button>
              <Button size="sm" variant="secondary" leftIcon="hub" loading={related?.loading} onClick={() => loadRelated(selected)}>Related</Button>
              <Button size="sm" variant="secondary" leftIcon="ios_share" onClick={() => { setImageVerse(selected); setSelected(null); }}>Share image</Button>
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
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => { setSelected(null); setRelated(null); }}>Close</Button>
            </div>

            {/* Personal note (per translation — verses are version-scoped) */}
            <div className="space-y-2 border-t border-divider-soft pt-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant flex items-center gap-1.5">
                  <Icon name="sticky_note_2" className="text-sm" /> My note
                  <span className="text-[10px] font-normal text-on-surface-variant/70">· {activeAbbr}</span>
                </p>
                {notes.has(selected.id) && (
                  <span className="text-[10px] text-primary/70 uppercase tracking-wider">Saved</span>
                )}
              </div>
              <textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="What is God saying to you in this verse?"
                rows={4}
                className="w-full rounded-lg border border-primary/20 bg-background px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:border-primary resize-y"
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  leftIcon="save"
                  loading={noteSaving}
                  onClick={() => void saveNote(selected)}
                  disabled={noteDraft.trim() === (notes.get(selected.id)?.body ?? "")}
                >
                  {notes.has(selected.id) ? (noteDraft.trim() === "" ? "Delete note" : "Update note") : "Save note"}
                </Button>
                {notes.has(selected.id) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    leftIcon="delete_outline"
                    onClick={() => { setNoteDraft(""); void saveNote(selected); }}
                  >
                    Delete
                  </Button>
                )}
              </div>
            </div>


            {related && (
              <div className="space-y-2 border-t border-divider-soft pt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Verses like this</p>
                {related.loading ? (
                  <Skeleton className="h-16" />
                ) : related.hits.length === 0 ? (
                  <p className="text-sm text-on-surface-variant">No related verses found yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {related.hits.map((h) => (
                      <li key={h.id}>
                        <button
                          onClick={() => { setBook(h.book); setChapter(h.chapter); setSelected(null); setRelated(null); }}
                          className="w-full rounded-lg border border-divider-soft bg-card p-3 text-left transition-colors hover:border-primary"
                        >
                          <span className="text-xs font-semibold text-primary">{h.book} {h.chapter}:{h.verse}</span>
                          <span className="mt-1 block text-sm text-on-surface-variant line-clamp-2">{h.text}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
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

      {/* Reading-settings sheet (mobile primary; desktop uses inline stepper) */}
      <Sheet open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Reading">
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Text size</p>
          <div className="flex items-center gap-2">
            <span className="font-serif text-sm text-on-surface-variant">A</span>
            <div className="flex flex-1 gap-1">
              {SCALES.map((s) => (
                <button
                  key={s}
                  onClick={() => changeScale(s)}
                  aria-label={`Text size ${Math.round(s * 100)} percent`}
                  aria-pressed={scale === s}
                  className={`flex h-11 flex-1 items-center justify-center rounded-md border transition-colors ${
                    scale === s ? "border-primary bg-primary text-on-primary" : "border-divider-soft text-on-surface-variant hover:border-primary"
                  }`}
                >
                  <span className="font-serif" style={{ fontSize: `${Math.round(11 * s)}px` }}>A</span>
                </button>
              ))}
            </div>
            <span className="font-serif text-2xl text-on-surface-variant">A</span>
          </div>
          <div className="p-4 rounded border border-primary/10 bg-surface-container">
            <p className="font-serif text-on-surface" style={{ fontSize: `${Math.round(BASE_PX * scale)}px`, lineHeight: 1.85 }}>
              "For God so loved the world, that he gave his one and only Son…"
            </p>
          </div>
          <Link to="/settings" onClick={() => setSettingsOpen(false)} className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80">
            <Icon name="dark_mode" className="text-base" /> Light / dark theme in Settings
          </Link>
        </div>
      </Sheet>
    </AppShell>
  );
}

// ────────────────────────────────────────────────────────────────
// Library rail (desktop) + shared book list widget
// ────────────────────────────────────────────────────────────────

function BibleLibraryRail({
  bookQuery,
  setBookQuery,
  railGroups,
  book,
  selectBook,
  chapters,
  chapter,
  setChapter,
  readingBadge,
  userEmail,
}: {
  bookQuery: string;
  setBookQuery: (s: string) => void;
  railGroups: { ot: string[]; nt: string[]; other: string[] };
  book: string;
  selectBook: (b: string) => void;
  chapters: number[];
  chapter: number;
  setChapter: (c: number) => void;
  readingBadge: string;
  userEmail: string;
}) {
  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-primary/20 bg-surface-container sticky top-16 self-start h-[calc(100vh-9rem)]">
      <div className="p-5 border-b border-primary/10">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_10px_var(--color-primary)]" />
          <span className="text-[10px] tracking-[0.25em] text-primary font-bold uppercase">Library</span>
        </div>
        <input
          value={bookQuery}
          onChange={(e) => setBookQuery(e.target.value)}
          placeholder="Search books..."
          className="w-full bg-background border border-primary/20 rounded-sm px-3 py-2 text-xs placeholder:text-on-surface-variant focus:outline-none focus:border-primary"
        />
      </div>
      <div className="flex-1 overflow-y-auto py-3">
        <RailBookList group="Old Testament" items={railGroups.ot} book={book} onSelect={selectBook} chapters={chapters} chapter={chapter} onChapter={setChapter} />
        <RailBookList group="New Testament" items={railGroups.nt} book={book} onSelect={selectBook} chapters={chapters} chapter={chapter} onChapter={setChapter} />
        {railGroups.other.length > 0 && (
          <RailBookList group="Other" items={railGroups.other} book={book} onSelect={selectBook} chapters={chapters} chapter={chapter} onChapter={setChapter} />
        )}
      </div>
      <div className="p-4 border-t border-primary/10 bg-background/40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] text-primary uppercase font-bold">
            {(userEmail?.[0] ?? "F").toUpperCase()}
          </div>
          <div className="text-[10px] leading-tight min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">Reading</p>
            <p className="text-primary font-bold truncate">{readingBadge || "—"}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

function RailBookList({
  group,
  items,
  book,
  onSelect,
  chapters,
  chapter,
  onChapter,
}: {
  group: string;
  items: string[];
  book: string;
  onSelect: (b: string) => void;
  chapters: number[];
  chapter: number;
  onChapter: (c: number) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="px-4 mb-4">
      <h3 className="text-[10px] uppercase tracking-widest text-primary/60 mb-2 px-2 font-bold">{group}</h3>
      <ul className="space-y-0.5">
        {items.map((b) => {
          const active = b === book;
          return (
            <li key={b}>
              <button
                type="button"
                onClick={() => onSelect(b)}
                className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${
                  active
                    ? "bg-primary/10 text-primary border-l-2 border-primary font-medium"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-primary/5"
                }`}
              >
                {b}
              </button>
              {active && chapters.length > 1 && (
                <div className="grid grid-cols-6 gap-1 mt-2 mb-3 px-2">
                  {chapters.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => onChapter(c)}
                      aria-current={c === chapter}
                      className={`aspect-square text-[10px] font-bold rounded transition-colors ${
                        c === chapter
                          ? "bg-primary text-on-primary shadow-[0_0_10px_var(--color-primary)]/40"
                          : "border border-primary/10 hover:border-primary/40 text-on-surface-variant"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function EmptyTranslation({ abbr }: { abbr: string }) {
  return (
    <div className="mx-auto max-w-md text-center py-16">
      <div className="mx-auto mb-6 w-14 h-14 rounded-full border border-primary/30 flex items-center justify-center text-primary">
        <Icon name="menu_book" className="text-2xl" />
      </div>
      <h3 className="font-serif text-2xl italic text-primary mb-2">
        {abbr ? `${abbr} coming soon` : "No verses for this chapter"}
      </h3>
      <p className="text-sm text-on-surface-variant leading-relaxed">
        This translation is available in the switcher, but the passage text hasn't been ingested yet.
        Switch to WEB to keep reading — every chapter is available there.
      </p>
    </div>
  );
}

function bookCategory(book: string): string {
  const gospels = ["Matthew","Mark","Luke","John"];
  const epistles = ["Romans","1 Corinthians","2 Corinthians","Galatians","Ephesians","Philippians","Colossians","1 Thessalonians","2 Thessalonians","1 Timothy","2 Timothy","Titus","Philemon","Hebrews","James","1 Peter","2 Peter","1 John","2 John","3 John","Jude"];
  if (gospels.includes(book)) return `The Gospel According to ${book}`;
  if (epistles.includes(book)) return `The Epistle of ${book}`;
  if (OT_BOOKS.includes(book)) return "The Old Testament";
  if (book === "Acts") return "The Acts of the Apostles";
  if (book === "Revelation") return "The Revelation of Jesus Christ";
  return book || "Scripture";
}
