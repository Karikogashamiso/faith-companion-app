import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { askStudy } from "@/lib/ai-study.functions";
import { useEntitlement } from "@/hooks/use-entitlement";
import { AppShell, SectionHeading } from "@/components/app/app-shell";
import { Icon } from "@/components/app/icon";

type Message =
  | { role: "user"; text: string }
  | {
      role: "assistant";
      text: string;
      candidates: { book: string; chapter: number; verse: number; text: string }[];
      crisis?: string;
      stripped?: string[];
    };

export const Route = createFileRoute("/_authenticated/study")({
  head: () => ({ meta: [{ title: "Study · Discipleship Companion" }] }),
  component: StudyPage,
});

const SUGGESTIONS = [
  "What does the Bible say about worry?",
  "Where is God when I feel alone?",
  "What does Jesus say about rest?",
  "How should I read the Bible?",
  "What does the Bible say about perseverance?",
];

function StudyPage() {
  const askStudyFn = useServerFn(askStudy);
  const { entitlement, aiUsedToday, aiDailyLimit, reload } = useEntitlement();
  const isCompanion = entitlement?.isCompanion ?? false;
  const freeRemaining = Math.max(0, aiDailyLimit - aiUsedToday);

  const [history, setHistory] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, busy, error]);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!question.trim() || busy) return;
    const q = question.trim();
    setQuestion("");
    setError(null);
    setBusy(true);
    setHistory((h) => [...h, { role: "user", text: q }]);

    try {
      const result = await askStudyFn({ data: { question: q } });
      if (result.disabled) {
        setHistory((h) => [
          ...h,
          {
            role: "assistant",
            text: result.message ?? "AI study is currently unavailable.",
            candidates: [],
          },
        ]);
      } else {
        setHistory((h) => [
          ...h,
          {
            role: "assistant",
            text: result.answer,
            candidates: result.candidates ?? [],
            crisis: result.crisis,
            stripped: result.stripped,
          },
        ]);
      }
      void reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Study">
      <div className="flex h-[calc(100dvh-7rem)] flex-col gap-4 md:h-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="font-serif text-3xl text-primary">Ask the Companion</h1>
            <p className="text-sm text-on-surface-variant">
              Answers grounded in real Scripture — every verse is retrieved first.
            </p>
          </div>
          {!isCompanion && (
            <div className="shrink-0 rounded-lg bg-crisis-blue px-3 py-1.5 text-center">
              <p className="text-xs font-bold text-primary">
                {freeRemaining} free
              </p>
              <p className="text-[10px] text-on-surface-variant">left today</p>
            </div>
          )}
        </div>

        {/* Chat history */}
        <div className="flex-1 space-y-5 overflow-y-auto pr-1">
          {history.length === 0 && (
            <div className="space-y-4">
              <p className="text-sm text-on-surface-variant">
                Try one of these — or ask your own:
              </p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setQuestion(s);
                    }}
                    className="rounded-lg border border-divider-soft bg-white px-3 py-2 text-sm text-on-surface-variant transition-colors hover:border-wood-warm hover:text-primary"
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="rounded-xl border border-divider-soft bg-crisis-blue p-5">
                <div className="flex items-start gap-3">
                  <Icon name="verified" filled className="mt-0.5 text-wood-warm" />
                  <div>
                    <p className="text-sm font-semibold text-primary">
                      Citation-locked answers
                    </p>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      The AI is only allowed to quote verses we actually retrieve.
                      If a verse isn't in the candidate set, it won't appear.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {history.map((msg, i) =>
            msg.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] rounded-xl rounded-tr-sm bg-primary px-4 py-3 text-sm text-on-primary shadow-sm">
                  {msg.text}
                </div>
              </div>
            ) : (
              <div key={i} className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary-container text-xs font-bold text-on-secondary-container">
                    <Icon name="auto_awesome" className="text-sm" />
                  </span>
                  <div className="max-w-[90%] space-y-3">
                    <div className="whitespace-pre-wrap text-sm leading-relaxed text-on-surface">
                      {msg.text}
                    </div>
                    {"candidates" in msg && msg.candidates.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {msg.candidates.map((c) => (
                          <span
                            key={`${c.book}-${c.chapter}-${c.verse}`}
                            className="flex items-center gap-1 rounded-lg bg-crisis-blue px-2.5 py-1 text-xs font-bold text-primary"
                          >
                            <Icon name="verified" filled className="text-sm" />
                            {c.book} {c.chapter}:{c.verse}
                          </span>
                        ))}
                      </div>
                    )}
                    {"stripped" in msg && msg.stripped && msg.stripped.length > 0 && (
                      <p className="text-xs text-on-surface-variant">
                        Guardrail removed {msg.stripped.length} invented reference
                        {msg.stripped.length > 1 ? "s" : ""}.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ),
          )}

          {busy && (
            <div className="flex items-center gap-2 text-sm text-on-surface-variant">
              <Icon name="progress_activity" className="animate-spin text-base" />
              Searching Scripture…
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
              <button
                onClick={() => setError(null)}
                className="ml-2 font-semibold underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {!isCompanion && freeRemaining === 0 && history.length > 0 && (
            <div className="rounded-xl border border-divider-soft bg-crisis-blue p-5 text-center">
              <p className="text-sm font-semibold text-primary">
                You've used your {aiDailyLimit} free sessions for today.
              </p>
              <p className="mt-1 text-sm text-on-surface-variant">
                The count resets tomorrow — or unlock unlimited with Companion.
              </p>
              <Link
                to="/companion"
                className="mt-3 inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-colors hover:bg-navy-deep"
              >
                <Icon name="diamond" filled className="text-base" />
                See Companion
              </Link>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form onSubmit={submit} className="shrink-0">
          <div className="flex items-center gap-2 rounded-xl border border-divider-soft bg-white p-2 shadow-sm">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask about a verse, topic, or struggle…"
              disabled={busy || (!isCompanion && freeRemaining === 0)}
              className="h-11 flex-1 bg-transparent px-3 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy || !question.trim() || (!isCompanion && freeRemaining === 0)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-on-primary transition-colors hover:bg-navy-deep disabled:opacity-40"
              aria-label="Send"
            >
              <Icon name="arrow_upward" />
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
