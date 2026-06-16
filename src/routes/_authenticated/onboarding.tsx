import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { askStudy } from "@/lib/ai-study.functions";
import { track, assignVariant } from "@/lib/analytics";
import type { Database } from "@/integrations/supabase/types";

type Tradition = Database["public"]["Enums"]["tradition"];
type Variant = "A" | "B";

// ---------------------------------------------------------------------------
// Static option sets
// ---------------------------------------------------------------------------
const GOALS = [
  { value: "grow_faith", label: "Grow my faith", emoji: "🌱" },
  { value: "understand_bible", label: "Understand the Bible better", emoji: "📖" },
  { value: "peace_anxiety", label: "Find peace / manage anxiety", emoji: "🕊️" },
  { value: "habit", label: "Build a consistent habit", emoji: "🔁" },
  { value: "reconnect", label: "Reconnect with God", emoji: "✨" },
] as const;

const TRADITIONS: { value: Tradition; label: string }[] = [
  { value: "catholic", label: "Catholic" },
  { value: "orthodox", label: "Orthodox" },
  { value: "reformed", label: "Reformed" },
  { value: "baptist", label: "Baptist" },
  { value: "methodist", label: "Methodist" },
  { value: "pentecostal", label: "Pentecostal" },
  { value: "non_denominational", label: "Non-denominational" },
  { value: "unspecified", label: "Just exploring" },
];

const STAGES = [
  { value: "new", label: "New to faith" },
  { value: "returning", label: "Returning after a while" },
  { value: "deeper", label: "Steady — want to go deeper" },
  { value: "leading", label: "Leading others" },
];

const STRUGGLES = [
  { value: "consistency", label: "Staying consistent" },
  { value: "understanding", label: "Understanding what I read" },
  { value: "doubt", label: "Doubt & hard questions" },
  { value: "anxiety", label: "Anxiety / stress" },
  { value: "loneliness", label: "Loneliness" },
  { value: "time", label: "Finding time" },
];

const MINUTES = [3, 5, 10, 15];

// Maps a struggle into the AI demo question we pre-fill.
const DEMO_QUESTIONS: Record<string, string> = {
  anxiety: "What does the Bible say about worry?",
  doubt: "How can I trust God when I have hard questions?",
  loneliness: "Where is God when I feel alone?",
  consistency: "What does the Bible say about perseverance?",
  understanding: "How should I read the Bible?",
  time: "What does Jesus say about rest?",
};

// Maps goal → human phrase used in the paywall / reveal copy.
const GOAL_PHRASE: Record<string, string> = {
  grow_faith: "grow your faith",
  understand_bible: "understand the Bible better",
  peace_anxiety: "find peace day by day",
  habit: "build a daily habit that lasts",
  reconnect: "reconnect with God",
};

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------
export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Welcome · Discipleship Companion" }] }),
  component: Onboarding,
});

const TOTAL_STEPS = 10;

