import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/app-shell";
import { Icon } from "@/components/app/icon";

export const Route = createFileRoute("/_authenticated/search")({
  head: () => ({ meta: [{ title: "Search · Discipleship Companion" }] }),
  component: SearchPage,
});

type Hit = { id: number; book: string; chapter: number; verse: number; text: string };

function SearchPage() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    // Keyword search: textSearch with english config (websearch syntax for quoted/and/or)
    const { data, error } = await supabase
      .from("verses")
      .select("id, book, chapter, verse, text")
      .textSearch("text", q.trim(), { config: "english", type: "websearch" })
      .limit(50);
    setBusy(false);
    if (error) {
      // Fallback: ilike if FTS unavailable
      const { data: d2 } = await supabase
        .from("verses")
        .select("id, book, chapter, verse, text")
        .ilike("text", `%${q.trim()}%`)
        .limit(50);
      setHits((d2 ?? []) as Hit[]);
    } else {
      setHits((data ?? []) as Hit[]);
    }
  }

  return (
    <AppShell title="Search">
      <div className="space-y-stack-md">
        <h1 className="font-serif text-3xl text-primary">Search Scripture</h1>

        <form onSubmit={submit} className="flex gap-2">
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
            disabled={busy}
            className="h-12 rounded-lg bg-primary px-6 text-sm font-semibold text-on-primary transition-colors hover:bg-navy-deep disabled:opacity-50"
          >
            Search
          </button>
        </form>

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
          {!busy && q && hits.length === 0 && (
            <li className="rounded-xl border border-divider-soft bg-white p-6 text-center text-sm text-on-surface-variant">
              No matches.
            </li>
          )}
        </ul>
      </div>
    </AppShell>
  );
}
