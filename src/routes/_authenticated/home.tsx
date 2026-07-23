import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { dailyDevotional } from "@/lib/ai-study.functions";
import { AppShell } from "@/components/app/app-shell";
import { Icon } from "@/components/app/icon";
import { Constellation } from "@/components/app/constellation";
import { VerseImageSheet } from "@/components/app/verse-image";

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
import {
  getReadingPosition,
  type ReadingPosition,
} from "@/lib/reading-position";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({ meta: [{ title: "Today · Faith Companion" }] }),
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
  const [shareVerse, setShareVerse] = useState<Verse | null>(null);
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
  const [resume, setResume] = useState<ReadingPosition | null>(null);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [welcomeStep, setWelcomeStep] = useState<number | null>(null);
  const [welcomeCompleted, setWelcomeCompleted] = useState<boolean>(false);
  const [day1Started, setDay1Started] = useState(false);
  const [day1Viewed, setDay1Viewed] = useState<Record<string, boolean>>({});
  const [resumeHighlightId, setResumeHighlightId] = useState<string | null>(null);
  const [resumeAnnouncement, setResumeAnnouncement] = useState<string>("");
  const announcedCompleteRef = useRef(false);
  const announceTimerRef = useRef<number | null>(null);
  useEffect(() => setResume(getReadingPosition()), []);

  // Local per-device tracking of Day 1 "started" + which sub-items the user
  // has actually seen. Enables the "Resume Day 1" affordance and lets us
  // scroll to the first item that hasn't been viewed yet.
  const startedKey = activePlanId ? `plan-started:${activePlanId}:day1` : null;
  const viewedKey = activePlanId ? `plan-viewed:${activePlanId}:day1` : null;
  useEffect(() => {
    if (!startedKey || !viewedKey) return;
    try {
      setDay1Started(localStorage.getItem(startedKey) === "1");
      setDay1Viewed(JSON.parse(localStorage.getItem(viewedKey) ?? "{}"));
    } catch {
      /* ignore */
    }
  }, [startedKey, viewedKey]);

  // Observe journey sub-items and mark them viewed once they enter the viewport.
  useEffect(() => {
    if (!viewedKey || !planDay || planCurrentDay !== 1) return;
    const ids = ["plan-passage", "plan-reflection", "plan-prayer"];
    const io = new IntersectionObserver(
      (entries) => {
        setDay1Viewed((prev) => {
          let changed = false;
          const next = { ...prev };
          for (const e of entries) {
            if (e.isIntersecting && !next[e.target.id]) {
              next[e.target.id] = true;
              changed = true;
            }
          }
          if (changed) {
            try { localStorage.setItem(viewedKey, JSON.stringify(next)); } catch { /* ignore */ }
            return next;
          }
          return prev;
        });
      },
      { threshold: 0.5 },
    );
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, [viewedKey, planDay?.id, planCurrentDay]);

  // Announce when every present Day 1 sub-item has been viewed.
  useEffect(() => {
    if (!planDay || planCurrentDay !== 1) {
      announcedCompleteRef.current = false;
      return;
    }
    const presentIds = [
      "plan-passage",
      ...(planDay.reflection_md ? ["plan-reflection"] : []),
      ...(planDay.prayer_md ? ["plan-prayer"] : []),
    ];
    const fullyCompleted = presentIds.length > 0 && presentIds.every((id) => day1Viewed[id]);
    if (fullyCompleted && !announcedCompleteRef.current) {
      announcedCompleteRef.current = true;
      if (announceTimerRef.current) window.clearTimeout(announceTimerRef.current);
      setResumeAnnouncement("Day 1 is fully completed.");
      announceTimerRef.current = window.setTimeout(() => setResumeAnnouncement(""), 3000);
    }
    if (!fullyCompleted) {
      announcedCompleteRef.current = false;
    }
  }, [day1Viewed, planDay, planCurrentDay]);

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
        .select("default_version_id, active_plan_id, ai_enabled, welcome_progress")
        .eq("id", user.id)
        .maybeSingle();

    setAiEnabled((prof?.ai_enabled as boolean | undefined) ?? true);
    const wp = (prof?.welcome_progress ?? {}) as {
      step?: number;
      completed_at?: string | null;
    };
    setWelcomeCompleted(Boolean(wp.completed_at));
    setWelcomeStep(typeof wp.step === "number" ? wp.step : null);

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

  const markingRef = useRef(false);
  async function markToday() {
    // Synchronous re-entrancy guard: completedToday only updates after the
    // async load() below, so a fast double-click would otherwise grant XP twice.
    if (completedToday || markingRef.current) return;
    markingRef.current = true;
    try {
      const { error: actErr } = await supabase
        .from("daily_activity")
        .upsert({ user_id: user.id, activity_date: todayLocalISO(), source: "home" });
      if (actErr) {
        toast.error("Couldn't record today", { description: actErr.message });
        return;
      }

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
    } finally {
      markingRef.current = false;
    }
  }

  const greeting = greetingForNow();

  return (
    <AppShell>
      <div className="space-y-stack-lg">
        {/* First-run nudge — show until the user has picked a plan.
            If they paused midway, deep-link back to the exact step. */}
        {!activePlanId && !welcomeCompleted && (() => {
          const inProgress = welcomeStep !== null && welcomeStep > 0;
          const stepLabels = ["tradition", "AI preference", "first reading plan"];
          const nextLabel = stepLabels[Math.min(welcomeStep ?? 0, 2)];
          return (
            <Link
              to="/welcome"
              search={inProgress ? { step: welcomeStep ?? 0 } : undefined}
              className="block"
            >
              <Card tone="accent" interactive className="flex items-center gap-4 gold-ribbon">
                <IconBadge name={inProgress ? "play_circle" : "waving_hand"} filled tone="wood" />
                <div className="min-w-0 flex-1">
                  <p className="font-serif text-lg text-primary">
                    {inProgress ? "Continue onboarding" : "Get set up in 60 seconds"}
                  </p>
                  <p className="truncate text-sm text-on-surface-variant">
                    {inProgress
                      ? `Pick up at step ${(welcomeStep ?? 0) + 1} of 3 — ${nextLabel}.`
                      : "Pick your tradition, confirm AI, and start your first reading plan."}
                  </p>
                </div>
                <Chip tone="ink" className="shrink-0">
                  {inProgress ? "Resume" : "Start"}
                </Chip>
              </Card>
            </Link>
          );
        })()}

        {/* Post-onboarding CTA — first-time users see a clear "Start my plan"
            entry point until they complete day 1. Jumps straight into today's
            plan details below and unlocks the "plan started" achievement. */}
        {welcomeCompleted && activePlanId && planCurrentDay === 1 && !completedToday && planDay && (
          (() => {
            const order: Array<{ id: string; present: boolean; label: string }> = [
              { id: "plan-passage", present: true, label: "Passage" },
              { id: "plan-reflection", present: Boolean(planDay.reflection_md), label: "Reflection" },
              { id: "plan-prayer", present: Boolean(planDay.prayer_md), label: "Prayer" },
            ];
            const presentItems = order.filter((o) => o.present);
            const day1FullyCompleted = presentItems.length > 0 && presentItems.every((o) => day1Viewed[o.id]);

            const scrollToItem = (targetId: string, label: string, mode: "resume" | "review") => {
              const el = document.getElementById(targetId);
              if (!el) return;
              const target = el as HTMLElement;
              if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
              setResumeAnnouncement(
                mode === "review" ? `Reviewing ${label}.` : `Resuming Day 1 at ${label}.`
              );
              target.scrollIntoView({ behavior: "smooth", block: "start" });

              let finished = false;
              const finish = () => {
                if (finished) return;
                finished = true;
                window.clearTimeout(fallbackTimer);
                target.focus({ preventScroll: true });
                setResumeHighlightId(targetId);
                window.setTimeout(() => setResumeHighlightId(null), 2400);
                window.setTimeout(() => setResumeAnnouncement(""), 3000);
              };
              const fallbackTimer = window.setTimeout(finish, 800);
              window.addEventListener("scrollend", finish, { once: true });
            };

            if (day1FullyCompleted) {
              return (
                <Card tone="accent" className="space-y-3 gold-ribbon">
                  <div className="flex items-center gap-3 px-1">
                    <IconBadge name="replay" filled tone="wood" />
                    <div>
                      <p className="font-serif text-lg text-primary">Day 1 complete</p>
                      <p className="text-sm text-on-surface-variant">
                        Revisit any part of today&apos;s journey.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {presentItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => scrollToItem(item.id, item.label, "review")}
                        className="flex items-center justify-between gap-3 rounded-xl border border-outline-variant bg-surface-container-low p-3 text-left transition-colors hover:border-primary hover:bg-surface-container"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-crisis-blue text-primary">
                            <Icon
                              name={
                                item.id === "plan-passage"
                                  ? "menu_book"
                                  : item.id === "plan-reflection"
                                    ? "psychology"
                                    : "front_hand"
                              }
                            />
                          </span>
                          <span className="font-serif text-base text-primary">
                            Review {item.label}
                          </span>
                        </div>
                        <Chip tone="ink" className="shrink-0">
                          Review
                        </Chip>
                      </button>
                    ))}
                  </div>
                </Card>
              );
            }

            return (
              <button
                type="button"
                onClick={async () => {
                  // Fire-and-forget: unlock the achievement on the first tap only.
                  if (!day1Started) {
                    void supabase.rpc("unlock_achievement" as any, { _code: "plan_started" });
                    if (startedKey) {
                      try { localStorage.setItem(startedKey, "1"); } catch { /* ignore */ }
                    }
                    setDay1Started(true);
                  }
                  // Scroll to the first sub-item the user hasn't viewed yet;
                  // fall back to the journey section itself.
                  const firstIncomplete = presentItems.find((o) => !day1Viewed[o.id]);
                  scrollToItem(
                    firstIncomplete?.id ?? "todays-journey",
                    firstIncomplete?.label ?? "Today's Journey",
                    "resume"
                  );
                }}
                className="block w-full text-left"
              >
                <Card tone="accent" interactive className="flex items-center gap-4 gold-ribbon">
                  <IconBadge name={day1Started ? "play_circle" : "play_arrow"} filled tone="wood" />
                  <div className="min-w-0 flex-1">
                    <p className="font-serif text-lg text-primary">
                      {day1Started ? "Resume Day 1" : "Start my plan"}
                    </p>
                    <p className="truncate text-sm text-on-surface-variant">
                      {planTitle
                        ? `${planTitle} — Day 1`
                        : "Begin day 1 of your reading plan."}
                    </p>
                  </div>
                  <Chip tone="ink" className="shrink-0">
                    {day1Started ? "Resume" : "Begin"}
                  </Chip>
                </Card>
              </button>
            );
          })()
        )}

        {/* Screen-reader-only live region announcing Resume Day 1 navigation. */}
        <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {resumeAnnouncement}
        </div>


        {/* Seasonal conversion campaign (Lent / Advent / New Year) */}
        {aiEnabled && season && (

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
        <section className="space-y-1">
          <p className="label-caps text-primary">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            }).toUpperCase()}
          </p>
          <h2 className="font-serif text-2xl text-primary">
            {greeting}, Believer
          </h2>
        </section>

        {/* Continue reading */}
        {resume && (
          <Link to="/bible" className="block">
            <Card interactive className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <IconBadge name="menu_book" tone="info" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-wood-warm">
                    Continue reading
                  </p>
                  <p className="font-serif text-lg text-primary">
                    {resume.book} {resume.chapter}
                  </p>
                </div>
              </div>
              <Icon name="arrow_forward" className="text-outline" />
            </Card>
          </Link>
        )}

        {/* How are you feeling? — emotion entry point */}
        <Link
          to="/feelings"
          className="flex items-center gap-3 rounded-xl border border-divider-soft bg-card p-4 transition-colors hover:border-primary"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary-container text-on-secondary-container">
            <Icon name="mood" filled />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-primary">How are you feeling?</p>
            <p className="text-xs text-on-surface-variant">
              Find Scripture for this moment — anxious, grateful, grieving…
            </p>
          </div>
          <Icon name="arrow_forward" className="text-on-surface-variant" />
        </Link>

        {/* Community challenges */}
        <Link
          to="/challenges"
          className="flex items-center gap-3 rounded-xl border border-divider-soft bg-card p-4 transition-colors hover:border-primary"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary">
            <Icon name="local_fire_department" filled />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-primary">Join a challenge</p>
            <p className="text-xs text-on-surface-variant">
              Short guided journeys — and thousands praying alongside you.
            </p>
          </div>
          <Icon name="arrow_forward" className="text-on-surface-variant" />
        </Link>

        {/* Streak-at-risk nudge */}
        {!completedToday && streak.current >= 2 && (
          <button
            onClick={markToday}
            className="flex w-full items-center gap-3 rounded-xl border border-primary/40 bg-secondary-container/40 p-4 text-left transition-colors hover:border-primary"
          >
            <Icon name="local_fire_department" filled className="text-2xl text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-primary">
                Keep your {streak.current}-day streak alive
              </p>
              <p className="text-xs text-on-surface-variant">
                Take five minutes for today's reading before the day ends.
              </p>
            </div>
            <Icon name="arrow_forward" className="text-primary" />
          </button>
        )}

        {/* Hero verse — dramatic gradient overlay card matching reference */}
        <section className="relative overflow-hidden rounded-xl aspect-[16/10] md:aspect-[21/9] shadow-2xl group border border-outline-variant gold-ribbon">
          <div className="absolute inset-0 bg-gradient-to-br from-surface-container-high via-surface-container to-background" />
          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/40 to-transparent" />
          <Constellation count={22} spotlight={false} />
          {verse && (

            <button
              onClick={() => setShareVerse(verse)}
              aria-label="Share today's verse"
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-card/70 text-primary backdrop-blur transition-colors hover:bg-card"
            >
              <Icon name="ios_share" />
            </button>
          )}
          <div className="relative h-full flex flex-col justify-end p-6 md:p-8 text-center md:text-left">
            <span className="label-caps text-primary mb-2">VERSE OF THE DAY</span>
            {verse ? (
              <>
                <blockquote className="font-serif text-xl italic leading-relaxed text-on-surface mb-3">
                  &ldquo;{verse.text}&rdquo;
                </blockquote>
                <cite className="label-caps text-on-surface-variant opacity-80 not-italic">
                  — {verse.book} {verse.chapter}:{verse.verse}
                </cite>
              </>
            ) : (
              <p className="font-serif text-lg italic text-on-surface-variant">
                Loading today&apos;s verse…
              </p>
            )}
          </div>
        </section>

        {/* Bento row: Daily Reading progress + Continue reading */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-stack-sm">
          {/* Progress Tracker */}
          <div className="bg-surface-container rounded-xl p-5 border border-outline-variant flex flex-col justify-between">
            <div>
              <h3 className="label-caps text-on-surface-variant mb-3">DAILY READING</h3>
              <div className="flex items-end justify-between mb-2">
                <span className="font-serif text-2xl text-primary">
                  {completedToday ? "100%" : `${Math.min(100, Math.round((streak.current / 7) * 100))}%`}
                </span>
                <span className="text-sm text-on-surface-variant">
                  {streak.current} day{streak.current === 1 ? "" : "s"} streak
                </span>
              </div>
              <div className="w-full bg-surface-variant h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-primary h-full rounded-full shadow-[0_0_8px_rgba(230,195,100,0.5)]"
                  style={{ width: `${completedToday ? 100 : Math.min(100, Math.round((streak.current / 7) * 100))}%` }}
                />
              </div>
            </div>
            <button
              onClick={markToday}
              disabled={completedToday}
              className="mt-4 w-full py-2.5 bg-primary text-on-primary label-caps rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {completedToday ? "TODAY IS COMPLETE" : "BEGIN TODAY'S DEVOTION"}
            </button>
          </div>

          {/* Continue reading / Quick action */}
          {resume ? (
            <Link to="/bible" className="block">
              <div className="bg-surface-container rounded-xl p-5 border border-outline-variant h-full flex flex-col justify-between hover:bg-surface-container-high transition-colors">
                <div>
                  <h3 className="label-caps text-on-surface-variant mb-3">CONTINUE READING</h3>
                  <p className="font-serif text-xl text-primary">{resume.book} {resume.chapter}</p>
                  <p className="text-sm text-on-surface-variant mt-1">Pick up where you left off</p>
                </div>
                <div className="mt-4 flex items-center gap-1 text-primary text-sm font-semibold">
                  Resume <Icon name="arrow_forward" className="text-base" />
                </div>
              </div>
            </Link>
          ) : (
            <Link to="/prayers" className="block">
              <div className="bg-surface-container rounded-xl p-5 border border-outline-variant h-full flex flex-col justify-between hover:bg-surface-container-high transition-colors">
                <div>
                  <h3 className="label-caps text-on-surface-variant mb-3">MY PRAYERS</h3>
                  <p className="font-serif text-xl text-primary">Prayer Requests</p>
                  <p className="text-sm text-on-surface-variant mt-1">Keep track of what&apos;s on your heart</p>
                </div>
                <div className="mt-4 flex items-center gap-1 text-primary text-sm font-semibold">
                  Open <Icon name="arrow_forward" className="text-base" />
                </div>
              </div>
            </Link>
          )}
        </div>

        {/* Gilded Divider */}
        <div className="gold-rule w-full" />

        {/* Today's AI reflection (grounded on the verse of the day) */}
        {aiEnabled && (devoLoading ? (
          <Skeleton className="h-32" />
        ) : devo ? (
          <section>
            <h3 className="font-serif text-2xl text-primary mb-stack-sm">Featured Reflections</h3>
            <Link to="/study" className="group block">
              <div className="bg-surface-container-low hover:bg-surface-container transition-all duration-300 rounded-xl p-5 border border-outline-variant flex gap-5 cursor-pointer">
                <div className="w-14 h-14 rounded-lg bg-crisis-blue flex items-center justify-center shrink-0">
                  <Icon name="auto_awesome" className="text-primary text-2xl" />
                </div>
                <div className="flex flex-col justify-center">
                  <span className="label-caps text-[10px] text-primary mb-1">AI PASTORAL GUIDANCE</span>
                  <h4 className="font-serif text-lg text-on-surface group-hover:text-primary transition-colors">
                    {devo.verse_ref}
                  </h4>
                  <p className="text-on-surface-variant text-sm line-clamp-2 mt-1">
                    {devo.reflection}
                  </p>
                </div>
              </div>
            </Link>
          </section>
        ) : null)}

        {/* Quick links — Featured Reflections style */}
        <section>
          <div className="space-y-3">
            {[
              { to: "/prayers" as const, icon: "front_hand", label: "My Prayers", desc: "Track what's on your heart" },
              { to: "/memorize" as const, icon: "neurology", label: "Memorize", desc: "Hide God's word in your heart" },
              { to: "/saved" as const, icon: "bookmark", label: "Saved", desc: "Verses you've bookmarked" },
              { to: "/reminders" as const, icon: "alarm", label: "Reminders", desc: "Daily nudges to show up" },
            ].map((l) => (
              <Link key={l.to} to={l.to} className="group block">
                <div className="bg-surface-container-low hover:bg-surface-container transition-all duration-300 rounded-xl p-4 border border-outline-variant flex items-center gap-4 cursor-pointer">
                  <div className="w-12 h-12 rounded-lg bg-crisis-blue flex items-center justify-center shrink-0">
                    <Icon name={l.icon} className="text-primary text-xl" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-serif text-lg text-on-surface group-hover:text-primary transition-colors">
                      {l.label}
                    </h4>
                    <p className="text-on-surface-variant text-sm">{l.desc}</p>
                  </div>
                  <Icon name="arrow_forward" className="text-outline" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Gilded Divider */}
        <div className="gold-rule w-full" />

        {/* Explore every feature — full app surface */}
        <section className="space-y-stack-md">
          <SectionHeader>Explore Every Feature</SectionHeader>
          <div className="grid grid-cols-2 gap-stack-sm sm:grid-cols-3">
            {[
              { to: "/bible" as const, icon: "menu_book", label: "Bible" },
              ...(aiEnabled ? [{ to: "/study" as const, icon: "auto_awesome", label: "AI Study" }] : []),
              ...(aiEnabled ? [{ to: "/companion" as const, icon: "favorite", label: "Companion" }] : []),
              { to: "/plans" as const, icon: "calendar_month", label: "Plans" },
              { to: "/memorize" as const, icon: "neurology", label: "Memorize" },
              { to: "/listen" as const, icon: "headphones", label: "Listen" },
              { to: "/prayers" as const, icon: "front_hand", label: "Prayers" },
              { to: "/wall" as const, icon: "public", label: "Prayer Wall" },
              { to: "/groups" as const, icon: "groups", label: "Groups" },
              { to: "/saved" as const, icon: "bookmark", label: "Journal" },
              { to: "/search" as const, icon: "search", label: "Search" },
              { to: "/reminders" as const, icon: "alarm", label: "Reminders" },
              { to: "/profile" as const, icon: "person", label: "Profile" },
              { to: "/settings" as const, icon: "settings", label: "Settings" },
            ].map((f) => (
              <Link key={f.to} to={f.to} className="group block">
                <div className="h-full bg-surface-container-low hover:bg-surface-container transition-all rounded-xl p-4 border border-outline-variant flex flex-col items-center justify-center gap-2 text-center cursor-pointer">
                  <div className="w-11 h-11 rounded-lg bg-crisis-blue flex items-center justify-center">
                    <Icon name={f.icon} className="text-primary text-xl" />
                  </div>
                  <span className="font-serif text-sm text-on-surface group-hover:text-primary transition-colors">
                    {f.label}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Gilded Divider */}
        <div className="gold-rule w-full" />

        {/* Today's journey (reading plan) */}
        <section id="todays-journey" className="space-y-stack-md scroll-mt-24 outline-none">
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
              <div id="plan-passage" className={`scroll-mt-24 outline-none rounded-lg transition-shadow ${resumeHighlightId === "plan-passage" ? "resume-highlight" : ""}`}>
                <JourneyCard
                  icon="menu_book"
                  eyebrow="The Passage"
                  title={planDay.passage_ref}
                  body={planTitle ?? "Today's reading"}
                />
              </div>
              {planDay.reflection_md && (
                <div id="plan-reflection" className={`scroll-mt-24 outline-none rounded-lg transition-shadow ${resumeHighlightId === "plan-reflection" ? "resume-highlight" : ""}`}>
                  <JourneyCard
                    icon="psychology"
                    eyebrow="Reflection"
                    title="Sit & reflect"
                    body={planDay.reflection_md}
                  />
                </div>
              )}
              {planDay.prayer_md && (
                <div id="plan-prayer" className={`scroll-mt-24 outline-none rounded-lg transition-shadow md:col-span-2 ${resumeHighlightId === "plan-prayer" ? "resume-highlight" : ""}`}>
                  <Card
                    tone="info"
                    className="flex flex-col items-start gap-4"
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
                </div>
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

        {/* Gilded Divider */}
        <div className="gold-rule w-full" />

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
