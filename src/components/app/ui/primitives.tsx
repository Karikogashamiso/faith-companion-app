import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Icon } from "../icon";

/** Circular/rounded icon container used pervasively (list leads, headers). */
export const iconBadgeVariants = cva(
  "flex shrink-0 items-center justify-center",
  {
    variants: {
      tone: {
        neutral: "bg-surface-container text-primary",
        info: "bg-crisis-blue text-primary",
        ink: "bg-primary text-on-primary",
        accent: "bg-secondary-container text-on-secondary-container",
        wood: "bg-wood-warm text-on-primary",
      },
      size: {
        sm: "h-9 w-9 text-[1.1rem]",
        md: "h-11 w-11 text-[1.3rem]",
        lg: "h-12 w-12 text-[1.4rem]",
      },
      shape: { square: "rounded-lg", round: "rounded-full" },
    },
    defaultVariants: { tone: "neutral", size: "md", shape: "square" },
  },
);

export function IconBadge({
  name,
  filled,
  tone,
  size,
  shape,
  className,
}: {
  name: string;
  filled?: boolean;
  className?: string;
} & VariantProps<typeof iconBadgeVariants>) {
  return (
    <span className={cn(iconBadgeVariants({ tone, size, shape }), className)}>
      <Icon name={name} filled={filled} />
    </span>
  );
}

/** Token-based loading placeholder. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-surface-container-low",
        className,
      )}
    />
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-divider-soft", className)} />;
}

/** A circular initial avatar (community lists, prayer wall). */
export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary-container text-xs font-bold text-on-secondary-container",
        className,
      )}
    >
      {(name || "?").charAt(0).toUpperCase()}
    </span>
  );
}
