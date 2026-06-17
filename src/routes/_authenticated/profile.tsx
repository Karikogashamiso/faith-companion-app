import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, SectionHeading } from "@/components/app/app-shell";
import { Icon } from "@/components/app/icon";
import { levelFromXp } from "@/lib/gamification";
import { addDays, computeStreak, todayLocalISO } from "@/lib/streak";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Progress · Discipleship Companion" }] }),
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
        supabase.from("user_stats" as any).select("xp").eq("user_id", user.id).maybeSingle(),
        supabase
          .from("achievements" as any)
          .select("code, title, description, icon, xp, sort")
          .order("sort"),
        supabase.from("user_achievements" as any).select("code").eq("user_id", user.id),
        supabase
          .from("daily_activity")
          .select("activity_date")
          .eq("user_id", user.id)
          .order("activity_date", { ascending: false })
          .limit(400),
      ]);
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

  return (
    <AppShell title="Progress">
      <div className="space-y-stack-lg">
        <h1 className="font-serif text-3xl text-primary">Your journey</h1>

        {/* Level + XP */}
        <section className="rounded-xl bg-primary p-6 text-scripture-cream">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-on-primary-container">
                Level {lvl.level}
              </p>
              <p className="font-serif text-3xl">{lvl.rank}</p>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-scripture-cream/15">
              <Icon name="workspace_premium" filled className="text-3xl" />
            </div>
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
        </section>

        {/* Stat tiles */}
        <section className="grid grid-cols-3 gap-gutter">
          <StatTile icon="local_fire_department" value={streak.current} label="Current streak" />
          <StatTile icon="trending_up" value={streak.longest} label="Longest streak" />
          <StatTile icon="calendar_month" value={totalDays} label="Days shown up" />
        </section>

        {/* Activity heatmap */}
        <section className="space-y-stack-sm">
          <SectionHeading>Last 5 weeks</SectionHeading>
          <div className="grid grid-cols-7 gap-1.5 rounded-xl border border-divider-soft bg-white p-4">
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
        </section>

        {/* Achievements */}
        <section className="space-y-stack-sm">
          <SectionHeading>Achievements</SectionHeading>
          {q.isLoading ? (
            <div className="grid grid-cols-2 gap-gutter">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-28 animate-pulse rounded-xl border border-divider-soft bg-surface-container-low"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-gutter">
              {(q.data?.catalog ?? []).map((a) => {
                const got = q.data?.earned.has(a.code);
                return (
                  <div
                    key={a.code}
                    className={`rounded-xl border p-4 ${
                      got
                        ? "border-wood-warm/50 bg-secondary-container/30"
                        : "border-divider-soft bg-white opacity-70"
                    }`}
                  >
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                        got
                          ? "bg-wood-warm text-white"
                          : "bg-surface-container text-outline"
                      }`}
                    >
                      <Icon name={got ? a.icon : "lock"} filled={got} />
                    </div>
                    <p className="mt-2 font-semibold text-primary">{a.title}</p>
                    <p className="text-xs text-on-surface-variant">
                      {a.description}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-wood-warm">
                      +{a.xp} XP
                    </p>
                  </div>
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
    <div className="rounded-xl border border-divider-soft bg-white p-4 text-center">
      <Icon name={icon} filled className="text-2xl text-wood-warm" />
      <p className="mt-1 font-serif text-2xl text-primary">{value}</p>
      <p className="text-[11px] leading-tight text-on-surface-variant">{label}</p>
    </div>
  );
}
