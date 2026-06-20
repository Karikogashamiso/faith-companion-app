import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { semanticVerseSearch } from "@/lib/search.functions";
import { AppShell } from "@/components/app/app-shell";
import { Icon } from "@/components/app/icon";
import { Button, Card, Chip, EmptyState, ScreenTitle, Skeleton } from "@/components/app/ui";
import { VerseImageSheet } from "@/components/app/verse-image";

export const Route = createFileRoute("/_authenticated/feelings")({
  head: () => ({ meta: [{ title: "How are you feeling? · Faith Companion" }] }),
  component: Feelings,
});

type Mood = { key: string; label: string; icon: string; query: string; line: string };

// Emotion-based entry point — the highest-converting surface across the niche
// (Abide/Pray/Glorify all organize content this way). Each mood maps to a
// natural-language query for the existing semantic retrieval.
const MOODS: Mood[] = [
  { key: "anxious", label: "Anxious", icon: "sentiment_stressed", query: "overcoming anxiety worry and fear, the peace of God that guards your heart", line: "Cast your anxiety on him, because he cares for you." },
  { key: "afraid", label: "Afraid", icon: "shield", query: "do not be afraid, God is with me, strength and courage", line: "When you are afraid, he is nearer than the fear." },
  { key: "sad", label: "Sad", icon: "sentiment_dissatisfied", query: "comfort in grief and sorrow, God close to the brokenhearted", line: "He is close to the brokenhearted." },
  { key: "lonely", label: "Lonely", icon: "person", query: "God's presence when lonely, never alone, he will never leave you", line: "You are not alone — he goes with you." },
  { key: "angry", label: "Angry", icon: "mood_bad", query: "slow to anger, patience, gentleness, forgiveness", line: "Be slow to anger; invite him into it." },
  { key: "overwhelmed", label: "Overwhelmed", icon: "filter_drama", query: "rest for the weary and burdened, cast your cares on God", line: "Come to him, all who are weary." },
  { key: "tempted", label: "Tempted", icon: "report", query: "resisting temptation, God provides a way out, strength to stand", line: "He will provide a way out." },
  { key: "guilty", label: "Guilty", icon: "healing", query: "forgiveness and grace, a clean heart, no condemnation in Christ", line: "There is no condemnation in Christ." },
  { key: "discouraged", label: "Discouraged", icon: "trending_down", query: "encouragement and strength when weary, renewed hope and endurance", line: "He renews the strength of the weary." },
  { key: "grateful", label: "Grateful", icon: "volunteer_activism", query: "thanksgiving and gratitude to God, give thanks in all circumstances", line: "Give thanks — his love endures forever." },
  { key: "hopeful", label: "Hopeful", icon: "wb_twilight", query: "hope and trust in God's promises, plans to give a future and a hope", line: "He holds your future and a hope." },
  { key: "joyful", label: "Joyful", icon: "sentiment_very_satisfied", query: "joy in the Lord, rejoice always, gladness of heart", line: "The joy of the Lord is your strength." },
];

type Hit = { id: number; book: string; chapter: number; verse: number; text: string };

function Feelings() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const searchFn = useServerFn(semanticVerseSearch);
  const [mood, setMood] = useState<Mood | null>(null);
  const [shareVerse, setShareVerse] = useState<Hit | null>(null);

  const q = useQuery({
    queryKey: ["feelings", mood?.key],
    enabled: Boolean(mood),
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<Hit[]> => {
      const r = await searchFn({ data: { query: mood!.query } });
      return ((r.results ?? []) as Hit[]).slice(0, 6);
    },
  });

  async function saveVerse(h: Hit) {
    const { error } = await (supabase as any)
      .from("bookmarks")
      .insert({ user_id: user.id, verse_id: h.id, collection: mood?.label ?? "Saved" });
    if (!error) toast("Saved to your journal");
    else if (error.code === "23505") toast("Already saved");
    else toast.error("Couldn't save", { description: error.message });
  }

  return (
    <AppShell title="How are you feeling?">
      <div className="space-y-stack-md">
        <ScreenTitle
          title="How are you feeling?"
          subtitle="Bring it to God — here's Scripture that meets you right there."
        />

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {MOODS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMood(m)}
              aria-pressed={mood?.key === m.key}
              className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-gentle ${
                mood?.key === m.key
                  ? "border-primary bg-secondary-container text-on-secondary-container"
                  : "border-divider-soft bg-card text-on-surface-variant hover:border-wood-warm"
              }`}
            >
              <Icon name={m.icon} className="text-2xl text-primary" />
              <span className="text-xs font-semibold">{m.label}</span>
            </button>
          ))}
        </div>

        {mood && (
          <div className="space-y-3">
            <Card tone="info" className="flex items-start gap-3">
              <Icon name="format_quote" className="text-2xl text-primary opacity-60" />
              <div className="min-w-0 flex-1">
                <p className="font-serif text-lg italic text-on-surface">{mood.line}</p>
                <Button
                  size="sm"
                  className="mt-2"
                  leftIcon="auto_awesome"
                  onClick={() =>
                    navigate({
                      to: "/study",
                      search: {
                        q: `I'm feeling ${mood.label.toLowerCase()} right now. What does the Bible say, and would you pray with me?`,
                      },
                    })
                  }
                >
                  Pray about this
                </Button>
              </div>
            </Card>

            {q.isFetching ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            ) : q.isError ? (
              <Card className="text-center text-sm text-destructive">
                Couldn't load verses — please try again.
              </Card>
            ) : (q.data ?? []).length === 0 ? (
              <EmptyState
                icon="search_off"
                title="No verses yet"
                description="Try another feeling — and loading the full Bible will expand results."
              />
            ) : (
              <ul className="space-y-2">
                {q.data!.map((h) => (
                  <li key={h.id}>
                    <Card padding="sm">
                      <div className="flex items-start justify-between gap-2">
                        <Chip tone="info">
                          {h.book} {h.chapter}:{h.verse}
                        </Chip>
                        <div className="flex gap-1">
                          <button
                            onClick={() => saveVerse(h)}
                            aria-label="Save verse"
                            className="text-on-surface-variant transition-gentle hover:text-primary"
                          >
                            <Icon name="bookmark_add" className="text-lg" />
                          </button>
                          <button
                            onClick={() => setShareVerse(h)}
                            aria-label="Share verse"
                            className="text-on-surface-variant transition-gentle hover:text-primary"
                          >
                            <Icon name="ios_share" className="text-lg" />
                          </button>
                        </div>
                      </div>
                      <p className="mt-2 font-serif text-[17px] leading-relaxed text-on-surface">
                        {h.text}
                      </p>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {shareVerse && (
        <VerseImageSheet
          open
          onClose={() => setShareVerse(null)}
          reference={`${shareVerse.book} ${shareVerse.chapter}:${shareVerse.verse}`}
          text={shareVerse.text}
        />
      )}
    </AppShell>
  );
}
