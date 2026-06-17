import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Icon } from "@/components/app/icon";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in · Faith Companion" },
      { name: "description", content: "Sign in or create your account." },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/onboarding" });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") navigate({ to: "/onboarding" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuth(provider: "google" | "apple") {
    setError(null);
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setError(result.error.message ?? "Sign-in failed");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-scripture-cream px-margin-mobile">
      <div className="w-full max-w-sm space-y-stack-md">
        <div className="text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-primary"
          >
            <Icon name="arrow_back" className="text-base" />
            Home
          </Link>
          <div className="mt-stack-md flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-on-primary">
              <Icon name="menu_book" className="text-3xl" />
            </div>
          </div>
          <h1 className="mt-stack-md font-headline-md text-headline-md tracking-tight text-primary">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            {mode === "signin"
              ? "Continue your reading rhythm."
              : "A quiet companion for daily Scripture."}
          </p>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => handleOAuth("google")}
            disabled={loading}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-divider-soft bg-card text-sm font-semibold text-primary transition-colors hover:border-wood-warm disabled:opacity-50"
          >
            Continue with Google
          </button>
          <button
            onClick={() => handleOAuth("apple")}
            disabled={loading}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-divider-soft bg-card text-sm font-semibold text-primary transition-colors hover:border-wood-warm disabled:opacity-50"
          >
            Continue with Apple
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-divider-soft" />
          <span className="text-xs uppercase tracking-wider text-on-surface-variant">
            or email
          </span>
          <div className="h-px flex-1 bg-divider-soft" />
        </div>

        <form onSubmit={handleEmail} className="space-y-3">
          {mode === "signup" && (
            <input
              type="text"
              placeholder="Display name (optional)"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="h-12 w-full rounded-lg border border-divider-soft bg-card px-4 text-sm focus:border-primary focus:outline-none"
            />
          )}
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 w-full rounded-lg border border-divider-soft bg-card px-4 text-sm focus:border-primary focus:outline-none"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 w-full rounded-lg border border-divider-soft bg-card px-4 text-sm focus:border-primary focus:outline-none"
          />
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="h-12 w-full rounded-lg bg-primary text-sm font-semibold text-on-primary transition-colors hover:bg-navy-deep disabled:opacity-50"
          >
            {loading
              ? "Working…"
              : mode === "signin"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>

        <p className="text-center text-sm text-on-surface-variant">
          {mode === "signin" ? "New here? " : "Already have an account? "}
          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            {mode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
