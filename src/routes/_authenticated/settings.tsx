import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { deleteMyAccount } from "@/lib/account.functions";
import type { Database } from "@/integrations/supabase/types";

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
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Home
          </Link>
          <h1 className="text-lg font-semibold text-foreground">Settings</h1>
          <span className="w-12 text-right text-xs text-muted-foreground">
            {msg ?? (saving ? "…" : "")}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-8 px-6 py-8">
        <section className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Account
          </h2>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground">Signed in as</div>
            <div className="text-sm text-foreground">{user.email}</div>
          </div>
        </section>

        <Field label="Display name">
          <input
            type="text"
            value={profile.display_name ?? ""}
            onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
            onBlur={(e) => update({ display_name: e.target.value })}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
        </Field>

        <Field label="Tradition">
          <select
            value={profile.tradition ?? ""}
            onChange={(e) => update({ tradition: e.target.value as Tradition })}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
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
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
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
            onChange={(e) => setProfile({ ...profile, notification_time: e.target.value })}
            onBlur={(e) => update({ notification_time: e.target.value || null })}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
        </Field>

        <section className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-foreground">AI study helper</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Optional. Citation-locked — only quotes verses we've retrieved.
              </p>
            </div>
            <button
              role="switch"
              aria-checked={profile.ai_enabled}
              onClick={() => update({ ai_enabled: !profile.ai_enabled })}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                profile.ai_enabled ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform ${
                  profile.ai_enabled ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
        </section>

        <section className="space-y-2 border-t border-border pt-6">
          <button
            onClick={signOut}
            className="h-11 w-full rounded-md border border-input bg-background text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Sign out
          </button>
          <button
            onClick={handleDelete}
            className="h-11 w-full rounded-md border border-destructive/40 bg-background text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
          >
            Delete account
          </button>
          <p className="pt-2 text-center text-xs text-muted-foreground">
            Deleting your account is permanent.
          </p>
        </section>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
