import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEntitlement } from "@/hooks/use-entitlement";
import { AppShell } from "@/components/app/app-shell";
import { Icon } from "@/components/app/icon";
import {
  Button,
  Card,
  Chip,
  EmptyState,
  IconBadge,
  ScreenTitle,
  Skeleton,
} from "@/components/app/ui";

export const Route = createFileRoute("/_authenticated/plans")({
  head: () => ({ meta: [{ title: "Reading plans · Faith Companion" }] }),
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
        <ScreenTitle
          title="Reading plans"
          subtitle="Short, daily walks through Scripture. Start one — there's no rush, and you can switch any time."
        />

        {plansQuery.isLoading ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : plansQuery.isError ? (
          <EmptyState
            icon="cloud_off"
            title="We couldn't load plans"
            description="Please try again in a moment."
            action={
              <Button variant="secondary" size="sm" onClick={() => plansQuery.refetch()}>
                Try again
              </Button>
            }
          />
        ) : plansQuery.data && plansQuery.data.length > 0 ? (
          <ul className="space-y-3">
            {plansQuery.data.map((p) => {
              const isActive = activeQuery.data === p.id;
              const locked = p.is_premium && !isCompanion;
              return (
                <li key={p.id}>
                  <Card tone={isActive ? "highlight" : "base"}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-serif text-xl text-primary">
                            {p.title}
                          </h3>
                          {p.is_premium && (
                            <Chip tone="accent" icon="diamond" iconFilled>
                              Companion
                            </Chip>
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
                      <IconBadge name="auto_stories" tone="neutral" />
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
                        <Button
                          size="sm"
                          loading={start.isPending}
                          onClick={() => start.mutate(p.id)}
                        >
                          {start.isPending ? "Starting…" : "Start plan"}
                        </Button>
                      )}
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon="auto_stories"
            title="No plans yet"
            description="New reading plans are on the way."
          />
        )}
      </div>
    </AppShell>
  );
}
