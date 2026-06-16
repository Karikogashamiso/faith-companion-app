import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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

function todayLocalISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function computeStreak(dates: string[]): { current: number; longest: number } {
  if (!dates.length) return { current: 0, longest: 0 };
  const set = new Set(dates);
  let longest = 0;
  for (const d of dates) {
    let len = 1;
    const dt = new Date(d);
    while (true) {
      dt.setDate(dt.getDate() + 1);
      const k = dt.toISOString().slice(0, 10);
      if (set.has(k)) len++;
      else break;
    }
    if (len > longest) longest = len;
  }
  // current streak: count back from today (or yesterday — grace)
  let cur = 0;
  const cursor = new Date(todayLocalISO());
  if (!set.has(cursor.toISOString().slice(0, 10))) {
    cursor.setDate(cursor.getDate() - 1); // grace: yesterday counts as "still on streak"
  }
  while (set.has(cursor.toISOString().slice(0, 10))) {
    cur++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { current: cur, longest };
}

function Home() {
  const [verse, setVerse] = useState<Verse | null>(null);
  const [planDay, setPlanDay] = useState<PlanDay | null>(null);
  const [planTitle, setPlanTitle] = useState<string | null>(null);
  const [streak, setStreak] = useState({ current: 0, longest: 0 });
  const [completedToday, setCompletedToday] = useState(false);
  const [me, setMe] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const { data: u } = await supabase.auth.getUser();
    setMe(u.user?.id ?? null);
    if (!u.user) return;

    const { data: prof } = await supabase
      .from("profiles")
      .select("default_version_id")
      .eq("id", u.user.id)
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
      .eq("user_id", u.user.id)
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
      .eq("user_id", u.user.id)
      .order("activity_date", { ascending: false })
      .limit(120);
    const dates = (act ?? []).map((a: any) => a.activity_date as string);
    setStreak(computeStreak(dates));
    setCompletedToday(dates.includes(todayLocalISO()));
  }

  async function markToday() {
    if (!me) return;
    await supabase
      .from("daily_activity")
      .upsert({ user_id: me, activity_date: todayLocalISO(), source: "home" });
    void load();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Today</h1>
        <nav className="flex gap-4 text-sm text-muted-foreground">
          <Link to="/bible" className="hover:text-foreground">
            Bible
          </Link>
          <Link to="/search" className="hover:text-foreground">
            Search
          </Link>
          <Link to="/groups" className="hover:text-foreground">
            Groups
          </Link>
          <Link to="/settings" className="hover:text-foreground">
            Settings
          </Link>
        </nav>
      </header>

      <section className="rounded-md border bg-card p-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Verse of the day
        </p>
        {verse ? (
          <>
            <p className="mt-3 text-lg leading-relaxed">{verse.text}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {verse.book} {verse.chapter}:{verse.verse}
            </p>
          </>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Loading verse…</p>
        )}
      </section>

      <section className="rounded-md border p-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {planTitle ? `Reading plan · ${planTitle}` : "Reading plan"}
        </p>
        {planDay ? (
          <>
            <h2 className="mt-2 font-medium">
              Day {planDay.day_number} — {planDay.passage_ref}
            </h2>
            {planDay.reflection_md && (
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                {planDay.reflection_md}
              </p>
            )}
            {planDay.prayer_md && (
              <p className="mt-3 whitespace-pre-wrap text-sm italic">
                {planDay.prayer_md}
              </p>
            )}
          </>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            No active plan yet. Pick one anytime — there's no rush.
          </p>
        )}
      </section>

      <section className="flex items-center justify-between rounded-md border p-4">
        <div>
          <p className="text-2xl font-semibold">
            {streak.current} {streak.current === 1 ? "day" : "days"}
          </p>
          <p className="text-xs text-muted-foreground">
            {streak.current === 0
              ? "Today is a good day to begin."
              : completedToday
                ? "You showed up today — well done."
                : "Yesterday counted — sit with the verse a moment."}
          </p>
        </div>
        <button
          onClick={markToday}
          disabled={completedToday}
          className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {completedToday ? "✓ Done" : "Mark today"}
        </button>
      </section>
    </div>
  );
}
