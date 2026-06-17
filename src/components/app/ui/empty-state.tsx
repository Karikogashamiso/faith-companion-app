import type { ReactNode } from "react";
import { IconBadge } from "./primitives";

/** Calm, consistent empty/zero state — never a bare "No data". */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-divider-soft bg-card px-6 py-12 text-center">
      <IconBadge name={icon} tone="info" size="lg" shape="round" />
      <div className="space-y-1">
        <p className="font-serif text-xl text-primary">{title}</p>
        {description && (
          <p className="mx-auto max-w-xs text-sm text-on-surface-variant">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
