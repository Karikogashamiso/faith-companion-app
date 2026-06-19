import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/app/icon";
import { trackLanding } from "@/lib/landing-analytics";
import sunsetUrl from "@/assets/sunset.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Faith Companion — Understand the Bible. Build the habit. Never alone." },
      {
        name: "description",
        content:
          "A Bible study companion that never invents Scripture. Citation-locked AI, daily plans, guided audio, real community, and gentle reminders — across web, iOS, and Android. Reading is free, forever.",
      },
      { property: "og:title", content: "Faith Companion" },
      {
        property: "og:description",
        content:
          "Understand the Bible. Build the habit. Never alone. Answers grounded in real Scripture — it never makes things up.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
      { name: "twitter:card", content: "summary_large_image" },
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
          operatingSystem: "iOS, Android, Web",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          description:
            "A grounded Bible study companion with daily habit, guided audio, community, and citation-locked AI.",
        }),
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  useEffect(() => {
    trackLanding("landing_view");
  }, []);
  return (
    <div className="min-h-screen bg-background text-on-surface">
      <SiteNav />
      <main>
        <Hero />
        <TrustStrip />
        <DenominationsMarquee />
        <LiveDemo />
        <SpotlightAI />
        <SpotlightCommunity />
        <SpotlightHabit />
        <FeatureGrid />
        <HowItWorks />
        <LifeScenarios />
        <Pricing />
        <FAQ />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Motion helpers
// ---------------------------------------------------------------------------
/** Reveals its children with a soft upward fade when scrolled into view. */
function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${visible ? "is-visible" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/** A slow, hover-pausing marquee of the traditions the app serves. */
function DenominationsMarquee() {
  const traditions = [
    "Catholic",
    "Orthodox",
    "Anglican",
    "Lutheran",
    "Reformed",
    "Baptist",
    "Methodist",
    "Pentecostal",
    "Non-denominational",
    "Just exploring",
  ];
  const row = [...traditions, ...traditions];
  return (
    <section className="border-b border-divider-soft bg-background py-6">
      <p className="mb-4 text-center text-xs font-bold uppercase tracking-widest text-on-surface-variant">
        Made for every tradition
      </p>
      <div className="marquee">
        <div className="marquee__track gap-3 pr-3">
          {row.map((t, i) => (
            <span
              key={`${t}-${i}`}
              className="flex items-center gap-1.5 rounded-full border border-divider-soft bg-card px-4 py-1.5 text-sm text-on-surface-variant"
            >
              <Icon name="church" className="text-base text-primary" />
              {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------
function PrimaryCta({
  children,
  className = "",
  location = "generic",
}: {
  children: React.ReactNode;
  className?: string;
  location?: string;
}) {
  return (
    <Link
      to="/auth"
      onClick={() => trackLanding("cta_click", { location })}
      className={`btn-shine candle-glow inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 font-semibold text-on-primary transition-transform hover:scale-[1.03] active:scale-[0.99] ${className}`}
    >
      {children}
    </Link>
  );
}

function StoreBadge({ store, location = "hero" }: { store: "ios" | "android"; location?: string }) {
  // Real badges link to the live store listings; until those exist we land users in the web app.
  const label = store === "ios" ? "Download on the App Store" : "Get it on Google Play";
  return (
    <a
      href="/auth"
      aria-label={label}
      onClick={() => trackLanding("store_badge_click", { store, location })}
      className="inline-flex items-center gap-2 rounded-xl border border-divider-soft bg-card px-4 py-2.5 text-on-surface transition-colors hover:border-primary"
    >
      <Icon name={store === "ios" ? "smartphone" : "play_arrow"} filled className="text-2xl text-primary" />
      <span className="flex flex-col leading-tight">
        <span className="text-[9px] uppercase tracking-wider text-on-surface-variant">
          {store === "ios" ? "Download on the" : "Get it on"}
        </span>
        <span className="text-sm font-semibold">{store === "ios" ? "App Store" : "Google Play"}</span>
      </span>
    </a>
  );
}

// ---------------------------------------------------------------------------
// Nav
// ---------------------------------------------------------------------------
function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header
      className={`sticky top-0 z-30 border-b backdrop-blur-md transition-gentle ${
        scrolled
          ? "border-divider-soft bg-background/90 shadow-lg shadow-black/20"
          : "border-transparent bg-background/70"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-margin-mobile py-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-on-primary">
            <Icon name="menu_book" className="text-lg" />
          </span>
          <span className="font-serif text-lg font-bold tracking-tight text-primary">
            Faith Companion
          </span>
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <a href="#features" className="hidden text-on-surface-variant hover:text-primary sm:inline">
            Features
          </a>
          <a href="#how" className="hidden text-on-surface-variant hover:text-primary sm:inline">
            How it works
          </a>
          <a href="#pricing" className="hidden text-on-surface-variant hover:text-primary sm:inline">
            Pricing
          </a>
          <Link
            to="/auth"
            className="rounded-lg bg-primary px-4 py-2 font-semibold text-on-primary transition-colors hover:bg-primary-container"
          >
            Open the app
          </Link>
          <button
            type="button"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((o) => !o)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-primary hover:bg-surface-container sm:hidden"
          >
            <Icon name={mobileOpen ? "close" : "menu"} className="text-xl" />
          </button>
        </nav>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-divider-soft bg-background/95 px-margin-mobile py-2 sm:hidden">
          {[
            { href: "#features", label: "Features" },
            { href: "#how", label: "How it works" },
            { href: "#pricing", label: "Pricing" },
          ].map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setMobileOpen(false)}
              className="block py-2 text-on-surface-variant hover:text-primary"
            >
              {l.label}
            </a>
          ))}
        </div>
      )}
    </header>
  );
}

// ---------------------------------------------------------------------------
// 1) HERO
// ---------------------------------------------------------------------------
function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Breathing aurora + warm sunset glow, fading into the ink background. */}
      <div aria-hidden className="aurora" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 opacity-30"
        style={{
          backgroundImage: `url(${sunsetUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          maskImage: "linear-gradient(to bottom, black, transparent 75%)",
          WebkitMaskImage: "linear-gradient(to bottom, black, transparent 75%)",
        }}
      />
      <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-stack-lg px-margin-mobile py-16 md:grid-cols-2 md:py-24">
        <div className="peaceful-fade-in space-y-stack-md">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-card/70 px-3 py-1 backdrop-blur">
            <Icon name="verified" filled className="text-base text-primary" />
            <span className="text-xs font-bold uppercase tracking-widest text-primary">
              Citation-locked AI · Never invents Scripture
            </span>
          </div>
          <h1 className="font-serif text-4xl font-bold leading-tight tracking-tight text-primary md:text-5xl">
            Understand the Bible.
            <br />
            Build the habit.
            <br />
            <span className="shimmer-text">Never alone.</span>
          </h1>
          <p className="max-w-md text-lg leading-relaxed text-on-surface-variant">
            A daily reading, a grounded answer when you wonder, guided prayer when
            words run out, and people praying with you. Across web, iOS, and
            Android. <span className="text-primary">Scripture is free, forever.</span>
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <PrimaryCta location="hero" className="glow-breath">
              Start free
              <Icon name="arrow_forward" className="text-lg" />
            </PrimaryCta>
            <div className="flex gap-2" aria-label="Install the app">
              <StoreBadge store="ios" location="hero" />
              <StoreBadge store="android" location="hero" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-on-surface-variant">
            <span className="flex items-center gap-1.5">
              <Icon name="check_circle" filled className="text-base text-primary" />
              No credit card
            </span>
            <span className="flex items-center gap-1.5">
              <Icon name="lock" filled className="text-base text-primary" />
              Private by design
            </span>
            <span className="flex items-center gap-1.5">
              <Icon name="public" filled className="text-base text-primary" />
              8 translations
            </span>
          </div>
        </div>
        <PhoneMockup />
      </div>
    </section>
  );
}

function PhoneMockup() {
  return (
    <div
      role="img"
      aria-label="Phone preview showing a daily verse and a tappable AI question"
      className="peaceful-fade-in float-soft mx-auto w-full max-w-[300px]"
    >
      <div className="candle-glow relative aspect-[9/19] rounded-[2.5rem] border-8 border-surface-container-high bg-background shadow-2xl">
        <div className="absolute inset-x-12 top-2 h-4 rounded-b-xl bg-surface-container-high" />
        <div className="absolute inset-3 flex flex-col gap-3 overflow-hidden rounded-[2rem] bg-surface-container-low p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">
            Today · 12-day streak 🔥
          </p>
          <div className="rounded-xl bg-card p-4">
            <div className="flex justify-center">
              <Icon name="format_quote" className="text-2xl text-primary opacity-50" />
            </div>
            <p className="text-center font-serif text-base italic leading-snug text-on-surface">
              “Be still, and know that I am God.”
            </p>
            <p className="mt-1 text-center text-[11px] font-semibold uppercase tracking-widest text-primary">
              Psalm 46:10
            </p>
          </div>
          <div className="space-y-1 rounded-xl bg-card p-3 text-[11px]">
            <p className="font-semibold text-primary">You asked</p>
            <p className="text-on-surface-variant">What does the Bible say about worry?</p>
          </div>
          <div className="mt-auto flex flex-wrap gap-1.5">
            <span className="flex items-center gap-1 rounded-lg bg-secondary-container px-2 py-0.5 text-[9px] font-bold text-on-secondary-container">
              <Icon name="verified" filled className="text-[11px]" /> Phil 4:6
            </span>
            <span className="flex items-center gap-1 rounded-lg bg-secondary-container px-2 py-0.5 text-[9px] font-bold text-on-secondary-container">
              <Icon name="verified" filled className="text-[11px]" /> Matt 6:34
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2) TRUST STRIP
// ---------------------------------------------------------------------------
function TrustStrip() {
  const items = [
    { icon: "verified", label: "Citation-locked AI" },
    { icon: "headphones", label: "Guided audio & prayer" },
    { icon: "groups", label: "Real community" },
    { icon: "verified_user", label: "Never sells your data" },
  ];
  return (
    <section className="border-y border-divider-soft bg-surface-container-low">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-margin-mobile py-6">
        {items.map((it) => (
          <span key={it.label} className="flex items-center gap-2 text-sm font-medium text-on-surface-variant">
            <Icon name={it.icon} filled className="text-lg text-primary" />
            {it.label}
          </span>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 3) LIVE DEMO — calls /api/public/demo/ask
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
  const [citations, setCitations] = useState<{ book: string; chapter: number; verse: number }[]>([]);
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
      trackLanding("demo_ask");
      setAnswer(data.answer);
      setCitations(data.citations ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="demo" className="px-margin-mobile py-16" aria-labelledby="demo-heading">
      <div className="mx-auto max-w-3xl space-y-stack-md">
        <Reveal className="space-y-2 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">Try it right now — free</p>
          <h2 id="demo-heading" className="font-serif text-3xl text-primary md:text-4xl">
            Ask a real question. Get a real answer.
          </h2>
          <p className="mx-auto max-w-xl text-on-surface-variant">
            Every answer quotes only verses we actually retrieved — with the
            reference attached. If the model tries to invent one, we strip it.
          </p>
        </Reveal>

        <Reveal delay={80} className="glass-card rounded-2xl p-5 md:p-6">
          <label htmlFor="demo-q" className="sr-only">
            Your question
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="demo-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="What does the Bible say about…"
              className="h-12 flex-1 rounded-lg border border-divider-soft bg-background px-4 text-sm focus:border-primary focus:outline-none"
            />
            <button
              onClick={ask}
              disabled={loading || q.trim().length < 3}
              className="flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-container disabled:opacity-40"
            >
              {loading ? <Icon name="progress_activity" className="animate-spin" /> : <Icon name="auto_awesome" />}
              {loading ? "Searching…" : "Ask"}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setQ(s)}
                className="rounded-lg border border-divider-soft bg-background px-3 py-1.5 text-xs text-on-surface-variant transition-colors hover:border-primary hover:text-primary"
              >
                {s}
              </button>
            ))}
          </div>

          {answer && (
            <div className="mt-4 space-y-3 border-t border-divider-soft pt-4">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-on-surface">{answer}</p>
              {citations.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {citations.map((c) => (
                    <span
                      key={`${c.book}-${c.chapter}-${c.verse}`}
                      className="flex items-center gap-1 rounded-lg bg-secondary-container px-2.5 py-1 text-xs font-bold text-on-secondary-container"
                    >
                      <Icon name="verified" filled className="text-sm" />
                      {c.book} {c.chapter}:{c.verse}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          {err && <p className="mt-4 border-t border-divider-soft pt-4 text-sm text-destructive">{err}</p>}
        </Reveal>
        <p className="text-center text-xs text-on-surface-variant">
          A few free questions per visitor · unlimited in the app.
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Spotlight (alternating 2-column feature highlights)
// ---------------------------------------------------------------------------
function Spotlight({
  eyebrow,
  title,
  body,
  bullets,
  icon,
  flip,
  tone = "default",
}: {
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
  icon: string;
  flip?: boolean;
  tone?: "default" | "muted";
}) {
  return (
    <section className={tone === "muted" ? "bg-surface-container-low px-margin-mobile py-16" : "px-margin-mobile py-16"}>
      <div className="mx-auto grid max-w-6xl items-center gap-stack-lg md:grid-cols-2">
        <Reveal className={flip ? "md:order-2" : ""}>
          <p className="text-xs font-bold uppercase tracking-widest text-primary">{eyebrow}</p>
          <h2 className="mt-2 font-serif text-3xl text-primary md:text-4xl">{title}</h2>
          <p className="mt-3 text-on-surface-variant">{body}</p>
          <ul className="mt-5 space-y-2.5">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-2.5 text-on-surface">
                <Icon name="check_circle" filled className="mt-0.5 text-lg text-primary" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={120} className={flip ? "md:order-1" : ""}>
          <div className="glass-card lift-card group flex aspect-[4/3] items-center justify-center rounded-2xl">
            <Icon
              name={icon}
              className="text-7xl text-primary opacity-80 transition-transform duration-500 group-hover:scale-110"
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function SpotlightAI() {
  return (
    <Spotlight
      eyebrow="Study you can trust"
      title="A companion that never makes things up"
      body="Most AI guesses. Ours searches Scripture first, hands the model only those verses, then a server-side guardrail strips any reference it tries to invent — so you can actually trust the answer."
      bullets={[
        "Every reply linked to the verses behind it",
        "Tuned to your tradition — Catholic, Orthodox, Protestant & more",
        "Gentle, real-help responses for hard moments",
      ]}
      icon="verified"
    />
  );
}

function SpotlightCommunity() {
  return (
    <Spotlight
      eyebrow="Never alone"
      title="Pray together, not just by yourself"
      body="Faith was never meant to be solo. Start a group with a join code, share a prayer request, and follow a reading plan with your church, family, or small group — plus a global wall where the whole community prays with you."
      bullets={[
        "Private groups with shared reading plans",
        "Prayer requests, ‘I prayed’ counts & testimonies",
        "A global prayer wall — post anonymously if you like",
      ]}
      icon="diversity_3"
      flip
      tone="muted"
    />
  );
}

function SpotlightHabit() {
  return (
    <Spotlight
      eyebrow="Show up daily"
      title="The habit that sticks — even when life is loud"
      body="A five-minute daily path, streaks that celebrate your consistency, and gentle reminders that reach you even when the app is closed. Plus guided audio for prayer, Scripture, and sleep when words run out."
      bullets={[
        "Daily verse, reflection & prayer in five minutes",
        "Streaks, levels & milestones that keep you going",
        "Closed-app reminders + guided audio library",
      ]}
      icon="self_improvement"
    />
  );
}

// ---------------------------------------------------------------------------
// FEATURE GRID
// ---------------------------------------------------------------------------
function FeatureGrid() {
  const features = [
    { icon: "auto_awesome", title: "Citation-locked AI study", body: "Ask anything; get answers grounded in real verses." },
    { icon: "menu_book", title: "Full Bible reader", body: "8 translations, highlights, and resume-where-you-left-off." },
    { icon: "search", title: "Keyword & meaning search", body: "Find verses by word — or by what they actually mean." },
    { icon: "headphones", title: "Guided audio", body: "Prayer, Scripture & sleep sessions for every moment." },
    { icon: "calendar_month", title: "Reading plans", body: "Short, structured paths — alone or with your group." },
    { icon: "groups", title: "Groups & prayer", body: "Join codes, requests, testimonies, and a global wall." },
    { icon: "notifications_active", title: "Gentle reminders", body: "Verse & prayer nudges, even when the app is closed." },
    { icon: "psychology", title: "Verse memorization", body: "Spaced-repetition review that makes verses stick." },
    { icon: "local_fire_department", title: "Streaks & milestones", body: "Encouragement that turns intention into a habit." },
    { icon: "image", title: "Shareable verse art", body: "Turn a verse into a beautiful image in one tap." },
    { icon: "bookmark", title: "Bookmarks & journal", body: "Save verses into collections with your own notes." },
    { icon: "devices", title: "Web, iOS & Android", body: "Your place in Scripture, on every screen." },
  ];
  return (
    <section id="features" className="bg-surface-container-low px-margin-mobile py-20">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-serif text-3xl text-primary md:text-4xl">Everything in one quiet place</h2>
          <div className="gold-rule mx-auto mt-4 max-w-xs" />
          <p className="mt-4 text-on-surface-variant">
            A complete companion for the whole journey — not a dozen apps stitched together.
          </p>
        </Reveal>
        <div className="mt-12 grid gap-gutter sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 80}>
              <article className="lift-card group h-full rounded-2xl border border-divider-soft bg-card p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary-container text-on-secondary-container transition-transform duration-300 group-hover:scale-110">
                  <Icon name={f.icon} filled />
                </div>
                <h3 className="mt-4 font-serif text-lg text-primary">{f.title}</h3>
                <p className="mt-1 text-sm text-on-surface-variant">{f.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// HOW IT WORKS
// ---------------------------------------------------------------------------
function HowItWorks() {
  const steps = [
    { n: "1", icon: "tune", title: "Tell us about you", body: "A 60-second setup tailors the app to your tradition and goal." },
    { n: "2", icon: "wb_sunny", title: "Show up for five minutes", body: "A short reading, a reflection, a prayer — and ask anything." },
    { n: "3", icon: "favorite", title: "Grow with your people", body: "Pray with your church, family, or small group — together." },
  ];
  return (
    <section id="how" className="mx-auto max-w-6xl px-margin-mobile py-20">
      <h2 className="mb-12 text-center font-serif text-3xl text-primary md:text-4xl">How it works</h2>
      <ol className="grid gap-gutter md:grid-cols-3">
        {steps.map((s, i) => (
          <Reveal key={s.n} delay={i * 100}>
            <li className="lift-card relative h-full rounded-2xl border border-divider-soft bg-card p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary font-serif text-sm font-bold text-on-primary">
                  {s.n}
                </div>
                <Icon name={s.icon} className="text-2xl text-primary" />
              </div>
              <h3 className="mt-4 font-serif text-xl text-primary">{s.title}</h3>
              <p className="mt-1 text-on-surface-variant">{s.body}</p>
            </li>
          </Reveal>
        ))}
      </ol>
      <div className="mt-10 text-center">
        <PrimaryCta location="how">
          Begin your first day
          <Icon name="arrow_forward" className="text-lg" />
        </PrimaryCta>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// LIFE SCENARIOS (honest, benefit-driven — no fabricated reviews)
// ---------------------------------------------------------------------------
function LifeScenarios() {
  const cards = [
    {
      icon: "bedtime",
      when: "Anxious at 2 a.m.",
      then: "Ask what Scripture says about fear and hear a grounded answer — or press play on a calming guided prayer until sleep comes.",
    },
    {
      icon: "groups_2",
      when: "Leading a small group",
      then: "Start a private group, set a shared plan, and see who's keeping pace — without chasing anyone in a group chat.",
    },
    {
      icon: "spa",
      when: "New to all of this",
      then: "No assumed knowledge. A gentle daily path and an AI you can ask the ‘embarrassing’ questions — judgment-free.",
    },
  ];
  return (
    <section className="bg-surface-container-low px-margin-mobile py-20">
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-12 text-center font-serif text-3xl text-primary md:text-4xl">Made for real life</h2>
        <div className="grid gap-gutter md:grid-cols-3">
          {cards.map((c, i) => (
            <Reveal key={c.when} delay={i * 100}>
              <article className="glass-card lift-card h-full rounded-2xl p-6">
                <Icon name={c.icon} filled className="text-3xl text-primary" />
                <h3 className="mt-3 font-serif text-xl text-on-surface">{c.when}</h3>
                <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">{c.then}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// PRICING
// ---------------------------------------------------------------------------
function Pricing() {
  return (
    <section id="pricing" className="px-margin-mobile py-20">
      <div className="mx-auto max-w-4xl space-y-stack-lg">
        <div className="text-center">
          <h2 className="font-serif text-3xl text-primary md:text-4xl">The Bible is free. Always.</h2>
          <p className="mx-auto mt-3 max-w-xl text-on-surface-variant">
            Reading, search, the daily verse, groups, and prayer are free forever.
            Companion adds unlimited AI, the full audio library, and leader tools.
          </p>
        </div>
        <div className="grid gap-gutter md:grid-cols-2">
          <Reveal>
          <article className="lift-card h-full rounded-2xl border border-divider-soft bg-card p-6">
            <h3 className="font-serif text-2xl text-primary">Free</h3>
            <p className="text-sm text-on-surface-variant">Forever · no card</p>
            <p className="mt-3 font-serif text-3xl text-on-surface">$0</p>
            <ul className="mt-5 space-y-2 text-sm">
              {[
                "Full Bible & 8 translations",
                "Keyword & meaning search",
                "Daily verse, plans & widget",
                "Groups, prayer wall & reminders",
                "A daily allowance of AI study",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2 text-on-surface">
                  <Icon name="check_circle" filled className="text-base text-on-surface-variant" />
                  {f}
                </li>
              ))}
            </ul>
            <PrimaryCta location="pricing_free" className="mt-6 w-full">Start free</PrimaryCta>
          </article>
          </Reveal>
          <Reveal delay={100}>
          <article className="candle-glow lift-card relative h-full rounded-2xl border-2 border-primary bg-card p-6">
            <span className="absolute -top-3 right-5 rounded-full bg-primary px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-on-primary">
              7-day free trial
            </span>
            <h3 className="font-serif text-2xl text-primary">Companion</h3>
            <p className="text-sm text-on-surface-variant">$2.99/wk · $4.99/mo · $39.99/yr</p>
            <p className="mt-3 font-serif text-3xl text-on-surface">
              $39.99<span className="text-base text-on-surface-variant">/yr</span>
            </p>
            <ul className="mt-5 space-y-2 text-sm">
              {[
                "Unlimited AI study sessions",
                "Full guided audio library",
                "Multiple plans & saved study notes",
                "Group leader tools & scheduling",
                "Early access to new translations",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2 text-on-surface">
                  <Icon name="check_circle" filled className="text-base text-primary" />
                  {f}
                </li>
              ))}
            </ul>
            <PrimaryCta location="pricing_companion" className="mt-6 w-full">Try Companion free</PrimaryCta>
          </article>
          </Reveal>
        </div>
        <p className="text-center text-xs text-on-surface-variant">
          Shown in your local currency in-app · cancel anytime · no dark patterns · we never sell your data.
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// FAQ
// ---------------------------------------------------------------------------
function FAQ() {
  const items = [
    {
      q: "Is the Bible really free?",
      a: "Yes — always. Reading, 8 translations, search, the daily verse, the widget, groups, prayer requests, and reminders are free forever. We don't lock Scripture behind a subscription.",
    },
    {
      q: "How do you keep the AI accurate?",
      a: "Every AI answer is retrieval-grounded. We search Scripture first, hand only those verses to the model, and a server-side guardrail strips any reference the model invents. You can also turn the AI off entirely.",
    },
    {
      q: "Which translations are included?",
      a: "We start with public-domain translations (World English Bible, KJV, ASV, and more — eight in all) and add licensed ones as agreements allow. Switch any time.",
    },
    {
      q: "Is there an app for my phone?",
      a: "Yes — it runs on the web today, and native iOS and Android apps share the same account and progress. Reminders can reach you even when the app is closed.",
    },
    {
      q: "Can my church use it?",
      a: "Absolutely. Anyone can create a group with a join code; leaders can run a shared reading plan and see opt-in progress. Group leader tools are part of Companion.",
    },
    {
      q: "What about my privacy?",
      a: "Your reading, prayer, and AI history are yours. We never sell or share your data, and you can delete your account and everything in it at any time.",
    },
  ];
  return (
    <section className="mx-auto max-w-3xl px-margin-mobile py-20">
      <h2 className="mb-10 text-center font-serif text-3xl text-primary md:text-4xl">
        Honest answers to honest questions
      </h2>
      <dl className="space-y-3">
        {items.map((it, i) => (
          <Reveal key={it.q} delay={(i % 3) * 70}>
            <details className="group rounded-2xl border border-divider-soft bg-card p-5 transition-colors open:border-primary/40 hover:border-primary/40">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-semibold text-primary">
                {it.q}
                <Icon name="add" className="text-on-surface-variant transition-transform group-open:rotate-45" />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">{it.a}</p>
            </details>
          </Reveal>
        ))}
      </dl>
    </section>
  );
}

// ---------------------------------------------------------------------------
// FINAL CTA
// ---------------------------------------------------------------------------
function FinalCta() {
  return (
    <section className="relative overflow-hidden border-t border-divider-soft">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{
          backgroundImage: `url(${sunsetUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          maskImage: "linear-gradient(to top, black, transparent 80%)",
          WebkitMaskImage: "linear-gradient(to top, black, transparent 80%)",
        }}
      />
      <div className="relative mx-auto max-w-2xl space-y-6 px-margin-mobile py-20 text-center">
        <Icon name="format_quote" className="text-3xl text-primary opacity-40" />
        <p className="mx-auto max-w-md font-serif text-xl italic leading-8 text-on-surface-variant">
          “Thy word is a lamp unto my feet, and a light unto my path.”
        </p>
        <h2 className="font-serif text-3xl text-primary md:text-4xl">
          Five minutes a day. A real difference.
        </h2>
        <p className="text-on-surface-variant">Your tradition, your pace, your people. Start today — free.</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <PrimaryCta location="final">
            Start free
            <Icon name="arrow_forward" className="text-lg" />
          </PrimaryCta>
          <div className="flex gap-2">
            <StoreBadge store="ios" location="final" />
            <StoreBadge store="android" location="final" />
          </div>
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-divider-soft bg-background px-margin-mobile py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-on-primary">
            <Icon name="menu_book" className="text-base" />
          </span>
          <span className="font-serif font-bold text-primary">Faith Companion</span>
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-on-surface-variant">
          <a href="#features" className="hover:text-primary">Features</a>
          <a href="#pricing" className="hover:text-primary">Pricing</a>
          <a href="#how" className="hover:text-primary">How it works</a>
          <Link to="/auth" className="hover:text-primary">Open the app</Link>
        </nav>
        <p className="text-xs text-on-surface-variant">© {new Date().getFullYear()} Faith Companion</p>
      </div>
    </footer>
  );
}
