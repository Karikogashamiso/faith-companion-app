import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Icon } from "@/components/app/icon";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Faith Companion — Bible, daily habit, real community" },
      {
        name: "description",
        content:
          "Understand the Bible, build a daily habit, and never feel alone in it. Answers grounded in real Scripture — it never makes things up.",
      },
      { property: "og:title", content: "Faith Companion" },
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
          name: "Faith Companion",
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
    <div className="min-h-screen bg-scripture-cream text-on-surface">
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
    <header className="sticky top-0 z-30 border-b border-divider-soft bg-scripture-cream/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-margin-mobile py-3">
        <Link to="/" className="flex items-center gap-2">
          <Icon name="menu_book" className="text-2xl text-primary" />
          <span className="font-serif text-lg font-bold tracking-tight text-primary">
            Faith Companion
          </span>
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <a
            href="#how"
            className="hidden text-on-surface-variant hover:text-primary sm:inline"
          >
            How it works
          </a>
          <a
            href="#pricing"
            className="hidden text-on-surface-variant hover:text-primary sm:inline"
          >
            Pricing
          </a>
          <Link
            to="/auth"
            className="rounded-lg bg-primary px-4 py-2 font-semibold text-on-primary transition-colors hover:bg-navy-deep"
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
    <section className="mx-auto grid max-w-6xl items-center gap-stack-lg px-margin-mobile py-16 md:grid-cols-2 md:py-24">
      <div className="peaceful-fade-in space-y-stack-md">
        <div className="inline-flex items-center gap-2 rounded-full border border-divider-soft bg-crisis-blue px-3 py-1">
          <Icon name="auto_awesome" filled className="text-base text-primary" />
          <span className="text-xs font-bold uppercase tracking-widest text-primary">
            Historic Orthodoxy
          </span>
        </div>
        <h1 className="font-serif text-4xl font-bold leading-tight tracking-tight text-primary md:text-4xl">
          Understand the Bible.
          <br />
          Build the habit.
          <br />
          Never alone.
        </h1>
        <p className="max-w-md text-lg leading-relaxed text-on-surface-variant">
          Answers grounded in real Scripture — it never makes things up.
        </p>
        <div className="flex flex-wrap gap-3" aria-label="Install the app">
          <StoreBadge store="ios" />
          <StoreBadge store="android" />
        </div>
        <p className="text-sm text-on-surface-variant">
          Or{" "}
          <Link to="/auth" className="font-semibold text-primary underline">
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
      className="peaceful-fade-in mx-auto w-full max-w-[300px]"
    >
      <div className="relative aspect-[9/19] rounded-[2.5rem] border-8 border-primary bg-scripture-cream shadow-2xl">
        <div className="absolute inset-x-12 top-2 h-4 rounded-b-xl bg-primary" />
        <div className="absolute inset-3 flex flex-col gap-3 overflow-hidden rounded-[2rem] bg-primary p-5 text-primary-foreground">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-on-primary-container">
            Today · Day 3
          </p>
          <div className="flex justify-center pt-2">
            <Icon
              name="format_quote"
              className="text-2xl text-on-primary-container opacity-50"
            />
          </div>
          <p className="text-center font-serif text-base italic leading-snug">
            “Be still, and know that I am God.”
          </p>
          <p className="text-center text-[11px] font-semibold uppercase tracking-widest text-on-primary-container">
            Psalm 46:10
          </p>
          <div className="mt-2 space-y-1 rounded-lg bg-scripture-cream/95 p-3 text-[11px] text-on-surface">
            <p className="font-semibold text-primary">Ask</p>
            <p className="text-on-surface-variant">
              What does the Bible say about worry?
            </p>
          </div>
          <div className="mt-auto flex gap-1.5">
            <span className="rounded-lg bg-crisis-blue px-2 py-0.5 text-[9px] font-bold text-primary">
              Phil 4:6
            </span>
            <span className="rounded-lg bg-crisis-blue px-2 py-0.5 text-[9px] font-bold text-primary">
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
      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-primary-foreground transition-colors hover:bg-navy-deep"
    >
      <Icon name={store === "ios" ? "smartphone" : "play_arrow"} filled />
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
      className="border-y border-divider-soft bg-surface-container-low px-margin-mobile py-16"
      aria-labelledby="demo-heading"
    >
      <div className="mx-auto max-w-3xl space-y-stack-md">
        <div className="space-y-2 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-wood-warm">
            See it for yourself
          </p>
          <h2
            id="demo-heading"
            className="font-serif text-3xl text-primary md:text-3xl"
          >
            Ask a real question. Get a real answer.
          </h2>
          <p className="text-on-surface-variant">
            Every answer quotes only verses we actually retrieved — with the
            reference attached.
          </p>
        </div>

        <div className="rounded-xl border border-divider-soft bg-card p-5 shadow-sm">
          <label htmlFor="demo-q" className="sr-only">
            Your question
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="demo-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="What does the Bible say about…"
              className="h-12 flex-1 rounded-lg border border-divider-soft bg-scripture-cream px-4 text-sm focus:border-primary focus:outline-none"
            />
            <button
              onClick={ask}
              disabled={loading || q.trim().length < 3}
              className="flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-on-primary transition-colors hover:bg-navy-deep disabled:opacity-40"
            >
              {loading ? (
                <Icon name="progress_activity" className="animate-spin" />
              ) : (
                <Icon name="search" />
              )}
              {loading ? "Searching…" : "Ask"}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setQ(s)}
                className="rounded-lg border border-divider-soft bg-scripture-cream px-3 py-1.5 text-xs text-on-surface-variant transition-colors hover:border-wood-warm hover:text-primary"
              >
                {s}
              </button>
            ))}
          </div>

          {answer && (
            <div className="mt-4 space-y-3 border-t border-divider-soft pt-4">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-on-surface">
                {answer}
              </p>
              {citations.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {citations.map((c) => (
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
            </div>
          )}
          {err && (
            <p className="mt-4 border-t border-divider-soft pt-4 text-sm text-destructive">
              {err}
            </p>
          )}
        </div>
        <p className="text-center text-xs text-on-surface-variant">
          Limited to a few questions per visitor — install the app for unlimited
          use.
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
    <section className="mx-auto max-w-6xl px-margin-mobile py-12 text-center">
      <p className="text-xs font-bold uppercase tracking-widest text-wood-warm">
        Built for people who care about getting it right
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-6 text-sm text-on-surface-variant">
        <span className="flex items-center gap-1.5">
          <Icon name="verified" filled className="text-base text-wood-warm" />
          Citation-locked AI
        </span>
        <span className="flex items-center gap-1.5">
          <Icon name="public" filled className="text-base text-wood-warm" />
          Public-domain text
        </span>
        <span className="flex items-center gap-1.5">
          <Icon name="lock" filled className="text-base text-wood-warm" />
          No data sold, ever
        </span>
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
      icon: "verified",
      title: "Never invents Scripture",
      body: "Every AI answer is grounded in verses we actually retrieve — and every reference is linked back to the text.",
    },
    {
      icon: "diversity_3",
      title: "Knows your tradition",
      body: "From Catholic to Orthodox to Baptist to non-denominational, your tradition shapes how things are framed.",
    },
    {
      icon: "groups",
      title: "Real people, not just a bot",
      body: "Join a group, share a prayer request, follow a plan together. The app helps you show up for each other.",
    },
  ];
  return (
    <section className="bg-surface-container-low px-margin-mobile py-16">
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-10 text-center font-serif text-3xl text-primary md:text-3xl">
          Why this one is different
        </h2>
        <div className="grid gap-gutter md:grid-cols-3">
          {cards.map((c) => (
            <article
              key={c.title}
              className="rounded-xl border border-divider-soft bg-card p-6"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-crisis-blue text-primary">
                <Icon name={c.icon} />
              </div>
              <h3 className="mt-4 font-serif text-xl text-primary">{c.title}</h3>
              <p className="mt-2 text-on-surface-variant">{c.body}</p>
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
    {
      n: "1",
      title: "Pick your tradition & goal",
      body: "A 60-second setup tailors the app to you.",
    },
    {
      n: "2",
      title: "Get a daily plan",
      body: "A short reading, a reflection, and a prayer. 5 minutes.",
    },
    {
      n: "3",
      title: "Grow with your group",
      body: "Pray with your church, family, or small group.",
    },
  ];
  return (
    <section id="how" className="mx-auto max-w-6xl px-margin-mobile py-16">
      <h2 className="mb-10 text-center font-serif text-3xl text-primary md:text-3xl">
        How it works
      </h2>
      <ol className="grid gap-gutter md:grid-cols-3">
        {steps.map((s) => (
          <li
            key={s.n}
            className="rounded-xl border border-divider-soft bg-card p-6"
          >
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-primary font-serif text-sm font-semibold text-on-primary">
              {s.n}
            </div>
            <h3 className="font-serif text-xl text-primary">{s.title}</h3>
            <p className="mt-1 text-on-surface-variant">{s.body}</p>
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
    <section
      id="pricing"
      className="bg-surface-container-low px-margin-mobile py-16"
    >
      <div className="mx-auto max-w-4xl space-y-stack-lg">
        <div className="text-center">
          <h2 className="font-serif text-3xl text-primary md:text-3xl">
            The Bible is free. Always.
          </h2>
          <p className="mt-2 text-on-surface-variant">
            Reading, search, the daily verse, and community are free forever.
            Companion unlocks deeper study & group tools.
          </p>
        </div>
        <div className="grid gap-gutter md:grid-cols-2">
          <article className="rounded-xl border border-divider-soft bg-card p-6">
            <h3 className="font-serif text-2xl text-primary">Free</h3>
            <p className="text-sm text-on-surface-variant">Forever, no card.</p>
            <ul className="mt-4 space-y-2 text-sm">
              {[
                "Full Bible & translations",
                "Search, daily verse, widget",
                "One reading plan",
                "Groups & prayer requests",
                "A daily allowance of AI study",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2 text-on-surface">
                  <Icon
                    name="check_circle"
                    filled
                    className="text-base text-wood-warm"
                  />
                  {f}
                </li>
              ))}
            </ul>
          </article>
          <article className="rounded-xl border-2 border-primary bg-card p-6">
            <h3 className="font-serif text-2xl text-primary">Companion</h3>
            <p className="text-sm text-on-surface-variant">
              $4.99/mo or $39.99/yr · 14-day free trial · no weekly tier
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              {[
                "Unlimited AI study sessions",
                "Multiple plans & saved study notes",
                "Group leader tools",
                "Early access to new translations",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2 text-on-surface">
                  <Icon
                    name="check_circle"
                    filled
                    className="text-base text-primary"
                  />
                  {f}
                </li>
              ))}
            </ul>
          </article>
        </div>
        <p className="text-center text-xs text-on-surface-variant">
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
    <section className="mx-auto max-w-3xl px-margin-mobile py-16">
      <h2 className="mb-8 text-center font-serif text-3xl text-primary md:text-3xl">
        Honest answers to honest questions
      </h2>
      <dl className="space-y-3">
        {items.map((it) => (
          <details
            key={it.q}
            className="group rounded-xl border border-divider-soft bg-card p-4 open:bg-surface-container-low"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-semibold text-primary">
              {it.q}
              <Icon
                name="add"
                className="text-on-surface-variant transition-transform group-open:rotate-45"
              />
            </summary>
            <p className="mt-2 text-sm text-on-surface-variant">{it.a}</p>
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
    <section className="border-t border-divider-soft bg-surface-container-low px-margin-mobile py-16 text-center">
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="flex justify-center">
          <Icon
            name="format_quote"
            className="text-3xl text-on-surface-variant opacity-30"
          />
        </div>
        <p className="mx-auto max-w-md font-serif text-xl italic leading-8 text-on-surface-variant">
          “Thy word is a lamp unto my feet, and a light unto my path.”
        </p>
        <h2 className="font-serif text-3xl text-primary md:text-3xl">
          Five minutes a day. A real difference.
        </h2>
        <p className="text-on-surface-variant">
          Start today — your tradition, your pace, your people.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <StoreBadge store="ios" />
          <StoreBadge store="android" />
        </div>
        <Link
          to="/auth"
          className="inline-block text-sm font-semibold text-primary underline"
        >
          Or open it in your browser
        </Link>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-divider-soft bg-scripture-cream px-margin-mobile py-8 text-center text-xs text-on-surface-variant">
      <p>© {new Date().getFullYear()} Faith Companion. Built carefully.</p>
    </footer>
  );
}
