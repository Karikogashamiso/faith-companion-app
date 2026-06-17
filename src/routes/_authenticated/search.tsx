import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { semanticVerseSearch } from "@/lib/search.functions";
import { AppShell } from "@/components/app/app-shell";
import { Icon } from "@/components/app/icon";
import { Button, Card, Chip, ScreenTitle, Skeleton } from "@/components/app/ui";

export const Route = createFileRoute("/_authenticated/search")({
  head: () => ({ meta: [{ title: "Search · Discipleship Companion" }] }),
  component: SearchPage,
});

type Hit = { id: number; book: string; chapter: number; verse: number; text: string };
type Mode = "keyword" | "meaning";

async function keywordSearch(term: string): Promise<Hit[]> {
  const { data, error } = await supabase
    .from("verses")
    .select("id, book, chapter, verse, text")
    .textSearch("text", term, { config: "english", type: "websearch" })
    .limit(50);
  if (error) {
    const { data: d2 } = await supabase
      .from("verses")
      .select("id, book, chapter, verse, text")
      .ilike("text", `%${term}%`)
      .limit(50);
    return (d2 ?? []) as Hit[];
  }
  return (data ?? []) as Hit[];
}

function SearchPage() {
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [mode, setMode] = useState<Mode>("keyword");
  const semanticFn = useServerFn(semanticVerseSearch);

  const query = useQuery({
    queryKey: ["verse-search", mode, submitted],
    enabled: submitted.trim().length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Hit[]> => {
      const term = submitted.trim();
      if (mode === "meaning") {
        const r = await semanticFn({ data: { query: term } });
        return (r.results ?? []) as Hit[];
      }
      return keywordSearch(term);
    },
  });
  const hits = query.data ?? [];

  return (
    <AppShell title="Search">
      <div className="space-y-stack-md">
        <ScreenTitle title="Search Scripture" />

        {/* Mode toggle */}
        <div
          role="radiogroup"
          aria-label="Search mode"
          className="grid grid-cols-2 gap-1 rounded-lg border border-divider-soft bg-card p-1"
        >
          {(["keyword", "meaning"] as Mode[]).map((m) => (
            <button
              key={m}
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
              className={`flex h-10 items-center justify-center gap-1.5 rounded-md text-sm font-semibold transition-gentle ${
                mode === m
                  ? "bg-primary text-on-primary"
                  : "text-on-surface-variant hover:text-primary"
              }`}
            >
              <Icon name={m === "keyword" ? "search" : "auto_awesome"} className="text-base" />
              {m === "keyword" ? "Keyword" : "Meaning"}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(q);
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Icon
              name="search"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-outline"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={
                mode === "keyword"
                  ? "anxiety, love, beginning…"
                  : "How do I deal with fear?"
              }
              className="h-12 w-full rounded-lg border border-divider-soft bg-card pl-10 pr-3 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <Button
            type="submit"
            className="h-12"
            loading={query.isFetching}
            disabled={q.trim().length === 0}
          >
            Search
          </Button>
        </form>

        {mode === "meaning" && (
          <p className="text-xs text-on-surface-variant">
            Meaning search finds verses that <em>express</em> your idea — even if
            they don't use your exact words.
          </p>
        )}

        {query.isFetching ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : query.isError ? (
          <Card className="text-center text-sm text-destructive">
            Search failed — please try again.
          </Card>
        ) : (
          <ul className="space-y-2">
            {hits.map((h) => (
              <li key={h.id}>
                <Card padding="sm">
                  <Chip tone="info">
                    {h.book} {h.chapter}:{h.verse}
                  </Chip>
                  <p className="mt-2 font-serif text-[17px] leading-relaxed text-on-surface">
                    {h.text}
                  </p>
                </Card>
              </li>
            ))}
            {submitted && hits.length === 0 && (
              <Card className="text-center text-sm text-on-surface-variant">
                No matches.
              </Card>
            )}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