function Onboarding() {
  const navigate = useNavigate();
  const { user } = Route.useRouteContext();
  const askStudyFn = useServerFn(askStudy);

  const [step, setStep] = useState(1);
  const [name, setName] = useState<string>("");
  const [goal, setGoal] = useState<string | null>(null);
  const [tradition, setTradition] = useState<Tradition | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const [struggles, setStruggles] = useState<string[]>([]);
  const [dailyMinutes, setDailyMinutes] = useState(5);
  const [reminderTime, setReminderTime] = useState("07:30");
  const [aiEnabled, setAiEnabled] = useState(true);
  const [joinCode, setJoinCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [variantScreen1, setVariantScreen1] = useState<Variant>("A");
  const [variantScreen10, setVariantScreen10] = useState<Variant>("A");
  const screen1ViewedRef = useRef(false);
  const paywallViewedRef = useRef(false);

  // Load any prior partial answers + the user's display name.
  useEffect(() => {
    void (async () => {
      const { data: prof } = await supabase
        .from("profiles")
        .select("display_name, tradition, ai_enabled, daily_minutes, reminder_time")
        .eq("id", user.id)
        .maybeSingle();
      if (prof?.display_name) setName(prof.display_name);
      if (prof?.tradition) setTradition(prof.tradition);
      if (prof?.ai_enabled === false) setAiEnabled(false);
      if (prof?.daily_minutes) setDailyMinutes(prof.daily_minutes);
      if (prof?.reminder_time)
        setReminderTime(String(prof.reminder_time).slice(0, 5));

      const { data: ans } = await supabase
        .from("onboarding_answers")
        .select(
          "goal, journey_stage, struggles, daily_minutes, reminder_time, join_code, variant_screen1, variant_screen10",
        )
        .eq("user_id", user.id)
        .maybeSingle();
      if (ans?.goal) setGoal(ans.goal);
      if (ans?.journey_stage) setStage(ans.journey_stage);
      if (ans?.struggles?.length) setStruggles(ans.struggles);
      if (ans?.daily_minutes) setDailyMinutes(ans.daily_minutes);
      if (ans?.reminder_time)
        setReminderTime(String(ans.reminder_time).slice(0, 5));
      if (ans?.join_code) setJoinCode(ans.join_code);

      // Assign A/B variants once and persist them so the same user always
      // sees the same variant across sessions.
      const v1 = (ans?.variant_screen1 as Variant | null) ?? assignVariant();
      const v10 = (ans?.variant_screen10 as Variant | null) ?? assignVariant();
      setVariantScreen1(v1);
      setVariantScreen10(v10);
      if (!ans?.variant_screen1 || !ans?.variant_screen10) {
        await supabase.from("onboarding_answers").upsert(
          {
            user_id: user.id,
            variant_screen1: v1,
            variant_screen10: v10,
          },
          { onConflict: "user_id" },
        );
        void track(
          "onboarding_started",
          { variant_screen1: v1, variant_screen10: v10 },
        );
      }
    })();
  }, [user.id]);

  // Fire screen-view events once per screen so trial-start (Screen 1) and
  // trial-to-paid (Screen 10) funnels can be computed per variant.
  useEffect(() => {
    if (step === 1 && !screen1ViewedRef.current) {
      screen1ViewedRef.current = true;
      void track("screen1_viewed", { variant_screen1: variantScreen1 });
    }
    if (step === 10 && !paywallViewedRef.current) {
      paywallViewedRef.current = true;
      void track("paywall_viewed", { variant_screen10: variantScreen10 }, { goal });
    }
  }, [step, variantScreen1, variantScreen10, goal]);

  // Persist on every step transition (best-effort, fire-and-forget).
  async function persist() {
    const profilePatch: Database["public"]["Tables"]["profiles"]["Update"] = {
      ai_enabled: aiEnabled,
      daily_minutes: dailyMinutes,
      reminder_time: reminderTime + ":00",
    };
    if (tradition) profilePatch.tradition = tradition;
    await supabase.from("profiles").update(profilePatch).eq("id", user.id);

    await supabase.from("onboarding_answers").upsert(
      {
        user_id: user.id,
        goal,
        journey_stage: stage,
        struggles,
        daily_minutes: dailyMinutes,
        reminder_time: reminderTime + ":00",
        join_code: joinCode || null,
        variant_screen1: variantScreen1,
        variant_screen10: variantScreen10,
      },
      { onConflict: "user_id" },
    );
  }

  async function next() {
    await persist();
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  }
  function back() {
    setStep((s) => Math.max(1, s - 1));
  }
  async function finish(toCompanion: boolean) {
    setSaving(true);
    await persist();
    await supabase
      .from("onboarding_answers")
      .update({ completed_at: new Date().toISOString() })
      .eq("user_id", user.id);
    void track(
      toCompanion ? "paywall_start_companion" : "paywall_continue_free",
      { variant_screen1: variantScreen1, variant_screen10: variantScreen10 },
      { goal, from_step: step },
    );
    setSaving(false);
    navigate({ to: toCompanion ? "/companion" : "/home" });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Progress + back/skip */}
      <header className="space-y-3 px-6 pt-6">
        <div className="flex h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          {step > 1 && step < TOTAL_STEPS ? (
            <button onClick={back} className="hover:text-foreground">
              ← Back
            </button>
          ) : (
            <span />
          )}
          <span>Step {step} of {TOTAL_STEPS}</span>
          {step < TOTAL_STEPS ? (
            <button
              onClick={() => finish(false)}
              className="hover:text-foreground"
            >
              Skip
            </button>
          ) : (
            <span />
          )}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 pb-10 pt-8">
        {step === 1 && (
          <Screen1
            variant={variantScreen1}
            name={name}
            onContinue={() => {
              void track("screen1_cta_clicked", { variant_screen1: variantScreen1 });
              void next();
            }}
          />
        )}

        {step === 2 && (
          <Pane
            title="What brings you here today?"
            subtitle="We'll use your answer to shape what shows up first."
            primary={{
              label: "Continue",
              onClick: next,
              disabled: !goal,
            }}
          >
            <div className="space-y-2">
              {GOALS.map((g) => (
                <Card
                  key={g.value}
                  selected={goal === g.value}
                  onClick={() => setGoal(g.value)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{g.emoji}</span>
                    <span className="text-sm font-medium">{g.label}</span>
                  </div>
                </Card>
              ))}
            </div>
          </Pane>
        )}

        {step === 3 && (
          <Pane
            title="Which tradition do you call home?"
            subtitle="This shapes how the AI frames things. There's no wrong answer."
            primary={{
              label: "Continue",
              onClick: next,
              disabled: !tradition,
            }}
          >
            <div className="grid grid-cols-2 gap-2">
              {TRADITIONS.map((t) => (
                <Card
                  key={t.value}
                  selected={tradition === t.value}
                  onClick={() => setTradition(t.value)}
                >
                  <span className="text-sm">{t.label}</span>
                </Card>
              ))}
            </div>
          </Pane>
        )}

        {step === 4 && (
          <Pane
            title="How would you describe your walk right now?"
            subtitle="So we pick the right pace for you."
            primary={{
              label: "Continue",
              onClick: next,
              disabled: !stage,
            }}
          >
            <div className="space-y-2">
              {STAGES.map((s) => (
                <Card
                  key={s.value}
                  selected={stage === s.value}
                  onClick={() => setStage(s.value)}
                >
                  <span className="text-sm">{s.label}</span>
                </Card>
              ))}
            </div>
          </Pane>
        )}

        {step === 5 && (
          <Pane
            title="What's been hardest lately?"
            subtitle="Pick any that apply. We'll start your plan from here."
            primary={{ label: "Continue", onClick: next }}
          >
            <div className="flex flex-wrap gap-2">
              {STRUGGLES.map((s) => {
                const on = struggles.includes(s.value);
                return (
                  <button
                    key={s.value}
                    onClick={() =>
                      setStruggles((cur) =>
                        cur.includes(s.value)
                          ? cur.filter((x) => x !== s.value)
                          : [...cur, s.value],
                      )
                    }
                    className={`rounded-full border px-3 py-1.5 text-sm transition ${
                      on
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-input hover:bg-accent"
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </Pane>
        )}

        {step === 6 && (
          <Pane
            title="How much time a day?"
            subtitle="A small commitment you can actually keep beats a big one you won't."
            primary={{ label: "Continue", onClick: next }}
          >
            <div className="space-y-6">
              <div className="grid grid-cols-4 gap-2">
                {MINUTES.map((m) => (
                  <button
                    key={m}
                    onClick={() => setDailyMinutes(m)}
                    className={`rounded-lg border py-3 text-sm font-medium transition ${
                      dailyMinutes === m
                        ? "border-primary bg-primary/10"
                        : "border-input hover:bg-accent"
                    }`}
                  >
                    {m} min
                  </button>
                ))}
              </div>
              <div>
                <label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">
                  Daily reminder
                </label>
                <input
                  type="time"
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
              </div>
            </div>
          </Pane>
        )}

        {step === 7 && (
          <AhaScreen
            struggles={struggles}
            tradition={tradition ?? "unspecified"}
            aiEnabled={aiEnabled}
            onDeclineAi={() => setAiEnabled(false)}
            askStudyFn={askStudyFn}
            onContinue={next}
          />
        )}

        {step === 8 && (
          <Pane
            title="The promise — in writing."
            subtitle="Why people stay."
            primary={{ label: "Continue", onClick: next }}
          >
            <div className="space-y-3">
              <Quote text="The first Bible app I actually trust. It never makes things up." author="Beta tester" />
              <Quote text="The daily plan is short enough that I actually do it." author="Beta tester" />
              <div className="rounded-md border bg-muted/40 p-4 text-sm">
                <p className="font-medium">Our trust guarantee</p>
                <p className="mt-1 text-muted-foreground">
                  Every AI answer quotes only verses we actually retrieve — with
                  the reference linked. If a verse isn't really there, it won't
                  appear.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Better with people: do it alongside your group or church.
              </p>
            </div>
          </Pane>
        )}

        {step === 9 && (
          <Pane
            title={`Your plan is ready${name ? `, ${name}` : ""}.`}
            subtitle="Here's what we're starting you with."
            primary={{ label: "Looks good", onClick: next }}
          >
            <div className="space-y-3">
              <SummaryRow
                label="Goal"
                value={
                  goal
                    ? GOALS.find((g) => g.value === goal)?.label ?? goal
                    : "Not set"
                }
              />
              <SummaryRow
                label="Tradition"
                value={
                  tradition
                    ? TRADITIONS.find((t) => t.value === tradition)?.label ?? tradition
                    : "Not set"
                }
              />
              <SummaryRow
                label="Daily time"
                value={`${dailyMinutes} min @ ${reminderTime}`}
              />
              <button
                onClick={async () => {
                  if (typeof window === "undefined" || !("Notification" in window))
                    return;
                  try {
                    await Notification.requestPermission();
                  } catch {
                    /* user denied */
                  }
                }}
                className="w-full rounded-md border border-input p-3 text-left text-sm hover:bg-accent"
              >
                <span className="font-medium">Turn on reminders</span>
                <span className="block text-xs text-muted-foreground">
                  We'll nudge you at {reminderTime}. No spammy follow-ups.
                </span>
              </button>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">
                  Group join code (optional)
                </label>
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="e.g. ABC123"
                  className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
              </div>
            </div>
          </Pane>
        )}

        {step === 10 && (
          <PaywallScreen
            variant={variantScreen10}
            name={name}
            goal={goal}
            saving={saving}
            onStartCompanion={() => finish(true)}
            onContinueFree={() => finish(false)}
          />
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SCREEN 7 — Aha moment
// ---------------------------------------------------------------------------
function AhaScreen({
  struggles,
  tradition,
  aiEnabled,
  onDeclineAi,
  askStudyFn,
  onContinue,
}: {
  struggles: string[];
  tradition: string;
  aiEnabled: boolean;
  onDeclineAi: () => void;
  askStudyFn: ReturnType<typeof useServerFn<typeof askStudy>>;
  onContinue: () => void;
}) {


  const demoQuestion = useMemo(() => {
    const key = struggles[0];
    return DEMO_QUESTIONS[key] ?? "What does the Bible say about hope?";
  }, [struggles]);

  type Result = Awaited<ReturnType<typeof askStudy>>;
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setErr(null);
    try {
      const r = await askStudyFn({ data: { question: demoQuestion } });
      setResult(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  // Tradition is intentionally unused in this client preview — server reads it from the profile.
  void tradition;

  return (
    <Pane
      title="Try it now."
      subtitle="A short preview tailored to what you shared. No account upgrade needed."
      primary={{ label: "Continue", onClick: onContinue }}
    >
      <div className="space-y-4">
        <div className="rounded-md border bg-muted/40 p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Sample question
          </p>
          <p className="mt-1 text-sm font-medium">{demoQuestion}</p>
        </div>

        {!aiEnabled ? (
          <div className="rounded-md border p-4 text-sm">
            <p className="font-medium">AI is off — that's fine.</p>
            <p className="mt-1 text-muted-foreground">
              We'll guide you with a curated devotional path instead. Scripture,
              reading plans, search, and prayer all work without the AI.
            </p>
          </div>
        ) : !result ? (
          <button
            onClick={run}
            disabled={loading}
            className="w-full rounded-md bg-primary py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
          >
            {loading ? "Searching Scripture…" : "Show me the answer"}
          </button>
        ) : result.disabled ? (
          <div className="rounded-md border p-4 text-sm">{result.message}</div>
        ) : (
          <div className="space-y-3 rounded-md border p-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {result.answer}
            </p>
            {result.candidates?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {result.candidates.slice(0, 4).map((c) => (
                  <span
                    key={`${c.book}-${c.chapter}-${c.verse}`}
                    className="rounded-full border bg-background px-2 py-0.5 text-xs"
                  >
                    {c.book} {c.chapter}:{c.verse}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {err && <p className="text-xs text-destructive">{err}</p>}

        <button
          onClick={onDeclineAi}
          className="block text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          I'd rather not use AI
        </button>
      </div>
    </Pane>
  );
}

// ---------------------------------------------------------------------------
// SCREEN 10 — Paywall (Calm-style, honest)
// ---------------------------------------------------------------------------
function PaywallScreen({
  goal,
  saving,
  onStartCompanion,
  onContinueFree,
}: {
  goal: string | null;
  saving: boolean;
  onStartCompanion: () => void;
  onContinueFree: () => void;
}) {
  const phrase = goal ? GOAL_PHRASE[goal] ?? "go deeper" : "go deeper";

  return (
    <div className="flex flex-1 flex-col">
      <div className="space-y-2 pb-6 pt-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          You're all set
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          To {phrase}, unlock your full plan.
        </h1>
        <p className="text-sm text-muted-foreground">
          Outcomes, not features. Pick what fits — or stay on the free plan.
        </p>
      </div>

      <div className="space-y-3">
        <div className="rounded-md border-2 border-primary p-4">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-medium">Annual · recommended</p>
            <p className="text-xs text-primary">14-day free trial</p>
          </div>
          <p className="mt-1 text-2xl font-semibold">$39.99 / year</p>
          <p className="text-xs text-muted-foreground">
            ≈ $3.33 / month · best value
          </p>
        </div>
        <div className="rounded-md border p-4">
          <p className="text-sm font-medium">Monthly</p>
          <p className="mt-1 text-2xl font-semibold">$4.99 / month</p>
        </div>
      </div>

      <button
        onClick={onStartCompanion}
        disabled={saving}
        className="mt-6 h-12 w-full rounded-md bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
      >
        {saving ? "One moment…" : "Start my plan"}
      </button>

      <p className="mt-2 text-center text-xs text-muted-foreground">
        Cancel anytime · The Bible & community are always free.
      </p>

      <button
        onClick={onContinueFree}
        disabled={saving}
        className="mt-6 text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        Continue with the free version
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small UI primitives
// ---------------------------------------------------------------------------
function Pane({
  title,
  subtitle,
  children,
  primary,
}: {
  title: string;
  subtitle: string;
  children?: React.ReactNode;
  primary: { label: string; onClick: () => void; disabled?: boolean };
}) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="space-y-2 pb-6 pt-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex-1">{children}</div>
      <button
        onClick={primary.onClick}
        disabled={primary.disabled}
        className="mt-6 h-11 w-full rounded-md bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
      >
        {primary.label}
      </button>
    </div>
  );
}

function Card({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-lg border p-3 text-left transition-colors ${
        selected
          ? "border-primary bg-primary/5"
          : "border-input hover:bg-accent"
      }`}
    >
      {children}
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border p-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function Quote({ text, author }: { text: string; author: string }) {
  return (
    <figure className="rounded-md border p-4">
      <blockquote className="text-sm">&ldquo;{text}&rdquo;</blockquote>
      <figcaption className="mt-1 text-xs text-muted-foreground">— {author}</figcaption>
    </figure>
  );
}
