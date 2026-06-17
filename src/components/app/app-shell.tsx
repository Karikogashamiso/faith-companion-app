import { Link, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Icon } from "./icon";
import { cn } from "@/lib/utils";

type NavItem = {
  to: "/home" | "/bible" | "/listen" | "/groups" | "/settings";
  label: string;
  icon: string;
};

const NAV: NavItem[] = [
  { to: "/home", label: "Sanctuary", icon: "home" },
  { to: "/bible", label: "Bible", icon: "menu_book" },
  { to: "/listen", label: "Listen", icon: "headphones" },
  { to: "/groups", label: "Groups", icon: "group" },
  { to: "/settings", label: "Settings", icon: "settings" },
];

/**
 * The standard authenticated chrome: a glassy top app bar and a bottom
 * navigation rail, rendered in the Sanctuary Modern style. Content is
 * constrained to a 720px "reading width" column on larger screens.
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
    <div className="min-h-screen bg-scripture-cream text-on-surface">
      <header className="fixed top-0 z-50 w-full border-b border-divider-soft bg-scripture-cream/90 backdrop-blur-md">
        <div
          className={cn(
            "mx-auto flex h-16 w-full items-center justify-between px-margin-mobile",
            maxWidth,
          )}
        >
          <Link to="/home" className="flex items-center gap-2">
            <Icon name="menu_book" className="text-2xl text-primary" />
            <span className="font-serif text-lg font-bold tracking-tight text-primary">
              {title ?? "Discipleship Companion"}
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/search"
              aria-label="Search"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-primary transition-colors hover:bg-primary hover:text-on-primary"
            >
              <Icon name="search" />
            </Link>
            <Link
              to="/profile"
              aria-label="Your progress"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-container text-on-primary-container transition-colors hover:bg-primary hover:text-on-primary"
            >
              <Icon name="workspace_premium" />
            </Link>
          </div>
        </div>
      </header>

      <main
        className={cn(
          "mx-auto w-full px-margin-mobile pb-28 pt-24",
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
    <nav className="fixed bottom-0 left-0 z-50 flex h-16 w-full items-center justify-around border-t border-divider-soft bg-scripture-cream px-4">
      {NAV.map((item) => {
        const active =
          pathname === item.to || pathname.startsWith(`${item.to}/`);
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "flex flex-col items-center justify-center rounded-full px-4 py-1 transition-all",
              active
                ? "bg-secondary-container text-on-secondary-container"
                : "text-on-surface-variant hover:text-primary",
            )}
          >
            <Icon name={item.icon} filled={active} />
            <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide">
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
      <h3 className="font-serif text-2xl text-primary">{children}</h3>
      {trailing}
    </div>
  );
}
