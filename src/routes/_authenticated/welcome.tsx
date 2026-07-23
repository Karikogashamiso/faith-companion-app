import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { AppShell, SectionHeading } from "@/components/app/app-shell";
import { Icon } from "@/components/app/icon";
import { cn } from "@/lib/utils";

type Tradition = Database["public"]["Enums"]["tradition"];

/**
 * `/welcome` — a lightweight, skippable 3-step wizard that gets a new
 * believer into the app fast. Distinct from the long `/onboarding` flow;
 * this one is focused on the essentials the app actually needs to feel
 * personal on day one:
 *   1. Pick a tradition   → saved to profiles.tradition
 *   2. Confirm AI setting → saved to profiles.ai_enabled
 *   3. Start a reading plan → row in user_plan_progress (day 0 marker)
 */

export const Route = createFileRoute("/_authenticated/welcome")({
  head: () => ({ meta: [{ title: "Welcome · Faith Companion" }] }),
  validateSearch: (search: Record<string, unknown>) => {
    const raw = Number(search.step);
    const step = Number.isFinite(raw) ? Math.max(0, Math.min(2, Math.trunc(raw))) : undefined;
    return step === undefined ? {} : { step };
  },
  component: WelcomeWizard,
});

const TRADITIONS: { value: Tradition; label: string; blurb: string }[] = [
  { value: "catholic", label: "Catholic", blurb: "Rooted in the Church's tradition." },
  { value: "orthodox", label: "Orthodox", blurb: "Ancient liturgy and the fathers." },
  { value: "anglican", label: "Anglican / Episcopal", blurb: "Book of Common Prayer roots." },
  { value: "lutheran", label: "Lutheran", blurb: "Grace, faith, and Scripture alone." },
  { value: "reformed", label: "Reformed", blurb: "Covenant and the sovereignty of God." },
  { value: "baptist", label: "Baptist", blurb: "Believer's baptism, local church." },
  { value: "methodist", label: "Methodist", blurb: "Sanctifying grace, small groups." },
  { value: "pentecostal", label: "Pentecostal", blurb: "The Spirit's power today." },
  { value: "non_denominational", label: "Non-denominational", blurb: "Just following Jesus." },
  { value: "unspecified", label: "Just exploring", blurb: "You're welcome here." },
];

type Plan = { id: string; title: string; description: string | null; day_count: number };

type WelcomeProgress = {
  step?: number;
  tradition?: Tradition;
  ai_enabled?: boolean;
  plan_id?: string | null;
  completed_at?: string | null;
};

function WelcomeWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const [tradition, setTradition] = useState<Tradition>("unspecified");
  const [aiEnabled, setAiEnabled] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planId, setPlanId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Pull the user's current settings + saved wizard progress so they can
  // resume on any device, and load the starter plan catalog.
  useEffect(() => {
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      setUserId(auth.user.id);

      const { data: prof } = await supabase
        .from("profiles")
        .select("tradition, ai_enabled, welcome_progress")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (prof?.tradition) setTradition(prof.tradition);
      if (typeof prof?.ai_enabled === "boolean") setAiEnabled(prof.ai_enabled);
      const progress = ((prof as unknown as { welcome_progress?: WelcomeProgress } | null)
        ?.welcome_progress ?? {}) as WelcomeProgress;
      if (progress.tradition) setTradition(progress.tradition);
      if (typeof progress.ai_enabled === "boolean") setAiEnabled(progress.ai_enabled);
      if (progress.plan_id) setPlanId(progress.plan_id);
      if (typeof progress.step === "number") {
        setStep(Math.max(0, Math.min(2, progress.step)));
      }

      const { data: pl } = await supabase
        .from("reading_plans")
        .select("id, title, description, day_count")
        .eq("is_premium", false)
        .order("day_count", { ascending: true });
      if (pl) {
        setPlans(pl as Plan[]);
        if (!progress.plan_id) setPlanId((pl[0] as Plan | undefined)?.id ?? null);
      }
      setHydrated(true);
    })();
  }, []);

  // Persist progress whenever any answer or step changes so a return visit
  // — even from a different device — picks up right where they left off.
  useEffect(() => {
    if (!hydrated || !userId) return;
    const progress: WelcomeProgress = {
      step,
      tradition,
      ai_enabled: aiEnabled,
      plan_id: planId,
    };
    void supabase
      .from("profiles")
      .update({ welcome_progress: progress as never })
      .eq("id", userId);
  }, [hydrated, userId, step, tradition, aiEnabled, planId]);

  async function saveProfile() {
    if (!userId) return;
    await supabase
      .from("profiles")
      .update({ tradition, ai_enabled: aiEnabled })
      .eq("id", userId);
  }

  async function startPlanAndFinish() {
    if (!userId) return;
    setSaving(true);
    try {
      await saveProfile();
      if (planId) {
        // Seed a "day 0" marker so the app treats this plan as the user's
        // active plan without pretending they've read day 1 yet.
        await supabase.from("user_plan_progress").upsert(
          { user_id: userId, plan_id: planId, day_completed: 0 },
          { onConflict: "user_id,plan_id,day_completed" },
        );
      }
      await supabase
        .from("profiles")
        .update({
          welcome_progress: {
            step: 2,
            tradition,
            ai_enabled: aiEnabled,
            plan_id: planId,
            completed_at: new Date().toISOString(),
          } as never,
        })
        .eq("id", userId);
      toast.success("You're all set", {
        description: planId ? "Your first reading is ready on Today." : undefined,
      });
      navigate({ to: "/home" });
    } finally {
      setSaving(false);
    }
  }

  async function skipToApp() {
    // Still persist tradition + AI choice — they're a one-tap decision either way.
    await saveProfile();
    navigate({ to: "/home" });
  }

  return (
    <AppShell title="Welcome">
      <div className="space-y-8">
        <StepIndicator step={step} total={3} />

        {step === 0 && (
          <TraditionStep
            value={tradition}
            onChange={setTradition}
            onNext={() => setStep(1)}
            onSkip={skipToApp}
          />
        )}
        {step === 1 && (
          <AiStep
            value={aiEnabled}
            onChange={setAiEnabled}
            onBack={() => setStep(0)}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <PlanStep
            plans={plans}
            value={planId}
            onChange={setPlanId}
            onBack={() => setStep(1)}
            onFinish={startPlanAndFinish}
            saving={saving}
          />
        )}
      </div>
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// Chrome
// ---------------------------------------------------------------------------
function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-2" aria-label={`Step ${step + 1} of ${total}`}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 flex-1 rounded-full transition-colors",
            i <= step ? "bg-primary" : "bg-outline-variant",
          )}
        />
      ))}
    </div>
  );
}

function StepHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <header className="space-y-2">
      <p className="label-caps text-primary">{eyebrow}</p>
      <h2 className="font-serif text-3xl leading-tight text-primary">{title}</h2>
      <p className="text-on-surface-variant">{subtitle}</p>
    </header>
  );
}

