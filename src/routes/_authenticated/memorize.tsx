import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/app-shell";
import { Icon } from "@/components/app/icon";
import {
  Button,
  Card,
  Chip,
  EmptyState,
  ScreenTitle,
  SectionHeader,
  Skeleton,
} from "@/components/app/ui";
import {
  addDaysISO,
  isMastered,
  MASTERED_STAGE,
  reviewMemory,
} from "@/lib/memorization";
import { todayLocalISO } from "@/lib/streak";

export const Route = createFileRoute("/_authenticated/memorize")({
  head: () => ({ meta: [{ title: "Memorize · Faith Companion" }] }),
  component: Memorize,
});

type MemVerse = {
  id: string;
  verse_ref: string;
  verse_text: string;
  stage: number;
  due_at: string;
};

function Memorize() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const key = ["memory-verses", user.id];
  const today = todayLocalISO();

  const q = useQuery({
    queryKey: key,
    queryFn: async (): Promise<MemVerse[]> => {
      const { data, error } = await (supabase as any)
        .from("memory_verses")
        .select("id, verse_ref, verse_text, stage, due_at")
        .order("due_at");
      if (error) throw error;
      return (data ?? []) as MemVerse[];
    },
  });

  const all = q.data ?? [];
  const due = all.filter((v) => v.due_at <= today);
  const mastered = all.filter((v) => isMastered(v.stage)).length;

  // Review session
  const [queue, setQueue] = useState<MemVerse[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);

  async function grade(v: MemVerse, remembered: boolean) {
    const { stage, dueInDays } = reviewMemory(v.stage, remembered);
    await (supabase as any)
      .from("memory_verses")
      .update({
        stage,
        due_at: addDaysISO(today, dueInDays),
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", v.id);
    setRevealed(false);
    if (queue && idx + 1 < queue.length) {
      setIdx(idx + 1);
    } else {
      setQueue(null);
      setIdx(0);
      await qc.invalidateQueries({ queryKey: key });
    }
  }

  // --- Active review session ---
  if (queue && queue[idx]) {
    const v = queue[idx];
    return (
      <AppShell title="Review">
        <div className="space-y-stack-md">
          <div className="flex items-center justify-between text-sm text-on-surface-variant">
            <span>
              {idx + 1} of {queue.length}
            </span>
            <button
              onClick={() => {
                setQueue(null);
                setRevealed(false);
              }}
              className="hover:text-primary"
            >
              End session
            </button>
          </div>

          <Card tone="ink" padding="lg" className="min-h-[40dvh] text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-on-primary-container">
              {v.verse_ref}
            </p>
            {revealed ? (
              <p className="mt-6 font-serif text-xl italic leading-relaxed text-scripture-cream">
                “{v.verse_text}”
              </p>
            ) : (
              <p className="mt-10 text-on-primary-container">
                Recite it from memory, then reveal.
              </p>
            )}
          </Card>

          {revealed ? (
            <div className="grid grid-cols-2 gap-gutter">
              <Button
                variant="secondary"
                leftIcon="replay"
                onClick={() => grade(v, false)}
              >
                Forgot
              </Button>
              <Button leftIcon="check" onClick={() => grade(v, true)}>
                Remembered
              </Button>
            </div>
          ) : (
            <Button block size="lg" onClick={() => setRevealed(true)}>
              Reveal
            </Button>
          )}
        </div>
      </AppShell>
    );
  }

  // --- Overview ---
  return (
    <AppShell title="Memorize">
      <div className="space-y-stack-md">
        <ScreenTitle
          title="Memorize"
          subtitle="Hide God's word in your heart. Review a little each day and it sticks for life."
        />

        {q.isLoading ? (
          <Skeleton className="h-28" />
        ) : all.length === 0 ? (
          <EmptyState
            icon="neurology"
            title="Start your first verse"
            description="Open the Bible, tap a verse, and choose Memorize."
            action={
              <Link to="/bible">
                <Button variant="secondary" size="sm">
                  Open the Bible
                </Button>
              </Link>
            }
          />
        ) : (
          <>
            <Card tone="ink" padding="lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-serif text-4xl">{due.length}</p>
                  <p className="text-sm text-on-primary-container">
                    due to review today
                  </p>
                </div>
                <div className="text-right text-sm text-on-primary-container">
                  <p>{mastered} mastered</p>
                  <p>{all.length} total</p>
                </div>
              </div>
              {due.length > 0 && (
                <Button
                  block
                  className="mt-4 bg-secondary-container text-on-secondary-container hover:opacity-90"
                  leftIcon="play_arrow"
                  onClick={() => {
                    setQueue(due);
                    setIdx(0);
                    setRevealed(false);
                  }}
                >
                  Start review ({due.length})
                </Button>
              )}
            </Card>

            <section className="space-y-2">
              <SectionHeader>Your verses</SectionHeader>
              <ul className="space-y-2">
                {all.map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center justify-between rounded-xl border border-divider-soft bg-card p-4"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-primary">{v.verse_ref}</p>
                      <p className="truncate text-sm text-on-surface-variant">
                        {v.verse_text}
                      </p>
                    </div>
                    {isMastered(v.stage) ? (
                      <Chip tone="accent" icon="verified" iconFilled>
                        Mastered
                      </Chip>
                    ) : (
                      <Chip tone="neutral">
                        {v.stage}/{MASTERED_STAGE}
                      </Chip>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
