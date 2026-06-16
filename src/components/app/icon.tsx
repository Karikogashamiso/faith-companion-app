import { cn } from "@/lib/utils";

/**
 * Material Symbols (outlined) icon. Pass `filled` to render the filled variant,
 * used in the design for active states and emphatic affordances.
 */
export function Icon({
  name,
  filled,
  className,
  style,
  ...rest
}: {
  name: string;
  filled?: boolean;
  className?: string;
} & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "material-symbols-outlined select-none leading-none",
        filled && "is-filled",
        className,
      )}
      style={style}
      {...rest}
    >
      {name}
    </span>
  );
}
