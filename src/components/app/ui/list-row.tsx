import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "../icon";

/**
 * A consistent tappable list row: leading slot, title/subtitle, trailing slot.
 * Presentational — wrap in a Link or <button> for interactivity.
 */
export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  interactive = true,
  className,
}: {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  interactive?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-divider-soft bg-card p-4 transition-gentle",
        interactive && "hover:border-wood-warm",
        className,
      )}
    >
      {leading}
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold text-primary">{title}</div>
        {subtitle && (
          <div className="truncate text-sm text-on-surface-variant">{subtitle}</div>
        )}
      </div>
      {trailing ?? (
        interactive && (
          <Icon name="chevron_right" className="shrink-0 text-outline" />
        )
      )}
    </div>
  );
}
