import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Tradition = Database["public"]["Enums"]["tradition"];

const TRADITIONS: { value: Tradition; label: string; blurb: string }[] = [
  { value: "non_denominational", label: "Non-denominational / Just exploring", blurb: "No assumptions. Just the text." },
  { value: "catholic", label: "Catholic", blurb: "Including the deuterocanon." },
  { value: "orthodox", label: "Orthodox", blurb: "Eastern & Oriental traditions." },
  { value: "anglican", label: "Anglican / Episcopal", blurb: "Common Prayer rhythm." },
  { value: "lutheran", label: "Lutheran", blurb: "Word and sacrament." },
  { value: "methodist", label: "Methodist / Wesleyan", blurb: "Practical holiness." },
  { value: "baptist", label: "Baptist", blurb: "Believer's baptism." },
  { value: "reformed", label: "Reformed / Presbyterian", blurb: "Covenantal tradition." },
  { value: "pentecostal", label: "Pentecostal / Charismatic", blurb: "Spirit-led emphasis." },
  { value: "other", label: "Other", blurb: "Something else, or in-between." },
  { value: "unspecified", label: "Prefer not to say", blurb: "Skip for now." },
];

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Welcome · Discipleship Companion" }] }),
  component: Onboarding,
});

type Version = { id: string; name: string; abbreviation: string; language: string };

function Onboarding() {
  const navigate = useNavigate();
  const { user } = Route.useRouteContext();
  const [step, setStep] = useState(0);
  const [tradition, setTradition] = useState<Tradition | null>(null);
  const [versionId, setVersionId] = useState<string | null>(null);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [versions, setVersions] = useState<Version[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("bible_versions")
      .select("id,name,abbreviation,language")
      .order("abbreviation")
      .then(({ data }) => {
        if (data) {
          setVersions(data);
          if (data.length > 0) setVersionId(data[0].id);
        }
      });
  }, []);

  async function finish(skip = false) {
    setSaving(true);
    await supabase
      .from("profiles")
      .update({
        ai_enabled: aiEnabled,
        ...(tradition ? { tradition } : {}),
        ...(versionId ? { default_version_id: versionId } : {}),
      })
      .eq("id", user.id);
    void skip;
    navigate({ to: "/settings" });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between px-6 py-4">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          Step {step + 1} of 4
        </span>
        <button
          onClick={() => finish(true)}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Skip
        </button>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 pb-10">
        {step === 0 && (
          <Pane
            title="Welcome."
            subtitle="A quiet space for Scripture, prayer, and reflection — citation-locked, never invented."
            primary={{ label: "Begin", onClick: () => setStep(1) }}
          />
        )}

        {step === 1 && (
          <Pane
            title="Your tradition"
            subtitle="This shapes vocabulary and which translations we suggest. You can change this anytime."
            primary={{
              label: "Continue",
              onClick: () => setStep(2),
              disabled: !tradition,
            }}
          >
            <div className="space-y-2">
              {TRADITIONS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTradition(t.value)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    tradition === t.value
                      ? "border-primary bg-primary/5"
                      : "border-input hover:bg-accent"
                  }`}
                >
                  <div className="text-sm font-medium text-foreground">{t.label}</div>
                  <div className="text-xs text-muted-foreground">{t.blurb}</div>
                </button>
              ))}
            </div>
          </Pane>
        )}

        {step === 2 && (
          <Pane
            title="Translation"
            subtitle="Choose your default Bible translation."
            primary={{
              label: "Continue",
              onClick: () => setStep(3),
              disabled: !versionId,
            }}
          >
            <div className="space-y-2">
              {versions.length === 0 && (
                <p className="text-sm text-muted-foreground">Loading translations…</p>
              )}
              {versions.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setVersionId(v.id)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    versionId === v.id
                      ? "border-primary bg-primary/5"
                      : "border-input hover:bg-accent"
                  }`}
                >
                  <div className="text-sm font-medium text-foreground">
                    {v.name}{" "}
                    <span className="text-muted-foreground">({v.abbreviation})</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{v.language}</div>
                </button>
              ))}
            </div>
          </Pane>
        )}

        {step === 3 && (
          <Pane
            title="Optional AI study helper"
            subtitle="A grounded helper that only quotes verses we've actually retrieved — never invented. You can turn it off and use the app without it."
            primary={{
              label: saving ? "Saving…" : "Finish",
              onClick: () => finish(false),
              disabled: saving,
            }}
          >
            <div className="space-y-2">
              <button
                onClick={() => setAiEnabled(true)}
                className={`w-full rounded-lg border p-4 text-left transition-colors ${
                  aiEnabled
                    ? "border-primary bg-primary/5"
                    : "border-input hover:bg-accent"
                }`}
              >
                <div className="text-sm font-medium text-foreground">
                  Yes, enable the AI helper
                </div>
                <div className="text-xs text-muted-foreground">
                  Ask questions and receive grounded, cited responses.
                </div>
              </button>
              <button
                onClick={() => setAiEnabled(false)}
                className={`w-full rounded-lg border p-4 text-left transition-colors ${
                  !aiEnabled
                    ? "border-primary bg-primary/5"
                    : "border-input hover:bg-accent"
                }`}
              >
                <div className="text-sm font-medium text-foreground">
                  No thanks — just Scripture
                </div>
                <div className="text-xs text-muted-foreground">
                  Use reading plans, prayer, and groups without AI.
                </div>
              </button>
            </div>
          </Pane>
        )}
      </main>
    </div>
  );
}

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
      <div className="space-y-2 pb-6 pt-4">
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
