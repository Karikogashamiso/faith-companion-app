import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { deleteMyAccount } from "@/lib/account.functions";
import type { Database } from "@/integrations/supabase/types";
import { AppShell } from "@/components/app/app-shell";
import { Icon } from "@/components/app/icon";

type Tradition = Database["public"]["Enums"]["tradition"];

const TRADITION_LABELS: Record<Tradition, string> = {
  unspecified: "Prefer not to say",
  non_denominational: "Non-denominational / Just exploring",
  catholic: "Catholic",
  orthodox: "Orthodox",
  anglican: "Anglican / Episcopal",
  lutheran: "Lutheran",
  methodist: "Methodist / Wesleyan",
  baptist: "Baptist",
  reformed: "Reformed / Presbyterian",
  pentecostal: "Pentecostal / Charismatic",
  other: "Other",
};

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings · Discipleship Companion" }] }),
  component: Settings,
});

type Profile = {
  id: string;
  display_name: string | null;
  tradition: Tradition | null;
  ai_enabled: boolean;
  default_version_id: string | null;
  notification_time: string | null;
};

type Version = { id: string; name: string; abbreviation: string };

function Settings() {
  const navigate = useNavigate();
  const { user } = Route.useRouteContext();
  const deleteAccount = useServerFn(deleteMyAccount);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const [{ data: prof }, { data: vers }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id,display_name,tradition,ai_enabled,default_version_id,notification_time")
        .eq("id", user.id)
        .maybeSingle(),
      supabase.from("bible_versions").select("id,name,abbreviation").order("abbreviation"),
    ]);
    if (prof) setProfile(prof as unknown as Profile);
    if (vers) setVersions(vers);
  }

  async function update(patch: Partial<Profile>) {
    if (!profile) return;
    setSaving(true);
    setMsg(null);
    setProfile({ ...profile, ...patch });
    const { error } = await supabase
      .from("profiles")
      .update(patch as never)
      .eq("id", user.id);
    setSaving(false);
    setMsg(error ? `Error: ${error.message}` : "Saved");
    setTimeout(() => setMsg(null), 1500);
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  async function handleDelete() {
    if (
      !window.confirm(
        "Delete your account? This permanently removes your profile, prayers, and progress. This cannot be undone.",
      )
    )
      return;
    try {
      await deleteAccount();
      await supabase.auth.signOut();
      navigate({ to: "/", replace: true });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete account");
    }
  }

  if (!profile) {
    return (
      <AppShell title="Settings">
        <p className="text-sm text-on-surface-variant">Loading…</p>
      </AppShell>
    );
  }

  return (
    <AppShell title="Settings">
      <div className="space-y-stack-lg">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-3xl text-primary">Settings</h1>
          <span
            className={`text-xs ${msg === "Saved" ? "text-wood-warm" : "text-on-surface-variant"}`}
          >
            {msg ?? (saving ? "Saving…" : "")}
          </span>
        </div>

        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-wood-warm">
            Account
          </h2>
          <div className="rounded-xl border border-divider-soft bg-white p-4">
            <div className="text-xs uppercase tracking-wide text-on-surface-variant">
              Signed in as
            </div>
            <div className="text-sm font-medium text-primary">{user.email}</div>
          </div>
          <Link
            to="/companion"
            className="flex items-center justify-between rounded-xl border border-divider-soft bg-white p-4 transition-colors hover:border-wood-warm"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-on-primary">
                <Icon name="diamond" filled />
              </span>
              <span>
                <span className="block text-sm font-semibold text-primary">
                  Companion
                </span>
                <span className="block text-xs text-on-surface-variant">
                  Unlimited study, plans & leader tools
                </span>
              </span>
            </span>
            <Icon name="arrow_forward" className="text-on-surface-variant" />
          </Link>
        </section>

        <Field label="Display name">
          <input
            type="text"
            value={profile.display_name ?? ""}
            onChange={(e) =>
              setProfile({ ...profile, display_name: e.target.value })
            }
            onBlur={(e) => update({ display_name: e.target.value })}
            className="h-11 w-full rounded-lg border border-divider-soft bg-white px-3 text-sm focus:border-primary focus:outline-none"
          />
        </Field>

        <Field label="Tradition">
          <select
            value={profile.tradition ?? ""}
            onChange={(e) => update({ tradition: e.target.value as Tradition })}
            className="h-11 w-full rounded-lg border border-divider-soft bg-white px-3 text-sm focus:border-primary focus:outline-none"
          >
            <option value="" disabled>
              Choose…
            </option>
            {(Object.keys(TRADITION_LABELS) as Tradition[]).map((t) => (
              <option key={t} value={t}>
                {TRADITION_LABELS[t]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Translation">
          <select
            value={profile.default_version_id ?? ""}
            onChange={(e) => update({ default_version_id: e.target.value })}
            className="h-11 w-full rounded-lg border border-divider-soft bg-white px-3 text-sm focus:border-primary focus:outline-none"
          >
            <option value="" disabled>
              Choose…
            </option>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.abbreviation})
              </option>
            ))}
          </select>
        </Field>

        <Field label="Daily notification time">
          <input
            type="time"
            value={profile.notification_time ?? ""}
            onChange={(e) =>
              setProfile({ ...profile, notification_time: e.target.value })
            }
            onBlur={(e) => update({ notification_time: e.target.value || null })}
            className="h-11 w-full rounded-lg border border-divider-soft bg-white px-3 text-sm focus:border-primary focus:outline-none"
          />
        </Field>

        <section className="rounded-xl border border-divider-soft bg-white p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <Icon name="auto_awesome" className="mt-0.5 text-wood-warm" />
              <div>
                <div className="text-sm font-semibold text-primary">
                  AI study helper
                </div>
                <p className="mt-1 text-xs text-on-surface-variant">
                  Optional. Citation-locked — only quotes verses we've retrieved.
                </p>
              </div>
            </div>
            <button
              role="switch"
              aria-checked={profile.ai_enabled}
              onClick={() => update({ ai_enabled: !profile.ai_enabled })}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                profile.ai_enabled ? "bg-primary" : "bg-surface-container-high"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  profile.ai_enabled ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
        </section>

        <section className="space-y-2 border-t border-divider-soft pt-6">
          <button
            onClick={signOut}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-divider-soft bg-white text-sm font-semibold text-primary transition-colors hover:border-wood-warm"
          >
            <Icon name="logout" className="text-base" />
            Sign out
          </button>
          <button
            onClick={handleDelete}
            className="h-12 w-full rounded-lg border border-destructive/40 bg-white text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10"
          >
            Delete account
          </button>
          <p className="pt-2 text-center text-xs text-on-surface-variant">
            Deleting your account is permanent.
          </p>
        </section>
      </div>
    </AppShell>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-semibold uppercase tracking-widest text-wood-warm">
        {label}
      </span>
      {children}
    </label>
  );
}
