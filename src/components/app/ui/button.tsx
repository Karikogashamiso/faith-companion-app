import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Icon } from "../icon";

/**
 * The one button in the app. Token-only, gentle motion, accessible focus ring,
 * 44px+ tap targets on the default/large sizes.
 */
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-gentle select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:scale-[0.99]",
  {
    variants: {
      variant: {
        primary: "bg-primary text-on-primary hover:bg-navy-deep shadow-sm",
        secondary:
          "border border-divider-soft bg-card text-primary hover:border-wood-warm",
        ghost: "text-on-surface-variant hover:bg-surface-container hover:text-primary",
        destructive:
          "border border-destructive/40 bg-card text-destructive hover:bg-destructive/10",
        accent: "bg-secondary-container text-on-secondary-container hover:opacity-90",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-11 px-5 text-sm",
        lg: "h-12 px-6 text-base",
        icon: "h-11 w-11",
      },
      block: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "primary", size: "md", block: false },
  },
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    leftIcon?: string;
    rightIcon?: string;
    loading?: boolean;
  };

export function Button({
  className,
  variant,
  size,
  block,
  leftIcon,
  rightIcon,
  loading,
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <Icon name="progress_activity" className="animate-spin text-[1.2em]" />
      ) : (
        leftIcon && <Icon name={leftIcon} className="text-[1.2em]" />
      )}
      {children}
      {rightIcon && !loading && (
        <Icon name={rightIcon} className="text-[1.2em]" />
      )}
    </button>
  );
}
