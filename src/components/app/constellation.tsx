import { useEffect, useMemo, useRef } from "react";

/**
 * Constellation — cinematic candle-particle backdrop.
 *
 * Renders a field of softly-drifting gold "stars" and an optional cursor-follow
 * spotlight. Purely decorative, fully disabled by prefers-reduced-motion via the
 * CSS layer. Absolutely positioned; expects a `relative` parent.
 */
export function Constellation({
  count = 34,
  spotlight = true,
  className = "",
}: {
  count?: number;
  spotlight?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Stable random layout for the lifetime of the component.
  const stars = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        s: 0.6 + Math.random() * 1.6, // px scale
        d: 4 + Math.random() * 6, // duration s
        dl: Math.random() * -6, // delay s
        o: 0.35 + Math.random() * 0.45,
      })),
    [count],
  );

  useEffect(() => {
    if (!spotlight) return;
    const el = ref.current;
    if (!el) return;
    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      el.style.setProperty("--sx", `${x}%`);
      el.style.setProperty("--sy", `${y}%`);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [spotlight]);

  return (
    <div
      ref={ref}
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${
        spotlight ? "spotlight-cursor" : ""
      } ${className}`}
    >
      {stars.map((s) => (
        <span
          key={s.id}
          className="constellation-star"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: `${s.s}px`,
            height: `${s.s}px`,
            opacity: s.o,
            animationDuration: `${s.d}s`,
            animationDelay: `${s.dl}s`,
          }}
        />
      ))}
    </div>
  );
}
