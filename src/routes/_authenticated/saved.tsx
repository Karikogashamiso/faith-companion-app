import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/app-shell";
import { Icon } from "@/components/app/icon";
import {
  Chip,
  EmptyState,
  SectionHeader,
  Skeleton,
} from "@/components/app/ui";

export const Route = createFileRoute("/_authenticated/saved")({
  head: () => ({ meta: [{ title: "Saved · Faith Companion" }] }),
  component: Saved,
});

type Bookmark = {
  id: string;
  collection: string;
  note: string | null;
  verse: {
    id: number;
    book: string;
    chapter: number;
    verse: number;
    text: string;
  } | null;
};

function Saved() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const key = ["bookmarks", user.id];

  const q = useQuery({
    queryKey: key,
    queryFn: async (): Promise<Bookmark[]> => {
      const { data, error } = await (supabase as any)
        .from("bookmarks")
        .select(
          "id, collection, note, created_at, verse:verses(id, book, chapter, verse, text)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Bookmark[];
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await (supabase as any).from("bookmarks").delete().eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  // Group by collection.
  const groups: Record<string, Bookmark[]> = {};
  for (const b of q.data ?? []) {
    (groups[b.collection] ??= []).push(b);
  }
  const collections = Object.keys(groups).sort();

  return (
    <AppShell title="Saved">
      <div className="space-y-stack-md">
        <div className="mb-stack-lg text-center">
          <h2 className="font-serif text-3xl text-primary mb-unit">My Journal</h2>
          <p className="text-on-surface-variant">
            Pour out your heart before Him; God is a refuge for us.
          </p>
          <div className="gold-rule mt-stack-md" />
        </div>

        {q.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        ) : collections.length === 0 ? (
          <EmptyState
            icon="bookmark"
            title="Nothing saved yet"
            description="Open the Bible, tap a verse, and choose Save."
          />
        ) : (
          collections.map((c) => (
            <section key={c} className="space-y-2">
              <SectionHeader eyebrow={`${groups[c].length} verses`}>
                {c}
              </SectionHeader>
              <ul className="space-y-3">
                {groups[c].map((b) => (
                  <li
                    key={b.id}
                    className="glass-card p-4 rounded-xl hover:shadow-[0_0_20px_rgba(230,195,100,0.05)] transition-all group cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Chip tone="info">
                        {b.verse
                          ? `${b.verse.book} ${b.verse.chapter}:${b.verse.verse}`
                          : "Verse"}
                      </Chip>
                      <button
                        onClick={() => remove.mutate(b.id)}
                        aria-label="Remove bookmark"
                        className="text-on-surface-variant transition-gentle hover:text-destructive"
                      >
                        <Icon name="bookmark_remove" className="text-lg" />
                      </button>
                    </div>
                    {b.verse && (
                      <p className="mt-2 font-serif text-[17px] leading-relaxed text-on-surface">
                        {b.verse.text}
                      </p>
                    )}
                    {b.note && (
                      <p className="mt-2 text-sm italic text-on-surface-variant">
                        {b.note}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </AppShell>
  );
}
