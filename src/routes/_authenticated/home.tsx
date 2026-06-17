import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { dailyDevotional } from "@/lib/ai-study.functions";
import { AppShell, SectionHeading } from "@/components/app/app-shell";
import { Icon } from "@/components/app/icon";
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
    const { data: prof } = await supabase
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

    const { data: stats } = await supabase
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

    await supabase.rpc("add_xp", { _amount: xpGain });
    let unlocked = 0;
    for (const code of dailyAchievementCodes({ streak: newStreak, planJustFinished })) {
      const { data: isNew } = await supabase.rpc("unlock_achievement", {
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
          <Link
            to="/companion"
            className="group flex items-center gap-4 overflow-hidden rounded-xl border border-wood-warm/40 bg-secondary-container/40 p-4"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-wood-warm text-white">
              <Icon name="local_florist" filled />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-serif text-lg text-primary">{season.title}</p>
              <p className="truncate text-sm text-on-surface-variant">
                {season.blurb}
              </p>
            </div>
            <span className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary">
              {season.cta}
            </span>
          </Link>
        )}

        {/* Welcome + progress */}
        <section className="flex items-end justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold uppercase tracking-widest text-wood-warm">
              {greeting}
            </p>
            <h2 className="font-serif text-3xl text-primary md:text-4xl">
              Peace be with you.
            </h2>
          </div>
          <Link to="/profile" className="flex shrink-0 flex-col items-end gap-1.5">
            <span className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-on-primary">
              <Icon name="workspace_premium" filled className="text-base" />
              <span className="text-xs font-semibold">
                Lv {levelFromXp(xp).level} · {levelFromXp(xp).rank}
              </span>
            </span>
            <span className="flex items-center gap-1.5 rounded-full bg-secondary-container px-3 py-1 text-on-secondary-container">
              <Icon name="local_fire_department" filled className="text-base" />
              <span className="text-xs font-semibold">
                {streak.current} Day{streak.current === 1 ? "" : "s"}
              </span>
            </span>
          </Link>
        </section>

        {/* Hero verse */}
        <section className="overflow-hidden rounded-xl bg-primary p-8 text-center shadow-sm md:p-12">
          <div className="space-y-stack-md">
            <div className="flex justify-center">
              <Icon
                name="format_quote"
                className="text-4xl text-on-primary-container opacity-50"
              />
            </div>
            {verse ? (
              <>
                <blockquote className="mx-auto max-w-lg font-serif text-[22px] italic leading-8 text-scripture-cream">
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
                  <span className="flex items-center gap-1 rounded-full bg-crisis-blue px-3 py-1 text-xs font-bold text-primary">
                    <Icon name="verified" filled className="text-sm" />
                    Verified text
                  </span>
                </div>
              </>
            ) : (
              <p className="font-serif text-lg italic text-scripture-cream/70">
                Loading today's verse…
              </p>
            )}
          </div>
        </section>

        {/* Today's AI reflection (grounded on the verse of the day) */}
        {devoLoading ? (
          <div className="h-32 animate-pulse rounded-xl border border-divider-soft bg-surface-container-low" />
        ) : devo ? (
          <section className="space-y-3 rounded-xl border border-divider-soft bg-white p-6">
            <div className="flex items-center gap-2">
              <Icon name="auto_awesome" filled className="text-wood-warm" />
              <p className="text-sm font-semibold uppercase tracking-widest text-wood-warm">
                Today's Reflection
              </p>
            </div>
            <p className="leading-relaxed text-on-surface">{devo.reflection}</p>
            <div className="rounded-lg bg-crisis-blue p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                A prayer
              </p>
              <p className="mt-1 font-serif italic text-on-surface">
                {devo.prayer}
              </p>
            </div>
          </section>
        ) : null}

        {/* Primary CTA */}
        <section>
          <button
            onClick={markToday}
            disabled={completedToday}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-primary py-5 text-lg font-semibold text-on-primary shadow-lg transition-all hover:bg-navy-deep active:scale-[0.98] disabled:opacity-60"
          >
            <Icon name={completedToday ? "task_alt" : "auto_stories"} />
            {completedToday ? "Today is complete" : "Begin Today's Devotion"}
          </button>
          <p className="mt-2 text-center text-sm text-on-surface-variant">
            {streak.current === 0
              ? "Today is a good day to begin."
              : completedToday
                ? "You showed up today — well done."
                : "Yesterday counted — sit with the verse a moment."}
          </p>
        </section>

        {/* Ask the Companion */}
        <Link
          to="/study"
          className="group flex items-center justify-between gap-4 rounded-xl border border-divider-soft bg-white p-5 transition-colors hover:border-wood-warm"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-crisis-blue text-primary">
              <Icon name="auto_awesome" filled />
            </div>
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
        </Link>

        {/* Today's journey (reading plan) */}
        <section className="space-y-stack-md">
          <SectionHeading
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
          </SectionHeading>

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
                <div className="group flex cursor-default flex-col items-start gap-4 rounded-xl border border-divider-soft bg-crisis-blue p-6 transition-colors md:col-span-2">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-primary shadow-sm">
                      <Icon name="front_hand" filled />
                    </div>
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
                </div>
              )}
            </div>
          ) : planComplete ? (
            <div className="rounded-xl border border-divider-soft bg-crisis-blue p-6 text-center">
              <Icon name="celebration" filled className="text-3xl text-wood-warm" />
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
            </div>
          ) : (
            <div className="rounded-xl border border-divider-soft bg-white p-6">
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
            </div>
          )}
        </section>

        {/* Community */}
        <section className="space-y-stack-md pb-4">
          <SectionHeading>Community Prayer</SectionHeading>
          <Link
            to="/groups"
            className="group block overflow-hidden rounded-xl border border-divider-soft bg-primary"
          >
            <div className="flex items-center justify-between gap-4 p-6 text-scripture-cream">
              <div>
                <p className="mb-1 text-sm font-semibold opacity-80">
                  Your circle is waiting
                </p>
                <p className="font-serif text-lg">
                  Join your group in intercession
                </p>
              </div>
              <Icon
                name="arrow_forward"
                className="text-2xl transition-transform group-hover:translate-x-1"
              />
            </div>
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
    <div className="group cursor-default space-y-4 rounded-xl border border-divider-soft bg-white p-6 transition-colors hover:border-wood-warm">
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container text-primary">
          <Icon name={icon} />
        </div>
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
    </div>
  );
}
