import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEntitlement } from "@/hooks/use-entitlement";
import { AppShell } from "@/components/app/app-shell";
import { Icon } from "@/components/app/icon";

export const Route = createFileRoute("/_authenticated/plans")({
  head: () => ({ meta: [{ title: "Reading plans · Discipleship Companion" }] }),
  component: Plans,
});

type Plan = {
  id: string;
  title: string;
  description: string | null;
  day_count: number;
  is_premium: boolean;
};

function Plans() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { entitlement } = useEntitlement();
  const isCompanion = entitlement?.isCompanion ?? false;

  const plansQuery = useQuery({
    queryKey: ["reading-plans"],
    queryFn: async (): Promise<Plan[]> => {
      const { data, error } = await supabase
        .from("reading_plans")
        .select("id, title, description, day_count, is_premium")
        .order("is_premium")
        .order("title");
      if (error) throw error;
      return (data ?? []) as Plan[];
    },
  });

  const activeQuery = useQuery({
    queryKey: ["active-plan", user.id],
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("active_plan_id")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return (data?.active_plan_id as string | null) ?? null;
    },
  });

  const start = useMutation({
    mutationFn: async (planId: string) => {
      const { error } = await (supabase as any)
        .from("profiles")
        .update({ active_plan_id: planId })
        .eq("id", user.id);
      if (error) throw error;
      await supabase.rpc("unlock_achievement" as any, { _code: "plan_started" });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["active-plan", user.id] });
      navigate({ to: "/home" });
    },
  });

  return (
    <AppShell title="Plans">
      <div className="space-y-stack-md">
        <header className="space-y-2">
          <h1 className="font-serif text-3xl text-primary">Reading plans</h1>
          <p className="text-on-surface-variant">
            Short, daily walks through Scripture. Start one — there's no rush,
            and you can switch any time.
          </p>
        </header>

        {plansQuery.isLoading ? (
          <PlanSkeletons />
        ) : plansQuery.isError ? (
          <ErrorCard onRetry={() => plansQuery.refetch()} />
        ) : plansQuery.data && plansQuery.data.length > 0 ? (
          <ul className="space-y-3">
            {plansQuery.data.map((p) => {
              const isActive = activeQuery.data === p.id;
              const locked = p.is_premium && !isCompanion;
              return (
                <li
                  key={p.id}
                  className={`rounded-xl border bg-white p-5 ${
                    isActive ? "border-2 border-primary" : "border-divider-soft"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-serif text-xl text-primary">
                          {p.title}
                        </h3>
                        {p.is_premium && (
                          <span className="flex items-center gap-1 rounded-lg bg-secondary-container px-2 py-0.5 text-xs font-bold text-on-secondary-container">
                            <Icon name="diamond" filled className="text-xs" />
                            Companion
                          </span>
                        )}
                      </div>
                      {p.description && (
                        <p className="mt-1 text-sm text-on-surface-variant">
                          {p.description}
                        </p>
                      )}
                      <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-wood-warm">
                        {p.day_count} days
                      </p>
                    </div>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-container text-primary">
                      <Icon name="auto_stories" />
                    </div>
                  </div>

                  <div className="mt-4 border-t border-divider-soft pt-3">
                    {isActive ? (
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                        <Icon name="check_circle" filled className="text-base" />
                        Active plan
                      </span>
                    ) : locked ? (
                      <Link
                        to="/companion"
                        className="flex items-center gap-1.5 text-sm font-semibold text-wood-warm hover:text-primary"
                      >
                        <Icon name="lock" className="text-base" />
                        Unlock with Companion
                      </Link>
                    ) : (
                      <button
                        onClick={() => start.mutate(p.id)}
                        disabled={start.isPending}
                        className="h-10 rounded-lg bg-primary px-5 text-sm font-semibold text-on-primary transition-colors hover:bg-navy-deep disabled:opacity-50"
                      >
                        {start.isPending ? "Starting…" : "Start plan"}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-xl border border-divider-soft bg-white p-6 text-center text-sm text-on-surface-variant">
            No plans available yet.
          </p>
        )}
      </div>
    </AppShell>
  );
}

function PlanSkeletons() {
  return (
    <div className="space-y-3">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="h-32 animate-pulse rounded-xl border border-divider-soft bg-surface-container-low"
        />
      ))}
    </div>
  );
}

function ErrorCard({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-divider-soft bg-white p-6 text-center">
      <p className="text-sm text-on-surface-variant">
        We couldn't load plans just now.
      </p>
      <button
        onClick={onRetry}
        className="mt-3 h-10 rounded-lg border border-divider-soft px-4 text-sm font-semibold text-primary hover:border-wood-warm"
      >
        Try again
      </button>
    </div>
  );
}
