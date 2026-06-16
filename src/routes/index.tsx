import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Discipleship Companion — Bible, daily habit, real community" },
      {
        name: "description",
        content:
          "Understand the Bible, build a daily habit, and never feel alone in it. Answers grounded in real Scripture — it never makes things up.",
      },
      { property: "og:title", content: "Discipleship Companion" },
      {
        property: "og:description",
        content:
          "Understand the Bible. Build the habit. Never alone. Answers grounded in real Scripture — it never makes things up.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "MobileApplication",
          name: "Discipleship Companion",
          applicationCategory: "LifestyleApplication",
          operatingSystem: "iOS, Android",
          description:
            "A grounded Bible study companion with daily habit, community, and citation-locked AI.",
        }),
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />
      <main>
        <Hero />
        <LiveDemo />
        <SocialProof />
        <Differentiator />
        <HowItWorks />
        <Pricing />
        <FAQ />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Nav
// ---------------------------------------------------------------------------
function SiteNav() {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link to="/" className="text-sm font-semibold tracking-tight">
          Discipleship Companion
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <a href="#how" className="text-muted-foreground hover:text-foreground">
            How it works
          </a>
          <a href="#pricing" className="text-muted-foreground hover:text-foreground">
            Pricing
          </a>
          <Link
            to="/auth"
            className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground hover:bg-primary/90"
          >
            Open the app
          </Link>
        </nav>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// 1) HERO
// ---------------------------------------------------------------------------
function Hero() {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-16 md:grid-cols-2 md:py-24">
      <div className="space-y-6">
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
          Understand the Bible.
          <br />
          Build the habit.
          <br />
          <span className="text-primary">Never alone.</span>
        </h1>
        <p className="max-w-md text-base text-muted-foreground md:text-lg">
          Answers grounded in real Scripture — it never makes things up.
        </p>
        <div className="flex flex-wrap gap-3" aria-label="Install the app">
          <StoreBadge store="ios" />
          <StoreBadge store="android" />
        </div>
        <p className="text-xs text-muted-foreground">
          Or{" "}
          <Link to="/auth" className="underline hover:text-foreground">
            try it in your browser
          </Link>
          .
        </p>
      </div>
      <PhoneMockup />
    </section>
  );
}

