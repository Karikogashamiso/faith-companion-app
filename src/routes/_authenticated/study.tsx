import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { askStudy, flagAnswer } from "@/lib/ai-study.functions";
import { AppShell } from "@/components/app/app-shell";
import { Icon } from "@/components/app/icon";

export const Route = createFileRoute("/_authenticated/study")({
  head: () => ({ meta: [{ title: "Study · Discipleship Companion" }] }),
  component: Study,
});

const SUGGESTIONS = [
  "What does the Bible say about worry?",
  "Where is God when I feel alone?",
  "What does Jesus say about rest?",
  "How do I forgive someone who hurt me?",
];

type Result = Awaited<ReturnType<typeof askStudy>>;

function Study() {
  const askStudyFn = useServerFn(askStudy);
  const flagFn = useServerFn(flagAnswer);

  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [asked, setAsked] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const [flagOpen, setFlagOpen] = useState(false);
  const [flagReason, setFlagReason] = useState("");
  const [flagDone, setFlagDone] = useState(false);

  async function ask(q: string) {
    const query = q.trim();
    if (query.length < 3) return;
    setLoading(true);
    setErr(null);
    setResult(null);
    setFlagOpen(false);
    setFlagDone(false);
    setFlagReason("");
    setAsked(query);
    try {
      const r = await askStudyFn({ data: { question: query } });
      setResult(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function submitFlag() {
    if (!result || result.disabled) return;
    try {
      await flagFn({
        data: {
          question: asked,
          answer: result.answer,
          reason: flagReason.trim() || undefined,
          refs: result.candidates.map((c) => ({
            book: c.book,
            chapter: c.chapter,
            verse: c.verse,
          })),
        },
      });
      setFlagDone(true);
      setFlagOpen(false);
    } catch {
      /* swallow — flagging should never block the user */
      setFlagDone(true);
      setFlagOpen(false);
    }
  }

  return (
    <AppShell title="Study">
      <div className="space-y-stack-md">
        <header className="space-y-2">
          <h1 className="font-serif text-3xl text-primary">Ask the Companion</h1>
          <p className="text-on-surface-variant">
            Every answer quotes only verses we actually retrieve — and links
            them so you can check for yourself.
          </p>
        </header>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void ask(question);
          }}
          className="rounded-xl border border-divider-soft bg-white p-4"
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What does the Bible say about…"
              className="h-12 flex-1 rounded-lg border border-divider-soft bg-scripture-cream px-4 text-sm focus:border-primary focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading || question.trim().length < 3}
              className="flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-on-primary transition-colors hover:bg-navy-deep disabled:opacity-40"
            >
              {loading ? (
                <Icon name="progress_activity" className="animate-spin" />
              ) : (
                <Icon name="auto_awesome" filled />
              )}
              {loading ? "Searching…" : "Ask"}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setQuestion(s);
                  void ask(s);
                }}
                className="rounded-lg border border-divider-soft bg-scripture-cream px-3 py-1.5 text-xs text-on-surface-variant hover:border-wood-warm hover:text-primary"
              >
                {s}
              </button>
            ))}
          </div>
        </form>

        {err && (
          <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {err}
          </p>
        )}

        {result && result.disabled && (
          <div className="space-y-3 rounded-xl border border-divider-soft bg-white p-5">
            <p className="text-sm text-on-surface">{result.message}</p>
            {"paywall" in result && result.paywall && (
              <Link
                to="/companion"
                className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary hover:bg-navy-deep"
              >
                See Companion
              </Link>
            )}
          </div>
        )}

        {result && !result.disabled && (
          <div className="space-y-4 rounded-xl border border-divider-soft bg-white p-5">
            <p className="whitespace-pre-wrap leading-relaxed text-on-surface">
              {result.answer}
            </p>

            {result.candidates.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-wood-warm">
                  Sources
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {result.candidates.slice(0, 6).map((c) => (
                    <span
                      key={`${c.book}-${c.chapter}-${c.verse}`}
                      className="flex items-center gap-1 rounded-lg bg-crisis-blue px-2.5 py-1 text-xs font-bold text-primary"
                    >
                      <Icon name="verified" filled className="text-sm" />
                      {c.book} {c.chapter}:{c.verse}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-divider-soft pt-3">
              {flagDone ? (
                <p className="flex items-center gap-1.5 text-sm text-on-surface-variant">
                  <Icon name="check" className="text-base text-wood-warm" />
                  Thanks — we'll review this answer.
                </p>
              ) : flagOpen ? (
                <div className="space-y-2">
                  <textarea
                    value={flagReason}
                    onChange={(e) => setFlagReason(e.target.value)}
                    rows={2}
                    maxLength={500}
                    placeholder="What seems wrong or misleading? (optional)"
                    className="w-full resize-none rounded-lg border border-divider-soft bg-scripture-cream px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={submitFlag}
                      className="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary hover:bg-navy-deep"
                    >
                      Submit report
                    </button>
                    <button
                      onClick={() => setFlagOpen(false)}
                      className="h-9 rounded-lg px-3 text-sm text-on-surface-variant hover:text-primary"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setFlagOpen(true)}
                  className="flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-primary"
                >
                  <Icon name="flag" className="text-base" />
                  Report this answer
                </button>
              )}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-on-surface-variant">
          The Companion is a study aid, not a substitute for Scripture, prayer,
          or a real pastor. You can turn it off in Settings.
        </p>
      </div>
    </AppShell>
  );
}
