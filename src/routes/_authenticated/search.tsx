import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/app-shell";
import { Icon } from "@/components/app/icon";

export const Route = createFileRoute("/_authenticated/search")({
  head: () => ({ meta: [{ title: "Search · Discipleship Companion" }] }),
  component: SearchPage,
});

type Hit = { id: number; book: string; chapter: number; verse: number; text: string };

async function searchVerses(term: string): Promise<Hit[]> {
  // Keyword search: FTS with websearch syntax; fall back to ilike if unavailable.
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

  const query = useQuery({
    queryKey: ["verse-search", submitted],
    enabled: submitted.trim().length > 0,
    queryFn: () => searchVerses(submitted.trim()),
    staleTime: 5 * 60 * 1000,
  });
  const hits = query.data ?? [];

  return (
    <AppShell title="Search">
      <div className="space-y-stack-md">
        <h1 className="font-serif text-3xl text-primary">Search Scripture</h1>

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
              placeholder="anxiety, love, beginning…"
              className="h-12 w-full rounded-lg border border-divider-soft bg-white pl-10 pr-3 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <button
            disabled={query.isFetching || q.trim().length === 0}
            className="h-12 rounded-lg bg-primary px-6 text-sm font-semibold text-on-primary transition-colors hover:bg-navy-deep disabled:opacity-50"
          >
            {query.isFetching ? "…" : "Search"}
          </button>
        </form>

        {query.isFetching ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-xl border border-divider-soft bg-surface-container-low"
              />
            ))}
          </div>
        ) : query.isError ? (
          <p className="rounded-xl border border-divider-soft bg-white p-6 text-center text-sm text-destructive">
            Search failed — please try again.
          </p>
        ) : (
          <ul className="space-y-2">
            {hits.map((h) => (
              <li
                key={h.id}
                className="rounded-xl border border-divider-soft bg-white p-4"
              >
                <span className="inline-flex items-center gap-1 rounded-lg bg-crisis-blue px-2 py-0.5 text-xs font-bold text-primary">
                  {h.book} {h.chapter}:{h.verse}
                </span>
                <p className="mt-2 font-serif text-[17px] leading-relaxed text-on-surface">
                  {h.text}
                </p>
              </li>
            ))}
            {submitted && hits.length === 0 && (
              <li className="rounded-xl border border-divider-soft bg-white p-6 text-center text-sm text-on-surface-variant">
                No matches.
              </li>
            )}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
