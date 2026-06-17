import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, SectionHeading } from "@/components/app/app-shell";
import { Icon } from "@/components/app/icon";
import { computeStreak, todayLocalISO } from "@/lib/streak";

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

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  async function load() {
    const { data: prof } = await supabase
      .from("profiles")
      .select("default_version_id")
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

    // Pick the user's most recent in-progress plan (if any)
    const { data: progress } = await supabase
      .from("user_plan_progress")
      .select("plan_id, day_completed")
      .eq("user_id", user.id)
      .order("completed_at", { ascending: false })
      .limit(1);

    if (progress && progress[0]) {
      const { plan_id, day_completed } = progress[0] as {
        plan_id: string;
        day_completed: number;
      };
      const [{ data: pd }, { data: rp }] = await Promise.all([
        supabase
          .from("plan_days")
          .select("id, day_number, passage_ref, reflection_md, prayer_md")
          .eq("plan_id", plan_id)
          .eq("day_number", day_completed + 1)
          .maybeSingle(),
        supabase.from("reading_plans").select("title").eq("id", plan_id).maybeSingle(),
      ]);
      setPlanDay(pd as PlanDay | null);
      setPlanTitle((rp as { title: string } | null)?.title ?? null);
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
  }

  async function markToday() {
    await supabase
      .from("daily_activity")
      .upsert({ user_id: user.id, activity_date: todayLocalISO(), source: "home" });
    void load();
  }

  const greeting = greetingForNow();

  return (
    <AppShell>
      <div className="space-y-stack-lg">
        {/* Welcome & streak */}
        <section className="flex items-end justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold uppercase tracking-widest text-wood-warm">
              {greeting}
            </p>
            <h2 className="font-serif text-3xl text-primary md:text-4xl">
              Peace be with you.
            </h2>
          </div>
          <div className="mb-1 flex shrink-0 items-center gap-2 rounded-full bg-secondary-container px-4 py-2 text-on-secondary-container">
            <Icon name="local_fire_department" filled className="text-xl" />
            <span className="text-sm font-semibold">
              {streak.current} Day{streak.current === 1 ? "" : "s"}
            </span>
          </div>
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

        {/* Today's journey (reading plan) */}
        <section className="space-y-stack-md">
          <SectionHeading
            trailing={
              planDay ? (
                <span className="text-sm font-semibold text-wood-warm">
                  Day {planDay.day_number}
                </span>
              ) : null
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
          ) : (
            <div className="rounded-xl border border-divider-soft bg-white p-6">
              <p className="text-on-surface-variant">
                No active plan yet. Pick one anytime — there's no rush.
              </p>
              <Link
                to="/bible"
                className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-wood-warm hover:text-primary"
              >
                Open the Bible
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
