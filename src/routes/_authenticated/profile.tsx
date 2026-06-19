import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/app-shell";
import { Icon } from "@/components/app/icon";
import { Card, EmptyState, IconBadge, SectionHeader, Skeleton } from "@/components/app/ui";
import { levelFromXp } from "@/lib/gamification";
import { addDays, computeStreak, todayLocalISO } from "@/lib/streak";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Progress · Faith Companion" }] }),
  component: Profile,
});

type Achievement = {
  code: string;
  title: string;
  description: string;
  icon: string;
  xp: number;
  sort: number;
};

function Profile() {
  const { user } = Route.useRouteContext();

  const q = useQuery({
    queryKey: ["profile-progress", user.id],
    queryFn: async () => {
      const [stats, catalog, earned, activity] = await Promise.all([
        (supabase as any).from("user_stats").select("xp").eq("user_id", user.id).maybeSingle(),
        (supabase as any)
          .from("achievements")
          .select("code, title, description, icon, xp, sort")
          .order("sort"),
        (supabase as any).from("user_achievements").select("code").eq("user_id", user.id),
        supabase
          .from("daily_activity")
          .select("activity_date")
          .eq("user_id", user.id)
          .order("activity_date", { ascending: false })
          .limit(400),
      ]);
      // Surface real failures instead of rendering a misleading 0-XP page.
      if (stats.error || catalog.error || activity.error) {
        throw stats.error || catalog.error || activity.error;
      }
      return {
        xp: (stats.data?.xp as number | undefined) ?? 0,
        catalog: ((catalog.data ?? []) as unknown) as Achievement[],
        earned: new Set(((earned.data ?? []) as any[]).map((e: any) => e.code as string)),
        dates: (activity.data ?? []).map((a: any) => a.activity_date as string),
      };
    },
  });

  const xp = q.data?.xp ?? 0;
  const lvl = levelFromXp(xp);
  const dateSet = new Set(q.data?.dates ?? []);
  const streak = computeStreak(q.data?.dates ?? []);
  const totalDays = dateSet.size;

  // 5-week heatmap ending today.
  const today = todayLocalISO();
  const heatmap = Array.from({ length: 35 }, (_, i) => {
    const d = addDays(today, -(34 - i));
    return { date: d, active: dateSet.has(d) };
  });

  if (q.isLoading) {
    return (
      <AppShell title="Progress">
        <div className="space-y-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-40" />
        </div>
      </AppShell>
    );
  }
  if (q.isError) {
    return (
      <AppShell title="Progress">
        <EmptyState
          icon="error"
          title="Couldn't load your progress"
          description="Please check your connection and try again."
        />
      </AppShell>
    );
  }

  return (
    <AppShell title="Progress">
      <div className="space-y-stack-lg">
        <h1 className="font-serif text-3xl text-primary">Your journey</h1>

        {/* Level + XP */}
        <Card tone="ink" padding="lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-on-primary-container">
                Level {lvl.level}
              </p>
              <p className="font-serif text-3xl">{lvl.rank}</p>
            </div>
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-scripture-cream/15">
              <Icon name="workspace_premium" filled className="text-3xl" />
            </span>
          </div>
          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-scripture-cream/20">
              <div
                className="h-full rounded-full bg-secondary-container transition-all"
                style={{ width: `${Math.round(lvl.progress * 100)}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-on-primary-container">
              {lvl.intoLevel} / {lvl.forLevel} XP to Level {lvl.level + 1} ·{" "}
              {xp} total
            </p>
          </div>
        </Card>

        {/* Stat tiles */}
        <section className="grid grid-cols-3 gap-gutter">
          <StatTile icon="local_fire_department" value={streak.current} label="Current streak" />
          <StatTile icon="trending_up" value={streak.longest} label="Longest streak" />
          <StatTile icon="calendar_month" value={totalDays} label="Days shown up" />
        </section>

        {/* Activity heatmap */}
        <section className="space-y-stack-sm">
          <SectionHeader>Last 5 weeks</SectionHeader>
          <Card padding="sm">
            <div className="grid grid-cols-7 gap-1.5">
              {heatmap.map((d) => (
                <div
                  key={d.date}
                  title={d.date}
                  className={`aspect-square rounded-md ${
                    d.active ? "bg-wood-warm" : "bg-surface-container"
                  }`}
                />
              ))}
            </div>
          </Card>
        </section>

        {/* Achievements */}
        <section className="space-y-stack-sm">
          <SectionHeader>Achievements</SectionHeader>
          {q.isLoading ? (
            <div className="grid grid-cols-2 gap-gutter">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-28" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-gutter">
              {(q.data?.catalog ?? []).map((a) => {
                const got = q.data?.earned.has(a.code) ?? false;
                return (
                  <Card
                    key={a.code}
                    tone={got ? "accent" : "base"}
                    padding="sm"
                    className={got ? "" : "opacity-70"}
                  >
                    <IconBadge
                      name={got ? a.icon : "lock"}
                      filled={got}
                      tone={got ? "wood" : "neutral"}
                      size="sm"
                    />
                    <p className="mt-2 font-semibold text-primary">{a.title}</p>
                    <p className="text-xs text-on-surface-variant">
                      {a.description}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-wood-warm">
                      +{a.xp} XP
                    </p>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function StatTile({
  icon,
  value,
  label,
}: {
  icon: string;
  value: number;
  label: string;
}) {
  return (
    <Card padding="sm" className="text-center">
      <Icon name={icon} filled className="text-2xl text-wood-warm" />
      <p className="mt-1 font-serif text-2xl text-primary">{value}</p>
      <p className="text-xs leading-tight text-on-surface-variant">{label}</p>
    </Card>
  );
}
