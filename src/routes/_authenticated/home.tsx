import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { dailyDevotional } from "@/lib/ai-study.functions";
import { AppShell } from "@/components/app/app-shell";
import { Icon } from "@/components/app/icon";
import {
  Button,
  Card,
  Chip,
  IconBadge,
  SectionHeader,
  Skeleton,
} from "@/components/app/ui";
import { computeStreak, todayLocalISO } from "@/lib/streak";
import {
  DAILY_XP,
  PLAN_DAY_XP,
  dailyAchievementCodes,
  levelFromXp,
} from "@/lib/gamification";
import { currentSeason } from "@/lib/seasons";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({ meta: [{ title: "Today · Discipleship Companion" }] }),
  component: Home,
});

type Verse = { id: number; book: string; chapter: number; verse: number; text: string };
type PlanDay = {
  id: string;
  day_number: number;
  passage_ref: string;
  reflection_md: string | null;
  prayer_md: string | null;
};

function Home() {
  const { user } = Route.useRouteContext();
  const [verse, setVerse] = useState<Verse | null>(null);
  const [planDay, setPlanDay] = useState<PlanDay | null>(null);
  const [planTitle, setPlanTitle] = useState<string | null>(null);
  const [streak, setStreak] = useState({ current: 0, longest: 0 });
  const [completedToday, setCompletedToday] = useState(false);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [planCurrentDay, setPlanCurrentDay] = useState<number | null>(null);
  const [planComplete, setPlanComplete] = useState(false);
  const [planDayCount, setPlanDayCount] = useState(0);
  const [xp, setXp] = useState(0);
  const season = currentSeason();

  const devotionalFn = useServerFn(dailyDevotional);
  const [devo, setDevo] = useState<{
    reflection: string;
    prayer: string;
    verse_ref: string;
  } | null>(null);
  const [devoLoading, setDevoLoading] = useState(true);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  // The daily AI reflection (cached server-side once per day).
  useEffect(() => {
    let cancelled = false;
    setDevoLoading(true);
    void (async () => {
      try {
        const r = await devotionalFn();
        if (!cancelled && r && !r.disabled) {
          setDevo({
            reflection: r.reflection,
            prayer: r.prayer,
            verse_ref: r.verse_ref,
          });
        }
      } catch {
        /* devotional is a bonus — never block the page */
      } finally {
        if (!cancelled) setDevoLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  async function load() {
      const { data: prof } = await (supabase as any)
        .from("profiles")
        .select("default_version_id, active_plan_id")
        .eq("id", user.id)
        .maybeSingle();

    let versionId = prof?.default_version_id;
    if (!versionId) {
      const { data: v } = await supabase
        .from("bible_versions")
        .select("id")
        .limit(1)
        .maybeSingle();
      versionId = v?.id ?? null;
    }

    if (versionId) {
      const { data: vot } = await supabase.rpc("verse_of_the_day", {
        p_version_id: versionId,
      });
      if (vot && Array.isArray(vot) && vot[0]) setVerse(vot[0] as Verse);
    }

    // Active reading plan → show the next uncompleted day.
    const planId = (prof?.active_plan_id as string | null) ?? null;
    setActivePlanId(planId);
    setPlanDay(null);
    setPlanComplete(false);
    setPlanCurrentDay(null);
    if (planId) {
      const [{ data: plan }, { data: prog }] = await Promise.all([
        supabase
          .from("reading_plans")
          .select("title, day_count")
          .eq("id", planId)
          .maybeSingle(),
        supabase
          .from("user_plan_progress")
          .select("day_completed")
          .eq("user_id", user.id)
          .eq("plan_id", planId)
          .order("day_completed", { ascending: false })
          .limit(1),
      ]);
      setPlanTitle((plan as { title: string } | null)?.title ?? null);
      const dayCount = (plan as { day_count: number } | null)?.day_count ?? 0;
      setPlanDayCount(dayCount);
      const maxDone = prog && prog[0] ? (prog[0].day_completed as number) : 0;
      const nextDay = maxDone + 1;
      if (nextDay <= dayCount) {
        const { data: pd } = await supabase
          .from("plan_days")
          .select("id, day_number, passage_ref, reflection_md, prayer_md")
          .eq("plan_id", planId)
          .eq("day_number", nextDay)
          .maybeSingle();
        setPlanDay(pd as PlanDay | null);
        setPlanCurrentDay(nextDay);
      } else {
        setPlanComplete(true);
      }
    }

    const { data: act } = await supabase
      .from("daily_activity")
      .select("activity_date")
      .eq("user_id", user.id)
      .order("activity_date", { ascending: false })
      .limit(120);
    const dates = (act ?? []).map((a: any) => a.activity_date as string);
    setStreak(computeStreak(dates));
    setCompletedToday(dates.includes(todayLocalISO()));

    const { data: stats } = await (supabase as any)
      .from("user_stats")
      .select("xp")
      .eq("user_id", user.id)
      .maybeSingle();
    setXp((stats?.xp as number | undefined) ?? 0);
  }

  async function markToday() {
    if (completedToday) return;
    await supabase
      .from("daily_activity")
      .upsert({ user_id: user.id, activity_date: todayLocalISO(), source: "home" });

    // Advance the active plan by recording the day just completed.
    let planJustFinished = false;
    let xpGain = DAILY_XP;
    if (activePlanId && planCurrentDay) {
      await supabase.from("user_plan_progress").upsert(
        {
          user_id: user.id,
          plan_id: activePlanId,
          day_completed: planCurrentDay,
        },
        { onConflict: "user_id,plan_id,day_completed" },
      );
      xpGain += PLAN_DAY_XP;
      if (planDayCount && planCurrentDay >= planDayCount) planJustFinished = true;
    }

    // Recompute the streak including today, then grant rewards server-side.
    const { data: act } = await supabase
      .from("daily_activity")
      .select("activity_date")
      .eq("user_id", user.id)
      .order("activity_date", { ascending: false })
      .limit(120);
    const newStreak = computeStreak(
      (act ?? []).map((a: any) => a.activity_date as string),
    ).current;

    await supabase.rpc("add_xp" as any, { _amount: xpGain });
    let unlocked = 0;
    for (const code of dailyAchievementCodes({ streak: newStreak, planJustFinished })) {
      const { data: isNew } = await supabase.rpc("unlock_achievement" as any, {
        _code: code,
      });
      if (isNew) unlocked++;
    }

    toast.success(`+${xpGain} XP`, {
      description:
        newStreak > 1 ? `${newStreak}-day streak — keep it going` : "Day complete",
    });
    if (unlocked > 0) {
      toast("🏅 Achievement unlocked!", {
        description: "See it on your Progress page.",
      });
    }
    void load();
  }

  const greeting = greetingForNow();

  return (
    <AppShell>
      <div className="space-y-stack-lg">
        {/* Seasonal conversion campaign (Lent / Advent / New Year) */}
        {season && (
          <Link to="/companion" className="block">
            <Card tone="accent" interactive className="flex items-center gap-4">
              <IconBadge name="local_florist" filled tone="wood" />
              <div className="min-w-0 flex-1">
                <p className="font-serif text-lg text-primary">{season.title}</p>
                <p className="truncate text-sm text-on-surface-variant">
                  {season.blurb}
                </p>
              </div>
              <Chip tone="ink" className="shrink-0">
                {season.cta}
              </Chip>
            </Card>
          </Link>
        )}

        {/* Welcome + progress */}
        <section className="flex items-end justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold uppercase tracking-widest text-wood-warm">
              {greeting}
            </p>
            <h1 className="font-serif text-3xl text-primary md:text-4xl">
              Peace be with you.
            </h1>
          </div>
          <Link to="/profile" className="flex shrink-0 flex-col items-end gap-1.5">
            <Chip tone="ink" icon="workspace_premium" iconFilled className="rounded-full">
              Lv {levelFromXp(xp).level} · {levelFromXp(xp).rank}
            </Chip>
            <Chip
              tone="accent"
              icon="local_fire_department"
              iconFilled
              className="rounded-full"
            >
              {streak.current} Day{streak.current === 1 ? "" : "s"}
            </Chip>
          </Link>
        </section>

        {/* Hero verse — the single focal point */}
        <Card tone="ink" padding="lg" className="text-center md:p-12">
          <div className="space-y-stack-md">
            <Icon
              name="format_quote"
              className="text-4xl text-on-primary-container opacity-50"
            />
            {verse ? (
              <>
                <blockquote className="mx-auto max-w-lg font-serif text-xl italic leading-relaxed text-primary-foreground">
                  &ldquo;{verse.text}&rdquo;
                </blockquote>
                <div className="flex flex-col items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="h-px w-8 bg-on-primary-container opacity-50" />
                    <cite className="text-sm font-semibold uppercase not-italic tracking-widest text-on-primary-container">
                      {verse.book} {verse.chapter}:{verse.verse}
                    </cite>
                    <span className="h-px w-8 bg-on-primary-container opacity-50" />
                  </div>
                  <Chip tone="info" icon="verified" iconFilled className="rounded-full">
                    Verified text
                  </Chip>
                </div>
              </>
            ) : (
              <p className="font-serif text-lg italic text-primary-foreground/70">
                Loading today's verse…
              </p>
            )}
          </div>
        </Card>

        {/* Today's AI reflection (grounded on the verse of the day) */}
        {devoLoading ? (
          <Skeleton className="h-32" />
        ) : devo ? (
          <Card className="space-y-3">
            <div className="flex items-center gap-2">
              <Icon name="auto_awesome" filled className="text-wood-warm" />
              <p className="text-sm font-semibold uppercase tracking-widest text-wood-warm">
                Today's Reflection
              </p>
            </div>
            <p className="measure leading-relaxed text-on-surface">
              {devo.reflection}
            </p>
            <Card tone="info" padding="sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                A prayer
              </p>
              <p className="mt-1 font-serif italic text-on-surface">
                {devo.prayer}
              </p>
            </Card>
          </Card>
        ) : null}

        {/* Primary action — the obvious focal CTA */}
        <div>
          <Button
            size="lg"
            block
            onClick={markToday}
            disabled={completedToday}
            leftIcon={completedToday ? "task_alt" : "auto_stories"}
            className="h-14 text-lg"
          >
            {completedToday ? "Today is complete" : "Begin Today's Devotion"}
          </Button>
          <p className="mt-2 text-center text-sm text-on-surface-variant">
            {streak.current === 0
              ? "Today is a good day to begin."
              : completedToday
                ? "You showed up today — well done."
                : "Yesterday counted — sit with the verse a moment."}
          </p>
        </div>

        {/* Ask the Companion */}
        <Link to="/study" className="group block">
          <Card interactive className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <IconBadge name="auto_awesome" filled tone="info" />
              <div>
                <p className="font-serif text-lg text-primary">
                  Ask the Companion
                </p>
                <p className="text-sm text-on-surface-variant">
                  Grounded answers, every verse linked
                </p>
              </div>
            </div>
            <Icon
              name="arrow_forward"
              className="text-outline transition-transform group-hover:translate-x-1 group-hover:text-wood-warm"
            />
          </Card>
        </Link>

        {/* Quick links to the engagement tools */}
        <section className="grid grid-cols-3 gap-gutter">
          {[
            { to: "/prayers" as const, icon: "front_hand", label: "My Prayers" },
            { to: "/memorize" as const, icon: "neurology", label: "Memorize" },
            { to: "/saved" as const, icon: "bookmark", label: "Saved" },
          ].map((l) => (
            <Link key={l.to} to={l.to} className="block">
              <Card
                interactive
                padding="sm"
                className="flex flex-col items-center gap-2 text-center"
              >
                <IconBadge name={l.icon} tone="info" />
                <span className="text-sm font-semibold text-primary">
                  {l.label}
                </span>
              </Card>
            </Link>
          ))}
        </section>

        {/* Today's journey (reading plan) */}
        <section className="space-y-stack-md">
          <SectionHeader
            trailing={
              <Link
                to="/plans"
                className="text-sm font-semibold text-wood-warm hover:text-primary"
              >
                {planDay ? `Day ${planDay.day_number}` : "Plans"}
              </Link>
            }
          >
            Today's Journey
          </SectionHeader>

          {planDay ? (
            <div className="grid grid-cols-1 gap-gutter md:grid-cols-2">
              <JourneyCard
                icon="menu_book"
                eyebrow="The Passage"
                title={planDay.passage_ref}
                body={planTitle ?? "Today's reading"}
              />
              {planDay.reflection_md && (
                <JourneyCard
                  icon="psychology"
                  eyebrow="Reflection"
                  title="Sit & reflect"
                  body={planDay.reflection_md}
                />
              )}
              {planDay.prayer_md && (
                <Card
                  tone="info"
                  className="flex flex-col items-start gap-4 md:col-span-2"
                >
                  <div className="flex items-center gap-4">
                    <IconBadge name="front_hand" filled tone="ink" shape="round" size="lg" />
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-wide text-primary">
                        The Prayer
                      </p>
                      <h4 className="font-serif text-xl text-primary">
                        A moment of prayer
                      </h4>
                    </div>
                  </div>
                  <p className="whitespace-pre-wrap font-serif italic leading-relaxed text-on-surface-variant">
                    {planDay.prayer_md}
                  </p>
                </Card>
              )}
            </div>
          ) : planComplete ? (
            <Card className="text-center">
              <div className="flex justify-center">
                <IconBadge name="celebration" filled tone="accent" size="lg" shape="round" />
              </div>
              <p className="mt-2 font-serif text-xl text-primary">
                You finished {planTitle ?? "your plan"}.
              </p>
              <p className="mt-1 text-sm text-on-surface-variant">
                Well done showing up. Ready for the next one?
              </p>
              <Link
                to="/plans"
                className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-wood-warm"
              >
                Browse reading plans
                <Icon name="arrow_forward" className="text-base" />
              </Link>
            </Card>
          ) : (
            <Card>
              <p className="text-on-surface-variant">
                No active plan yet. A short daily reading is the easiest way to
                build the habit — there's no rush.
              </p>
              <Link
                to="/plans"
                className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-wood-warm hover:text-primary"
              >
                Browse reading plans
                <Icon name="arrow_forward" className="text-base" />
              </Link>
            </Card>
          )}
        </section>

        {/* Community */}
        <section className="space-y-stack-md pb-4">
          <SectionHeader>Community Prayer</SectionHeader>
          <Link to="/wall" className="group block">
            <Card
              tone="ink"
              interactive
              className="flex items-center justify-between gap-4"
            >
              <div>
                <p className="mb-1 text-sm font-semibold text-on-primary-container">
                  You're never praying alone
                </p>
                <p className="font-serif text-lg text-primary-foreground">
                  Pray with people around the world
                </p>
              </div>
              <Icon
                name="public"
                className="text-2xl text-primary-foreground transition-transform group-hover:translate-x-1"
              />
            </Card>
          </Link>
          <Link to="/groups" className="group block">
            <Card interactive className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <IconBadge name="group" tone="neutral" />
                <p className="font-serif text-lg text-primary">
                  Your groups & circles
                </p>
              </div>
              <Icon
                name="arrow_forward"
                className="text-outline transition-transform group-hover:translate-x-1 group-hover:text-wood-warm"
              />
            </Card>
          </Link>
        </section>
      </div>
    </AppShell>
  );
}

function greetingForNow() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 18) return "Good Afternoon";
  return "Good Evening";
}

function JourneyCard({
  icon,
  eyebrow,
  title,
  body,
}: {
  icon: string;
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <Card interactive className="group space-y-4">
      <div className="flex items-start justify-between">
        <IconBadge name={icon} tone="neutral" />
        <Icon
          name="arrow_forward"
          className="text-outline transition-colors group-hover:text-wood-warm"
        />
      </div>
      <div>
        <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-on-surface-variant">
          {eyebrow}
        </p>
        <h4 className="font-serif text-xl text-primary">{title}</h4>
        <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-on-surface-variant">
          {body}
        </p>
      </div>
    </Card>
  );
}
