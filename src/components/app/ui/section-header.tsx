import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Screen title: serif headline, optional wood eyebrow + trailing slot. */
export function ScreenTitle({
  title,
  subtitle,
  className,
}: {
  title: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <header className={cn("space-y-2", className)}>
      <h1 className="font-serif text-3xl text-primary">{title}</h1>
      {subtitle && <p className="text-on-surface-variant">{subtitle}</p>}
    </header>
  );
}

/** In-page section header with an optional eyebrow and trailing action. */
export function SectionHeader({
  children,
  eyebrow,
  trailing,
}: {
  children: ReactNode;
  eyebrow?: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-widest text-wood-warm">
            {eyebrow}
          </p>
        )}
        <h2 className="font-serif text-2xl text-primary">{children}</h2>
      </div>
      {trailing}
    </div>
  );
}
