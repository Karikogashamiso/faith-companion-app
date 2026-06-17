import { cn } from "@/lib/utils";
import { Icon } from "../icon";

const controlBase =
  "w-full rounded-lg border border-divider-soft bg-card text-sm text-on-surface placeholder:text-on-surface-variant transition-gentle focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50";

export function Input({
  className,
  leadingIcon,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { leadingIcon?: string }) {
  if (leadingIcon) {
    return (
      <div className="relative">
        <Icon
          name={leadingIcon}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-outline"
        />
        <input className={cn(controlBase, "h-11 pl-10 pr-3", className)} {...rest} />
      </div>
    );
  }
  return <input className={cn(controlBase, "h-11 px-3", className)} {...rest} />;
}

export function Textarea({
  className,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={cn(controlBase, "resize-none px-3 py-2.5", className)} {...rest} />
  );
}

export function Select({
  className,
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        className={cn(controlBase, "h-11 appearance-none px-3 pr-9", className)}
        {...rest}
      >
        {children}
      </select>
      <Icon
        name="expand_more"
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-outline"
      />
    </div>
  );
}

/** Labelled field wrapper — consistent label treatment across all forms. */
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-semibold uppercase tracking-widest text-wood-warm">
        {label}
      </span>
      {children}
      {hint && <span className="block text-xs text-on-surface-variant">{hint}</span>}
    </label>
  );
}