function StepFooter({
  onBack,
  onSkip,
  primary,
  primaryDisabled,
}: {
  onBack?: () => void;
  onSkip?: () => void;
  primary: { label: string; onClick: () => void };
  primaryDisabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 pt-2">
      <div className="flex gap-2">
        {onBack && (
          <button
            onClick={onBack}
            className="rounded-xl px-3 py-2 text-sm font-medium text-on-surface-variant hover:text-primary focus-candle"
          >
            Back
          </button>
        )}
        {onSkip && (
          <button
            onClick={onSkip}
            className="rounded-xl px-3 py-2 text-sm font-medium text-on-surface-variant hover:text-primary focus-candle"
          >
            Skip for now
          </button>
        )}
      </div>
      <button
        onClick={primary.onClick}
        disabled={primaryDisabled}
        className="btn-shine inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-primary px-5 font-semibold text-on-primary transition-transform hover:scale-[1.02] active:scale-[0.99] disabled:opacity-50 disabled:hover:scale-100 focus-candle"
      >
        {primary.label}
        <Icon name="arrow_forward" className="text-lg" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------
function TraditionStep({
  value,
  onChange,
  onNext,
  onSkip,
}: {
  value: Tradition;
  onChange: (t: Tradition) => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  return (
    <section className="stagger-in space-y-6">
      <StepHeader
        eyebrow="Step 1 of 3"
        title="Which tradition do you call home?"
        subtitle="This shapes how we frame contested passages. You can change it any time in Settings."
      />
      <ul className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Tradition">
        {TRADITIONS.map((t) => {
          const selected = value === t.value;
          return (
            <li key={t.value}>
              <button
                role="radio"
                aria-checked={selected}
                onClick={() => onChange(t.value)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors focus-candle",
                  selected
                    ? "border-primary bg-secondary-container/40"
                    : "border-outline-variant bg-card hover:border-primary/60",
                )}
              >
                <span
                  className={cn(
                    "mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                    selected ? "border-primary bg-primary" : "border-outline",
                  )}
                >
                  {selected && <Icon name="check" className="text-[14px] text-on-primary" />}
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold text-primary">{t.label}</span>
                  <span className="block text-xs text-on-surface-variant">{t.blurb}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <StepFooter onSkip={onSkip} primary={{ label: "Continue", onClick: onNext }} />
    </section>
  );
}

function AiStep({
  value,
  onChange,
  onBack,
  onNext,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <section className="stagger-in space-y-6">
      <StepHeader
        eyebrow="Step 2 of 3"
        title="Would you like AI study help?"
        subtitle="Optional. Our AI only quotes verses it actually found in your Bible — it never invents Scripture. Reading, search, and prayer all work fully without it."
      />

      <div className="space-y-3">
        <ChoiceCard
          selected={value === true}
          onClick={() => onChange(true)}
          icon="auto_awesome"
          title="Yes, turn on AI study"
          blurb="Ask any question and get a citation-locked answer. 5 free sessions a day."
        />
        <ChoiceCard
          selected={value === false}
          onClick={() => onChange(false)}
          icon="menu_book"
          title="No, keep it Scripture-only"
          blurb="Skip AI entirely. Reading, plans, search, and prayer stay fully available."
        />
      </div>

      <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
        <div className="flex items-start gap-3">
          <Icon name="verified_user" filled className="mt-0.5 text-primary" />
          <div className="text-sm text-on-surface-variant">
            <p className="font-semibold text-primary">Your privacy</p>
            <p>Questions are used only to generate your answer. You can turn AI off at any time from Settings.</p>
          </div>
        </div>
      </div>

      <StepFooter onBack={onBack} primary={{ label: "Continue", onClick: onNext }} />
    </section>
  );
}

function ChoiceCard({
  selected,
  onClick,
  icon,
  title,
  blurb,
}: {
  selected: boolean;
  onClick: () => void;
  icon: string;
  title: string;
  blurb: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-start gap-4 rounded-xl border p-4 text-left transition-all focus-candle",
        selected
          ? "border-primary bg-secondary-container/40 shadow-md"
          : "border-outline-variant bg-card hover:border-primary/60",
      )}
    >
      <span
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
          selected ? "bg-primary text-on-primary" : "bg-secondary-container text-on-secondary-container",
        )}
      >
        <Icon name={icon} filled />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-primary">{title}</span>
        <span className="block text-sm text-on-surface-variant">{blurb}</span>
      </span>
      {selected && <Icon name="check_circle" filled className="text-primary" />}
    </button>
  );
}

function PlanStep({
  plans,
  value,
  onChange,
  onBack,
  onFinish,
  saving,
}: {
  plans: Plan[];
  value: string | null;
  onChange: (id: string | null) => void;
  onBack: () => void;
  onFinish: () => void;
  saving: boolean;
}) {
  return (
    <section className="stagger-in space-y-6">
      <StepHeader
        eyebrow="Step 3 of 3"
        title="Pick your first reading plan"
        subtitle="A short daily rhythm — five to ten minutes. You can switch or add plans later."
      />

      {plans.length === 0 ? (
        <div className="rounded-xl border border-outline-variant bg-card p-6 text-center text-sm text-on-surface-variant">
          Loading plans…
        </div>
      ) : (
        <ul className="space-y-3" role="radiogroup" aria-label="Reading plan">
          {plans.map((p) => {
            const selected = value === p.id;
            return (
              <li key={p.id}>
                <button
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onChange(p.id)}
                  className={cn(
                    "flex w-full items-start gap-4 rounded-xl border p-4 text-left transition-all focus-candle",
                    selected
                      ? "border-primary bg-secondary-container/30 shadow-md"
                      : "border-outline-variant bg-card hover:border-primary/60",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl text-xs font-bold leading-tight",
                      selected ? "bg-primary text-on-primary" : "bg-secondary-container text-on-secondary-container",
                    )}
                    aria-hidden
                  >
                    <span className="text-base">{p.day_count}</span>
                    <span className="text-[9px] uppercase tracking-widest">days</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-serif text-lg text-primary">{p.title}</span>
                    {p.description && (
                      <span className="mt-0.5 block text-sm text-on-surface-variant">
                        {p.description}
                      </span>
                    )}
                  </span>
                  {selected && <Icon name="check_circle" filled className="text-primary" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <StepFooter
        onBack={onBack}
        primary={{
          label: saving ? "Setting things up…" : "Start reading",
          onClick: onFinish,
        }}
        primaryDisabled={saving || !value}
      />
    </section>
  );
}
