import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/app-shell";
import { Card, Chip, EmptyState, ScreenTitle, Skeleton } from "@/components/app/ui";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin · Faith Companion" }] }),
  component: Admin,
});

type Metrics = {
  days: number;
  views: number;
  cta_clickers: number;
  demo_users: number;
  store_clickers: number;
  signups: number;
  paywall_views: number;
  cta_by_location: Record<string, number>;
};

const RANGES = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

function pct(n: number, d: number): string {
  if (!d) return "—";
  return `${((100 * n) / d).toFixed(1)}%`;
}

function Admin() {
  const [days, setDays] = useState(30);

  const q = useQuery({
    queryKey: ["admin-funnel", days],
    retry: false,
    queryFn: async (): Promise<Metrics> => {
      const { data, error } = await (supabase as any).rpc("admin_funnel_metrics", {
        _days: days,
      });
      if (error) throw error;
      return data as Metrics;
    },
  });

  const m = q.data;

  return (
    <AppShell title="Admin">
      <div className="space-y-stack-md">
        <ScreenTitle
          title="Conversion"
          subtitle="Anonymous landing funnel → signups."
        />

        <div
          role="radiogroup"
          aria-label="Time range"
          className="inline-flex gap-1 rounded-lg border border-divider-soft bg-card p-1"
        >
          {RANGES.map((r) => (
            <button
              key={r.days}
              role="radio"
              aria-checked={days === r.days}
              onClick={() => setDays(r.days)}
              className={`h-9 rounded-md px-4 text-sm font-semibold transition-gentle ${
                days === r.days
                  ? "bg-primary text-on-primary"
                  : "text-on-surface-variant hover:text-primary"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {q.isLoading ? (
          <div className="grid grid-cols-2 gap-gutter sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : q.isError ? (
          <EmptyState
            icon="lock"
            title="Admins only"
            description="This dashboard requires the admin role. Ask an admin to grant it via the user_roles table."
          />
        ) : m ? (
          <>
            <div className="grid grid-cols-2 gap-gutter sm:grid-cols-3">
              <Metric label="Visitors" value={m.views} />
              <Metric
                label="CTA clicks"
                value={m.cta_clickers}
                sub={`${pct(m.cta_clickers, m.views)} of visitors`}
              />
              <Metric
                label="Signups"
                value={m.signups}
                sub={`${pct(m.signups, m.views)} of visitors`}
                accent
              />
              <Metric label="Demo tries" value={m.demo_users} />
              <Metric label="Store clicks" value={m.store_clickers} />
              <Metric label="Paywall views" value={m.paywall_views} />
            </div>

            <Card className="space-y-3">
              <h3 className="font-serif text-lg text-primary">CTA clicks by placement</h3>
              {Object.keys(m.cta_by_location ?? {}).length === 0 ? (
                <p className="text-sm text-on-surface-variant">No clicks yet.</p>
              ) : (
                <ul className="space-y-2">
                  {Object.entries(m.cta_by_location)
                    .sort((a, b) => b[1] - a[1])
                    .map(([loc, count]) => (
                      <li key={loc} className="flex items-center justify-between">
                        <Chip tone="info">{loc}</Chip>
                        <span className="font-serif text-lg text-primary">{count}</span>
                      </li>
                    ))}
                </ul>
              )}
            </Card>

            <p className="text-xs text-on-surface-variant">
              Funnel over the last {m.days} days. Visit → signup is the headline
              conversion rate. See docs/CONVERSION_ANALYTICS.md for the full SQL.
            </p>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}

function Metric({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <Card padding="sm" className={accent ? "border-primary" : ""}>
      <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
        {label}
      </p>
      <p className={`mt-1 font-serif text-3xl ${accent ? "text-primary" : "text-on-surface"}`}>
        {value ?? 0}
      </p>
      {sub && <p className="mt-0.5 text-xs text-on-surface-variant">{sub}</p>}
    </Card>
  );
}