function PhoneMockup() {
  return (
    <div
      role="img"
      aria-label="Phone preview showing a daily verse and a tappable AI question"
      className="mx-auto w-full max-w-[280px]"
    >
      <div className="relative aspect-[9/19] rounded-[2.5rem] border-8 border-foreground/80 bg-background shadow-2xl">
        <div className="absolute inset-x-12 top-2 h-4 rounded-b-xl bg-foreground/80" />
        <div className="absolute inset-3 flex flex-col gap-3 overflow-hidden rounded-[2rem] bg-muted p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Today · Day 3
          </p>
          <p className="text-sm font-medium leading-snug">
            “Be still, and know that I am God.”
          </p>
          <p className="text-[11px] text-muted-foreground">Psalm 46:10</p>
          <div className="mt-2 space-y-1 rounded-md bg-background p-2 text-[11px]">
            <p className="font-medium">Ask</p>
            <p className="text-muted-foreground">
              What does the Bible say about worry?
            </p>
          </div>
          <div className="mt-auto flex gap-1">
            <span className="rounded-full bg-background px-2 py-0.5 text-[9px]">
              Phil 4:6
            </span>
            <span className="rounded-full bg-background px-2 py-0.5 text-[9px]">
              Matt 6:34
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StoreBadge({ store }: { store: "ios" | "android" }) {
  // Real badges link to the live store listings; until those exist we land users in the web app.
  const href = "/auth";
  const label =
    store === "ios" ? "Download on the App Store" : "Get it on Google Play";
  return (
    <a
      href={href}
      aria-label={label}
      className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-background hover:opacity-90"
    >
      <span aria-hidden className="text-xl">
        {store === "ios" ? "" : "▶"}
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-[9px] uppercase tracking-wider opacity-75">
          {store === "ios" ? "Download on the" : "Get it on"}
        </span>
        <span className="text-sm font-semibold">
          {store === "ios" ? "App Store" : "Google Play"}
        </span>
      </span>
    </a>
  );
}

// ---------------------------------------------------------------------------
// 2) LIVE DEMO — calls /api/public/demo/ask
// ---------------------------------------------------------------------------
function LiveDemo() {
  const SUGGESTIONS = [
    "What does the Bible say about worry?",
    "Where is God when I feel alone?",
    "What does Jesus say about rest?",
  ];
  const [q, setQ] = useState(SUGGESTIONS[0]);
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [citations, setCitations] = useState<
    { book: string; chapter: number; verse: number }[]
  >([]);
  const [err, setErr] = useState<string | null>(null);

  async function ask() {
    setLoading(true);
    setErr(null);
    setAnswer(null);
    setCitations([]);
    try {
      const res = await fetch("/api/public/demo/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Something went wrong.");
      setAnswer(data.answer);
      setCitations(data.citations ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      id="demo"
      className="border-y bg-muted/30 px-6 py-16"
      aria-labelledby="demo-heading"
    >
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="space-y-2 text-center">
          <p className="text-xs uppercase tracking-wider text-primary">
            See it for yourself
          </p>
          <h2 id="demo-heading" className="text-2xl font-semibold md:text-3xl">
            Ask a real question. Get a real answer.
          </h2>
          <p className="text-sm text-muted-foreground">
            Every answer quotes only verses we actually retrieved — with the
            reference attached.
          </p>
        </div>

        <div className="rounded-lg border bg-background p-4 shadow-sm">
          <label htmlFor="demo-q" className="sr-only">
            Your question
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="demo-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="What does the Bible say about…"
              className="h-11 flex-1 rounded-md border border-input bg-background px-3 text-sm"
            />
            <button
              onClick={ask}
              disabled={loading || q.trim().length < 3}
              className="h-11 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
            >
              {loading ? "Searching…" : "Ask"}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setQ(s)}
                className="rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground hover:bg-accent"
              >
                {s}
              </button>
            ))}
          </div>

          {answer && (
            <div className="mt-4 space-y-3 border-t pt-4">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {answer}
              </p>
              {citations.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {citations.map((c) => (
                    <span
                      key={`${c.book}-${c.chapter}-${c.verse}`}
                      className="rounded-full border bg-muted px-2 py-0.5 text-xs"
                    >
                      {c.book} {c.chapter}:{c.verse}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          {err && (
            <p className="mt-4 border-t pt-4 text-sm text-destructive">{err}</p>
          )}
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Limited to a few questions per visitor — install the app for unlimited use.
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 3) SOCIAL PROOF
// ---------------------------------------------------------------------------
function SocialProof() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-12 text-center">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        Used by people who care about getting it right
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
        {/* Real ratings & logos appear here once they exist. */}
        <span className="italic">Star rating — coming soon</span>
        <span className="italic">Install count — coming soon</span>
        <span className="italic">Partner churches — coming soon</span>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 4) DIFFERENTIATOR
// ---------------------------------------------------------------------------
function Differentiator() {
  const cards = [
    {
      title: "Never invents Scripture",
      body: "Every AI answer is grounded in verses we actually retrieve — and every reference is linked back to the text.",
    },
    {
      title: "Knows your tradition",
      body: "From Catholic to Orthodox to Baptist to non-denominational, your tradition shapes how things are framed.",
    },
    {
      title: "Real people, not just a bot",
      body: "Join a group, share a prayer request, follow a plan together. The app helps you show up for each other.",
    },
  ];
  return (
    <section className="bg-muted/30 px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-10 text-center text-2xl font-semibold md:text-3xl">
          Why this one is different
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {cards.map((c) => (
            <article key={c.title} className="rounded-lg border bg-background p-6">
              <h3 className="text-base font-semibold">{c.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{c.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 5) HOW IT WORKS
// ---------------------------------------------------------------------------
function HowItWorks() {
  const steps = [
    { n: "1", title: "Pick your tradition & goal", body: "A 60-second setup tailors the app to you." },
    { n: "2", title: "Get a daily plan", body: "A short reading, a reflection, and a prayer. 5 minutes." },
    { n: "3", title: "Grow with your group", body: "Pray with your church, family, or small group." },
  ];
  return (
    <section id="how" className="mx-auto max-w-6xl px-6 py-16">
      <h2 className="mb-10 text-center text-2xl font-semibold md:text-3xl">
        How it works
      </h2>
      <ol className="grid gap-6 md:grid-cols-3">
        {steps.map((s) => (
          <li key={s.n} className="rounded-lg border p-6">
            <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {s.n}
            </div>
            <h3 className="text-base font-semibold">{s.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 6) PRICING TRANSPARENCY
// ---------------------------------------------------------------------------
function Pricing() {
  return (
    <section id="pricing" className="bg-muted/30 px-6 py-16">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="text-center">
          <h2 className="text-2xl font-semibold md:text-3xl">
            The Bible is free. Always.
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Reading, search, the daily verse, and community are free forever.
            Companion unlocks deeper study & group tools.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <article className="rounded-lg border bg-background p-6">
            <h3 className="text-lg font-semibold">Free</h3>
            <p className="text-sm text-muted-foreground">Forever, no card.</p>
            <ul className="mt-4 space-y-1 text-sm">
              <li>· Full Bible & translations</li>
              <li>· Search, daily verse, widget</li>
              <li>· One reading plan</li>
              <li>· Groups & prayer requests</li>
              <li>· A daily allowance of AI study</li>
            </ul>
          </article>
          <article className="rounded-lg border-2 border-primary bg-background p-6">
            <h3 className="text-lg font-semibold">Companion</h3>
            <p className="text-sm text-muted-foreground">
              $4.99/mo or $39.99/yr · 14-day free trial · no weekly tier
            </p>
            <ul className="mt-4 space-y-1 text-sm">
              <li>· Unlimited AI study sessions</li>
              <li>· Multiple plans & saved study notes</li>
              <li>· Group leader tools</li>
              <li>· Early access to new translations</li>
            </ul>
          </article>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Cancel anytime. No dark patterns. We never sell your data.
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 7) FAQ
// ---------------------------------------------------------------------------
function FAQ() {
  const items = [
    {
      q: "Is the Bible free?",
      a: "Yes — always. Reading, translations, search, the daily verse, the widget, joining groups, and prayer requests are free forever. We don't lock Scripture behind a subscription.",
    },
    {
      q: "Can I turn the AI off?",
      a: "Yes, fully. The app is designed to be a complete experience without it. Toggle it off in Settings and you'll get a curated devotional path instead.",
    },
    {
      q: "How do you keep it accurate?",
      a: "Every AI answer is retrieval-grounded. We search Scripture first, hand only those verses to the model, and a server-side guardrail strips any reference the model invents.",
    },
    {
      q: "Which translations are supported?",
      a: "We start with public-domain translations (e.g. World English Bible) and add more as licensing allows. You can switch translations any time.",
    },
    {
      q: "Can my church use it?",
      a: "Yes. Anyone can create a group with a join code; pastors and leaders can run a shared reading plan and see opt-in progress. Group leader tools are part of Companion.",
    },
  ];
  return (
    <section className="mx-auto max-w-3xl px-6 py-16">
      <h2 className="mb-8 text-center text-2xl font-semibold md:text-3xl">
        Honest answers to honest questions
      </h2>
      <dl className="space-y-3">
        {items.map((it) => (
          <details
            key={it.q}
            className="group rounded-lg border bg-background p-4 open:bg-muted/30"
          >
            <summary className="cursor-pointer list-none text-sm font-medium">
              <span className="mr-2 text-muted-foreground group-open:hidden">+</span>
              <span className="mr-2 hidden text-muted-foreground group-open:inline">−</span>
              {it.q}
            </summary>
            <p className="mt-2 text-sm text-muted-foreground">{it.a}</p>
          </details>
        ))}
      </dl>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 8) FINAL CTA
// ---------------------------------------------------------------------------
function FinalCta() {
  return (
    <section className="bg-primary/5 px-6 py-16 text-center">
      <div className="mx-auto max-w-2xl space-y-5">
        <h2 className="text-2xl font-semibold md:text-3xl">
          Five minutes a day. A real difference.
        </h2>
        <p className="text-sm text-muted-foreground">
          Start today — your tradition, your pace, your people.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <StoreBadge store="ios" />
          <StoreBadge store="android" />
        </div>
        <Link
          to="/auth"
          className="inline-block text-sm text-muted-foreground underline hover:text-foreground"
        >
          Or open it in your browser
        </Link>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t px-6 py-8 text-center text-xs text-muted-foreground">
      <p>© {new Date().getFullYear()} Discipleship Companion. Built carefully.</p>
    </footer>
  );
}
