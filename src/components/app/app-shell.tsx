import { Link, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Icon } from "./icon";
import { ReminderScheduler } from "./reminder-scheduler";
import { cn } from "@/lib/utils";

type NavItem = {
  to: "/home" | "/bible" | "/saved" | "/wall";
  label: string;
  icon: string;
};

// Faith Companion bottom rail — Today / Library / Journal / Community.
const NAV: NavItem[] = [
  { to: "/home", label: "Today", icon: "auto_stories" },
  { to: "/bible", label: "Library", icon: "menu_book" },
  { to: "/saved", label: "Journal", icon: "edit_note" },
  { to: "/wall", label: "Community", icon: "groups" },
];

/**
 * The standard authenticated chrome: a glassy top app bar and a bottom
 * navigation rail in the Sanctuary / Faith Companion style. Content is
 * constrained to a 720px "reading width" column on larger screens. The
 * fixed candle-vignette warms the top of every page.
 */
export function AppShell({
  children,
  title,
  contentClassName,
  maxWidth = "max-w-[720px]",
}: {
  children: ReactNode;
  title?: string;
  contentClassName?: string;
  maxWidth?: string;
}) {
  return (
    <div className="relative min-h-screen bg-background text-on-surface">
      {/* Fixed candle-vignette wash — warm gold breath above the fold. */}
      <div className="pointer-events-none fixed inset-0 z-0 candle-vignette" />

      <ReminderScheduler />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-on-primary"
      >
        Skip to content
      </a>

      {/* Top app bar: menu · serif wordmark · avatar */}
      <header className="fixed top-0 z-50 w-full bg-background/80 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-[1100px] items-center justify-between px-5 md:px-16">
          <Link
            to="/home"
            aria-label="Menu"
            className="text-primary transition-opacity hover:opacity-80"
          >
            <Icon name="menu" />
          </Link>

          <h1 className="font-headline-md text-headline-md font-bold text-primary">
            {title ?? "Faith Companion"}
          </h1>

          <div className="flex items-center gap-2">
            <Link
              to="/search"
              aria-label="Search"
              className="hidden h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:text-primary sm:flex"
            >
              <Icon name="search" />
            </Link>
            <Link
              to="/profile"
              aria-label="Profile"
              className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-primary-container text-on-primary-container"
            >
              <Icon name="person" filled />
            </Link>
          </div>
        </div>
      </header>

      <main
        id="main-content"
        className={cn(
          "relative z-10 mx-auto w-full px-5 pb-32 pt-20 md:px-16",
          maxWidth,
          contentClassName,
        )}
      >
        {children}
      </main>

      <BottomNav />
    </div>
  );
}

function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav className="fixed bottom-0 left-0 z-50 flex w-full items-center justify-around rounded-t-xl border-t border-outline-variant bg-surface-container px-4 py-3 shadow-lg">
      {NAV.map((item) => {
        const active =
          pathname === item.to || pathname.startsWith(`${item.to}/`);
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "flex flex-col items-center justify-center rounded-full px-4 py-1 transition-all active:scale-90",
              active
                ? "bg-primary-container text-on-primary-container"
                : "text-on-surface-variant hover:text-primary",
            )}
          >
            <Icon name={item.icon} filled={active} />
            <span className="font-label-caps text-label-caps mt-0.5 uppercase">
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Wood-accent section header used across the authenticated screens. */
export function SectionHeading({
  children,
  trailing,
}: {
  children: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="font-serif text-2xl text-on-surface">{children}</h3>
      {trailing}
    </div>
  );
}
