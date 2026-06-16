import { createFileRoute, Link } from "@tanstack/react-router";
import { useEntitlement } from "@/hooks/use-entitlement";

export const Route = createFileRoute("/_authenticated/companion")({
  head: () => ({
    meta: [
      { title: "Companion · Discipleship Companion" },
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
  const isCompanion = entitlement?.isCompanion ?? false;

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <header className="space-y-2">
        <Link to="/home" className="text-sm text-muted-foreground hover:text-foreground">
          ← Today
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Companion</h1>
        <p className="text-base text-muted-foreground">
          Depth, not access. The Bible, search, the daily verse, the widget, one
          reading plan, groups, and prayer requests are <strong>free forever</strong>.
        </p>
      </header>

      {isCompanion ? (
        <section className="rounded-md border bg-emerald-50 p-5 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
          <p className="font-medium">You're on Companion.</p>
          <p className="mt-1 text-sm">
            Thanks for supporting the work. Manage or cancel in your{" "}
            <a
              href="https://apps.apple.com/account/subscriptions"
              className="underline"
              target="_blank"
              rel="noreferrer"
            >
              App Store
            </a>{" "}
            /{" "}
            <a
              href="https://play.google.com/store/account/subscriptions"
              className="underline"
              target="_blank"
              rel="noreferrer"
            >
              Play Store
            </a>{" "}
            account anytime.
          </p>
        </section>
      ) : (
        <section className="space-y-2 rounded-md border p-5">
          <p className="text-sm">
            You've used <strong>{aiUsedToday}</strong> of{" "}
            <strong>{aiDailyLimit}</strong> free AI study sessions today.
          </p>
          <p className="text-xs text-muted-foreground">
            The free allowance resets each day. No tricks, no nags.
          </p>
        </section>
      )}

      <section className="grid gap-3 rounded-md border p-5">
        <h2 className="font-medium">What's always free</h2>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>· Full Bible reading & translation switching</li>
          <li>· Keyword search across Scripture</li>
          <li>· Daily verse + lock-screen widget</li>
          <li>· One reading plan at a time</li>
          <li>· Joining groups, posting prayer requests, praying for others</li>
          <li>· A daily allowance of AI study sessions</li>
        </ul>
      </section>

      <section className="grid gap-3 rounded-md border-2 border-primary p-5">
        <h2 className="font-medium">What Companion adds</h2>
        <ul className="space-y-1 text-sm">
          <li>· Unlimited AI study sessions</li>
          <li>· Multiple reading plans & saved study notes</li>
          <li>· Group leader tools: larger groups, plan scheduling, exports</li>
          <li>· Early access to new translations as licensing allows</li>
        </ul>
      </section>

      {!isCompanion && (
        <section className="grid gap-3 sm:grid-cols-2">
          <PlanCard
            id="companion_monthly"
            label="Monthly"
            price="$4.99"
            cadence="per month"
            note=""
          />
          <PlanCard
            id="companion_annual"
            label="Annual"
            price="$39.99"
            cadence="per year"
            note="Save ~33% · 7-day free trial"
            highlight
          />
        </section>
      )}

      <section className="space-y-2 rounded-md border p-5 text-sm text-muted-foreground">
        <p>
          <strong className="text-foreground">Honest terms.</strong> 7-day free
          trial on annual; cancel anytime from your store account and you keep
          access through the period you paid for. We never sell or share your
          reading, prayer, or AI history.
        </p>
        <button
          onClick={() => alert("Restore handled by RevenueCat in the native app.")}
          className="text-primary hover:underline"
        >
          Restore purchases
        </button>
      </section>
    </div>
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
        // In the native app, this calls Purchases.purchasePackage(...)
        // and the RevenueCat webhook updates the entitlement.
        alert(
          `${id} → call RevenueCat Purchases.purchasePackage in the native client.`,
        );
      }}
      className={`flex flex-col items-start gap-1 rounded-md border p-4 text-left transition hover:bg-muted ${
        highlight ? "border-primary bg-primary/5" : ""
      }`}
    >
      <span className="text-sm font-medium">{label}</span>
      <span className="text-2xl font-semibold">{price}</span>
      <span className="text-xs text-muted-foreground">{cadence}</span>
      {note && <span className="mt-1 text-xs text-primary">{note}</span>}
    </button>
  );
}
