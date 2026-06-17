import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Surface container. Lifted just off the warm page with a 1px soft border and
 * a gentle shadow — the brief's "tonal layering, no harsh borders".
 */
export const cardVariants = cva("rounded-xl text-card-foreground transition-gentle", {
  variants: {
    tone: {
      base: "border border-divider-soft bg-card shadow-sm",
      sunken: "bg-surface-container-low",
      ink: "bg-primary text-on-primary",
      accent: "border border-wood-warm/40 bg-secondary-container/40",
      info: "border border-divider-soft bg-crisis-blue",
      highlight: "border-2 border-primary bg-card shadow-sm",
    },
    padding: { none: "", sm: "p-4", md: "p-5", lg: "p-6" },
    interactive: {
      true: "cursor-pointer hover:border-wood-warm hover:shadow-md",
      false: "",
    },
  },
  defaultVariants: { tone: "base", padding: "md", interactive: false },
});

type CardProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof cardVariants>;

export function Card({
  className,
  tone,
  padding,
  interactive,
  ...rest
}: CardProps) {
  return (
    <div
      className={cn(cardVariants({ tone, padding, interactive }), className)}
      {...rest}
    />
  );
}
