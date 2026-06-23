import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/app-shell";
import { Icon } from "@/components/app/icon";
import { Button, Card, Chip, EmptyState, Skeleton } from "@/components/app/ui";
import { challengeProgress } from "@/lib/challenge";

export const Route = createFileRoute("/_authenticated/challenges/$slug")({
  head: () => ({ meta: [{ title: "Challenge · Faith Companion" }] }),
  component: ChallengeDetail,
});

type Day = {
  day_number: number;
  title: string;
  scripture_ref: string | null;
  prompt: string | null;
  prayer: string | null;
};

function ChallengeDetail() {
  const { slug } = Route.useParams();
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const key = ["challenge", slug, user.id];

  const q = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data: c } = await (supabase as any)
        .from("challenges")
        .select("id, slug, title, subtitle, description, day_count, accent")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();
      if (!c) return null;
      const [{ data: days }, { data: part }, { data: count }] = await Promise.all([
        (supabase as any)
          .from("challenge_days")
          .select("day_number, title, scripture_ref, prompt, prayer")
          .eq("challenge_id", c.id)
          .order("day_number"),
        (supabase as any)
          .from("challenge_participants")
          .select("last_completed_day, completed_at")
          .eq("challenge_id", c.id)
          .maybeSingle(),
        (supabase as any).rpc("challenge_participant_count", { _challenge_id: c.id }),
      ]);
      return {
        challenge: c,
        days: (days ?? []) as Day[],
        part: part as { last_completed_day: number; completed_at: string | null } | null,
        count: (count as number | null) ?? 0,
      };
    },
  });

  const join = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from("challenge_participants")
        .insert({ user_id: user.id, challenge_id: q.data!.challenge.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("You're in 🙏");
      qc.invalidateQueries({ queryKey: key });
    },
    onError: (e) => toast.error("Couldn't join", { description: (e as Error).message }),
  });

  const completeDay = useMutation({
    mutationFn: async (nextDay: number) => {
      const c = q.data!.challenge;
      const isLast = nextDay >= c.day_count;
      const { error } = await (supabase as any)
        .from("challenge_participants")
        .update({
          last_completed_day: nextDay,
          completed_at: isLast ? new Date().toISOString() : null,
        })
        .eq("user_id", user.id)
        .eq("challenge_id", c.id);
      if (error) throw error;
      // Best-effort streak credit — never block completion if it fails.
      await supabase.from("daily_activity").upsert(
        {
          user_id: user.id,
          activity_date: new Date().toISOString().slice(0, 10),
          source: "challenge",
        },
        { onConflict: "user_id,activity_date" },
      );
      return isLast;
    },
    onSuccess: (isLast) => {
      toast.success(isLast ? "Challenge complete! 🎉" : "Day complete 🙏");
      void supabase.rpc("add_xp" as any, { _amount: 10 });
      qc.invalidateQueries({ queryKey: key });
    },
    onError: (e) => toast.error("Couldn't save", { description: (e as Error).message }),
  });

  if (q.isLoading) {
    return (
      <AppShell title="Challenge">
        <Skeleton className="h-48" />
      </AppShell>
    );
  }
  if (!q.data) {
    return (
      <AppShell title="Challenge">
        <EmptyState icon="flag" title="Challenge not found" description="It may have ended." />
        <div className="mt-4 text-center">
          <Link to="/challenges" className="text-sm font-semibold text-primary hover:underline">
            Back to challenges
          </Link>
        </div>
      </AppShell>
    );
  }

  const { challenge, days, part, count } = q.data;
  const prog = challengeProgress(part?.last_completed_day ?? 0, challenge.day_count);
  const today = days.find((d) => d.day_number === prog.currentDay);

  return (
    <AppShell title={challenge.title}>
      <div className="space-y-stack-md">
        <Link to="/challenges" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <Icon name="arrow_back" className="text-base" /> Challenges
        </Link>

        <header className="space-y-2 text-center">
          <h1 className="font-serif text-3xl text-primary">{challenge.title}</h1>
          {challenge.subtitle && <p className="text-on-surface-variant">{challenge.subtitle}</p>}
          <p className="flex items-center justify-center gap-1.5 text-sm text-on-surface-variant">
            <Icon name="group" className="text-base text-primary" />
            {count.toLocaleString()} {count === 1 ? "person" : "people"} on this journey
          </p>
        </header>

        {/* Progress */}
        {part && (
          <div className="space-y-1">
            <div className="h-2 overflow-hidden rounded-full bg-surface-container">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${prog.percent}%` }} />
            </div>
            <p className="text-center text-xs text-on-surface-variant">
              {prog.done} of {prog.total} days · {prog.percent}%
            </p>
          </div>
        )}

        {/* Not joined yet */}
        {!part && (
          <Card className="space-y-4 text-center">
            {challenge.description && (
              <p className="text-on-surface-variant">{challenge.description}</p>
            )}
            <Button block leftIcon="local_fire_department" loading={join.isPending} onClick={() => join.mutate()}>
              Join the challenge
            </Button>
          </Card>
        )}

        {/* Completed */}
        {part && prog.isComplete && (
          <Card tone="info" className="space-y-2 text-center">
            <Icon name="celebration" filled className="text-4xl text-primary" />
            <p className="font-serif text-xl text-primary">You finished {challenge.title}!</p>
            <p className="text-sm text-on-surface-variant">
              Well done showing up. Revisit any day below whenever you need it.
            </p>
          </Card>
        )}

        {/* Today's day */}
        {part && !prog.isComplete && today && (
          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <Chip tone="info">Day {today.day_number}</Chip>
              {today.scripture_ref && (
                <span className="text-sm font-semibold text-primary">{today.scripture_ref}</span>
              )}
            </div>
            <h2 className="font-serif text-xl text-primary">{today.title}</h2>
            {today.prompt && (
              <p className="leading-relaxed text-on-surface">{today.prompt}</p>
            )}
            {today.prayer && (
              <p className="border-l-2 border-primary/40 pl-3 font-serif italic text-on-surface-variant">
                {today.prayer}
              </p>
            )}
            <Button
              block
              leftIcon="check_circle"
              loading={completeDay.isPending}
              onClick={() => completeDay.mutate(prog.currentDay)}
            >
              Mark Day {today.day_number} complete
            </Button>
          </Card>
        )}

        {/* Day list (review) */}
        {part && (
          <ul className="space-y-1.5">
            {days.map((d) => {
              const done = d.day_number <= (part.last_completed_day ?? 0);
              const isToday = d.day_number === prog.currentDay && !prog.isComplete;
              return (
                <li
                  key={d.day_number}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                    isToday ? "border-primary bg-secondary-container/30" : "border-divider-soft bg-card"
                  }`}
                >
                  <Icon
                    name={done ? "check_circle" : "radio_button_unchecked"}
                    filled={done}
                    className={done ? "text-primary" : "text-outline"}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm text-on-surface">
                    Day {d.day_number} · {d.title}
                  </span>
                  {d.scripture_ref && (
                    <span className="shrink-0 text-xs text-on-surface-variant">{d.scripture_ref}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
