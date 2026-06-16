import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Search</h1>
        <Link to="/home" className="text-sm text-muted-foreground hover:text-foreground">
          ← Today
        </Link>
      </header>

      <form onSubmit={submit} className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="anxiety, love, beginning…"
          className="flex-1 rounded border bg-background px-3 py-2 text-sm"
        />
        <button
          disabled={busy}
          className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Search
        </button>
      </form>

      <ul className="space-y-2">
        {hits.map((h) => (
          <li key={h.id} className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">
              {h.book} {h.chapter}:{h.verse}
            </p>
            <p className="mt-1 text-sm leading-relaxed">{h.text}</p>
          </li>
        ))}
        {!busy && q && hits.length === 0 && (
          <li className="text-sm text-muted-foreground">No matches.</li>
        )}
      </ul>
    </div>
  );
}
