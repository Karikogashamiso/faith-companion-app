import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/app-shell";
import { Icon } from "@/components/app/icon";
import {
  Button,
  Card,
  EmptyState,
  IconBadge,
  ScreenTitle,
  Skeleton,
} from "@/components/app/ui";
import { ALL_DAYS, DAY_LETTERS, describeDays, formatTime } from "@/lib/reminders";

export const Route = createFileRoute("/_authenticated/reminders")({
  head: () => ({ meta: [{ title: "Reminders · Discipleship Companion" }] }),
  component: Reminders,
});

type Reminder = {
  id: string;
  kind: "verse" | "prayer";
  label: string;
  at_time: string;
  days: number[];
  enabled: boolean;
};

function Reminders() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const key = ["reminders", user.id];

  const [kind, setKind] = useState<"verse" | "prayer">("prayer");
  const [time, setTime] = useState("07:30");
  const [label, setLabel] = useState("");
  const [days, setDays] = useState<number[]>(ALL_DAYS);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );

  const q = useQuery({
    queryKey: key,
    queryFn: async (): Promise<Reminder[]> => {
      const { data, error } = await (supabase as any)
        .from("reminders")
        .select("id, kind, label, at_time, days, enabled")
        .order("at_time");
      if (error) throw error;
      return (data ?? []) as Reminder[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("reminders").insert({
        user_id: user.id,
        kind,
        label: label.trim(),
        at_time: time + ":00",
        days,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setLabel("");
      await qc.invalidateQueries({ queryKey: key });
    },
  });

  const toggle = useMutation({
    mutationFn: async (r: Reminder) => {
      await (supabase as any)
        .from("reminders")
        .update({ enabled: !r.enabled })
        .eq("id", r.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await (supabase as any).from("reminders").delete().eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  async function askPermission() {
    if (typeof Notification === "undefined") return;
    try {
      setPerm(await Notification.requestPermission());
    } catch {
      /* denied */
    }
  }

  function toggleDay(d: number) {
    setDays((cur) =>
      cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort(),
    );
  }

  const list = q.data ?? [];

  return (
    <AppShell title="Reminders">
      <div className="space-y-stack-md">
        <ScreenTitle
          title="Reminders"
          subtitle="Gentle nudges for your daily verse and times of prayer."
        />

        {perm !== "granted" && perm !== "unsupported" && (
          <Card tone="info" className="flex items-center gap-3">
            <IconBadge name="notifications" tone="ink" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-primary">
                Turn on notifications
              </p>
              <p className="text-xs text-on-surface-variant">
                So your reminders can reach you.
              </p>
            </div>
            <Button size="sm" onClick={askPermission}>
              Enable
            </Button>
          </Card>
        )}

        {/* Add a reminder */}
        <Card className="space-y-4">
          <div
            role="radiogroup"
            aria-label="Reminder type"
            className="grid grid-cols-2 gap-1 rounded-lg border border-divider-soft bg-scripture-cream p-1"
          >
            {(["prayer", "verse"] as const).map((k) => (
              <button
                key={k}
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className={`flex h-10 items-center justify-center gap-1.5 rounded-md text-sm font-semibold transition-gentle ${
                  kind === k
                    ? "bg-primary text-on-primary"
                    : "text-on-surface-variant hover:text-primary"
                }`}
              >
                <Icon name={k === "prayer" ? "front_hand" : "menu_book"} className="text-base" />
                {k === "prayer" ? "Prayer" : "Daily verse"}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              aria-label="Time"
              className="h-12 flex-1 rounded-lg border border-divider-soft bg-scripture-cream px-3 font-serif text-2xl text-primary focus:border-primary focus:outline-none"
            />
          </div>

          {kind === "prayer" && (
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label (e.g. Morning prayer)"
              maxLength={60}
              className="h-11 w-full rounded-lg border border-divider-soft bg-scripture-cream px-3 text-sm focus:border-primary focus:outline-none"
            />
          )}

          <div className="flex justify-between gap-1" role="group" aria-label="Repeat days">
            {DAY_LETTERS.map((letter, d) => {
              const on = days.includes(d);
              return (
                <button
                  key={d}
                  aria-pressed={on}
                  aria-label={`Day ${d}`}
                  onClick={() => toggleDay(d)}
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition-gentle ${
                    on
                      ? "bg-primary text-on-primary"
                      : "bg-surface-container text-on-surface-variant"
                  }`}
                >
                  {letter}
                </button>
              );
            })}
          </div>

          <Button
            block
            leftIcon="add_alarm"
            loading={add.isPending}
            disabled={days.length === 0}
            onClick={() => add.mutate()}
          >
            Add reminder
          </Button>
        </Card>

        {/* Existing reminders */}
        {q.isLoading ? (
          <Skeleton className="h-24" />
        ) : list.length === 0 ? (
          <EmptyState
            icon="alarm"
            title="No reminders yet"
            description="Add a verse or prayer reminder above."
          />
        ) : (
          <ul className="space-y-2">
            {list.map((r) => (
              <li key={r.id}>
                <Card className={r.enabled ? "" : "opacity-60"}>
                  <div className="flex items-center gap-4">
                    <IconBadge
                      name={r.kind === "verse" ? "menu_book" : "front_hand"}
                      tone={r.enabled ? "info" : "neutral"}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-serif text-2xl text-primary">
                        {formatTime(r.at_time)}
                      </p>
                      <p className="truncate text-sm text-on-surface-variant">
                        {(r.kind === "verse"
                          ? "Daily verse"
                          : r.label || "Prayer") + " · " + describeDays(r.days)}
                      </p>
                    </div>
                    <button
                      role="switch"
                      aria-checked={r.enabled}
                      aria-label="Enabled"
                      onClick={() => toggle.mutate(r)}
                      className={`relative h-6 w-11 shrink-0 rounded-full transition-gentle ${
                        r.enabled ? "bg-primary" : "bg-surface-container-high"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-card shadow transition-transform ${
                          r.enabled ? "translate-x-5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-divider-soft pt-2">
                    <div className="flex gap-1">
                      {DAY_LETTERS.map((letter, d) => (
                        <span
                          key={d}
                          className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                            r.days.includes(d)
                              ? "bg-secondary-container text-on-secondary-container"
                              : "text-outline"
                          }`}
                        >
                          {letter}
                        </span>
                      ))}
                    </div>
                    <button
                      onClick={() => remove.mutate(r.id)}
                      aria-label="Delete reminder"
                      className="text-on-surface-variant transition-gentle hover:text-destructive"
                    >
                      <Icon name="delete" className="text-lg" />
                    </button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
