import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Icon } from "../icon";

/**
 * Small status/metadata tag: citation chips, streak/level pills, premium tags.
 */
export const chipVariants = cva(
  "inline-flex items-center gap-1 rounded-md font-semibold leading-none",
  {
    variants: {
      tone: {
        neutral: "bg-surface-container text-on-surface-variant",
        accent: "bg-secondary-container text-on-secondary-container",
        info: "bg-crisis-blue text-primary",
        ink: "bg-primary text-on-primary",
        outline: "border border-divider-soft text-on-surface-variant",
      },
      size: {
        sm: "px-2 py-0.5 text-xs",
        md: "px-2.5 py-1 text-xs",
      },
    },
    defaultVariants: { tone: "neutral", size: "md" },
  },
);

type ChipProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof chipVariants> & {
    icon?: string;
    iconFilled?: boolean;
  };

export function Chip({
  className,
  tone,
  size,
  icon,
  iconFilled,
  children,
  ...rest
}: ChipProps) {
  return (
    <span className={cn(chipVariants({ tone, size }), className)} {...rest}>
      {icon && <Icon name={icon} filled={iconFilled} className="text-[1.1em]" />}
      {children}
    </span>
  );
}
