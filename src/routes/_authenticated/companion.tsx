import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEntitlement } from "@/hooks/use-entitlement";
import { AppShell } from "@/components/app/app-shell";
import { Icon } from "@/components/app/icon";
import { getLocalizedPricing } from "@/lib/pricing";

export const Route = createFileRoute("/_authenticated/companion")({
  beforeLoad: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("ai_enabled")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (profile && profile.ai_enabled === false) {
      throw redirect({ to: "/settings" });
    }
  },
  head: () => ({
    meta: [
      { title: "Companion · Faith Companion" },
      {
        name: "description",
        content:
          "Companion unlocks depth — unlimited AI study, advanced plans, leader tools. Scripture itself is always free.",
      },
    ],
  }),
  component: CompanionPaywall,
});

function CompanionPaywall() {
  const { entitlement, aiUsedToday, aiDailyLimit } = useEntitlement();
  const pricing = getLocalizedPricing();
  const isCompanion = entitlement?.isCompanion ?? false;

  return (
    <AppShell title="Companion">
      <div className="space-y-stack-lg">
        <header className="space-y-3 text-center">
          <div className="flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-on-primary">
              <Icon name="diamond" filled />
            </div>
          </div>
          <h1 className="font-serif text-4xl tracking-tight text-primary">
            Companion
          </h1>
          <p className="mx-auto max-w-md text-on-surface-variant">
            Depth, not access. The Bible, search, the daily verse, the widget,
            one reading plan, groups, and prayer requests are{" "}
            <strong className="text-primary">free forever</strong>.
          </p>
        </header>

        {isCompanion ? (
          <section className="flex items-start gap-3 rounded-xl border border-divider-soft bg-crisis-blue p-5 text-primary">
            <Icon name="verified" filled className="mt-0.5" />
            <div>
              <p className="font-semibold">You're on Companion.</p>
              <p className="mt-1 text-sm text-on-surface-variant">
                Thanks for supporting the work. Manage or cancel in your{" "}
                <a
                  href="https://apps.apple.com/account/subscriptions"
                  className="font-medium text-primary underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  App Store
                </a>{" "}
                /{" "}
                <a
                  href="https://play.google.com/store/account/subscriptions"
                  className="font-medium text-primary underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  Play Store
                </a>{" "}
                account anytime.
              </p>
            </div>
          </section>
        ) : (
          <section className="space-y-1 rounded-xl border border-divider-soft bg-card p-5">
            <p className="text-sm text-on-surface">
              You've used <strong className="text-primary">{aiUsedToday}</strong>{" "}
              of <strong className="text-primary">{aiDailyLimit}</strong> free AI
              study sessions today.
            </p>
            <p className="text-xs text-on-surface-variant">
              The free allowance resets each day. No tricks, no nags.
            </p>
          </section>
        )}

        <section className="grid gap-3 rounded-xl border border-divider-soft bg-card p-6">
          <h2 className="font-serif text-xl text-primary">What's always free</h2>
          <FeatureList
            accent="wood-warm"
            items={[
              "Full Bible reading & translation switching",
              "Keyword search across Scripture",
              "Daily verse + lock-screen widget",
              "One reading plan at a time",
              "Joining groups, posting prayer requests, praying for others",
              "A daily allowance of AI study sessions",
            ]}
          />
        </section>

        <section className="grid gap-3 rounded-xl border-2 border-primary bg-card p-6">
          <h2 className="font-serif text-xl text-primary">What Companion adds</h2>
          <FeatureList
            accent="primary"
            items={[
              "Unlimited AI study sessions",
              "Full audio library — guided prayer, Scripture & sleep",
              "Multiple reading plans & saved study notes",
              "Group leader tools: larger groups, plan scheduling, exports",
              "Early access to new translations as licensing allows",
            ]}
          />
        </section>

        {!isCompanion && (
          <>
            <section className="grid gap-3 sm:grid-cols-3">
              <PlanCard
                id="companion_weekly"
                label="Weekly"
                price={pricing.weekly}
                cadence="per week"
                note="Most flexible"
              />
              <PlanCard
                id="companion_monthly"
                label="Monthly"
                price={pricing.monthly}
                cadence="per month"
                note=""
              />
              <PlanCard
                id="companion_annual"
                label="Annual"
                price={pricing.annual}
                cadence="per year"
                note={`${pricing.annualPerMonth}/mo · best value`}
                highlight
              />
            </section>
            <p className="text-center text-xs text-on-surface-variant">
              Shown in your local currency · billed securely through the App
              Store / Google Play.
            </p>
          </>
        )}

        <section className="space-y-2 rounded-xl border border-divider-soft bg-surface-container-low p-5 text-sm text-on-surface-variant">
          <p>
            <strong className="text-primary">Honest terms.</strong> 7-day free
            trial on annual; cancel anytime from your store account and you keep
            access through the period you paid for. We never sell or share your
            reading, prayer, or AI history.
          </p>
          <button
            onClick={() =>
              alert("Restore handled by RevenueCat in the native app.")
            }
            className="font-semibold text-primary hover:underline"
          >
            Restore purchases
          </button>
        </section>
      </div>
    </AppShell>
  );
}

function FeatureList({
  items,
  accent,
}: {
  items: string[];
  accent: "primary" | "wood-warm";
}) {
  return (
    <ul className="space-y-2 text-sm">
      {items.map((it) => (
        <li key={it} className="flex items-start gap-2 text-on-surface">
          <Icon
            name="check_circle"
            filled
            className={`mt-0.5 text-base ${
              accent === "primary" ? "text-primary" : "text-wood-warm"
            }`}
          />
          {it}
        </li>
      ))}
    </ul>
  );
}

function PlanCard({
  id,
  label,
  price,
  cadence,
  note,
  highlight,
}: {
  id: string;
  label: string;
  price: string;
  cadence: string;
  note: string;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={() => {
        alert(
          "Subscriptions are handled in the native app via RevenueCat. " +
            "Download the Faith Companion from the App Store or Google Play to subscribe.",
        );
      }}
      className={`flex flex-col items-start gap-1 rounded-xl border bg-card p-5 text-left transition-all hover:border-wood-warm ${
        highlight ? "border-2 border-primary" : "border border-divider-soft"
      }`}
    >
      <span className="text-sm font-semibold uppercase tracking-wide text-on-surface-variant">
        {label}
      </span>
      <span className="font-serif text-3xl text-primary">{price}</span>
      <span className="text-xs text-on-surface-variant">{cadence}</span>
      {note && (
        <span className="mt-1 text-xs font-semibold text-wood-warm">{note}</span>
      )}
    </button>
  );
}
