import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/app-shell";
import { Icon } from "@/components/app/icon";
import { Card, Chip, EmptyState, ScreenTitle, Skeleton } from "@/components/app/ui";
import { challengeProgress } from "@/lib/challenge";

export const Route = createFileRoute("/_authenticated/challenges")({
  head: () => ({ meta: [{ title: "Challenges · Faith Companion" }] }),
  component: Challenges,
});

type Challenge = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  day_count: number;
  accent: string | null;
};
type Row = Challenge & { count: number; lastDay: number; completed: boolean; joined: boolean };

function Challenges() {
  const q = useQuery({
    queryKey: ["challenges"],
    queryFn: async (): Promise<Row[]> => {
      const { data: ch, error } = await (supabase as any)
        .from("challenges")
        .select("id, slug, title, subtitle, day_count, accent")
        .eq("is_active", true)
        .order("sort");
      if (error) throw error;
      const list = (ch ?? []) as Challenge[];

      const { data: mine } = await (supabase as any)
        .from("challenge_participants")
        .select("challenge_id, last_completed_day, completed_at");
      const byId = new Map(
        ((mine ?? []) as any[]).map((m) => [m.challenge_id as string, m]),
      );

      const counts = await Promise.all(
        list.map((c) =>
          (supabase as any).rpc("challenge_participant_count", { _challenge_id: c.id }),
        ),
      );

      return list.map((c, i) => {
        const p = byId.get(c.id);
        return {
          ...c,
          count: (counts[i]?.data as number | null) ?? 0,
          lastDay: (p?.last_completed_day as number | undefined) ?? 0,
          completed: Boolean(p?.completed_at),
          joined: Boolean(p),
        };
      });
    },
  });

  const rows = q.data ?? [];

  return (
    <AppShell title="Challenges">
      <div className="space-y-stack-md">
        <ScreenTitle
          title="Challenges"
          subtitle="Short, guided journeys — and you're never doing them alone."
        />

        {q.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
        ) : q.isError ? (
          <EmptyState icon="error" title="Couldn't load challenges" description="Please try again." />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="flag"
            title="No challenges yet"
            description="New guided journeys are on the way."
          />
        ) : (
          <ul className="space-y-3">
            {rows.map((c) => {
              const prog = challengeProgress(c.lastDay, c.day_count);
              return (
                <li key={c.id}>
                  <Link to="/challenges/$slug" params={{ slug: c.slug }}>
                    <Card interactive className="space-y-3">
                      <div className="flex items-start gap-3">
                        <span
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                            c.accent === "gold"
                              ? "bg-primary text-on-primary"
                              : "bg-secondary-container text-on-secondary-container"
                          }`}
                        >
                          <Icon name="local_fire_department" filled />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-serif text-lg text-primary">{c.title}</p>
                          {c.subtitle && (
                            <p className="text-sm text-on-surface-variant">{c.subtitle}</p>
                          )}
                        </div>
                        <Chip tone="neutral">{c.day_count} days</Chip>
                      </div>

                      {c.joined && (
                        <div className="space-y-1">
                          <div className="h-1.5 overflow-hidden rounded-full bg-surface-container">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${prog.percent}%` }}
                            />
                          </div>
                          <p className="text-xs text-on-surface-variant">
                            {c.completed
                              ? "Completed 🎉"
                              : `Day ${prog.currentDay} of ${prog.total}`}
                          </p>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5 text-on-surface-variant">
                          <Icon name="group" className="text-base text-primary" />
                          {c.count.toLocaleString()} {c.count === 1 ? "person" : "people"} praying
                        </span>
                        <span className="font-semibold text-primary">
                          {c.completed ? "Review" : c.joined ? "Continue →" : "Start →"}
                        </span>
                      </div>
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
