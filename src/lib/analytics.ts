import { supabase } from "@/integrations/supabase/client";

export type VariantTags = {
  variant_screen1?: string | null;
  variant_screen10?: string | null;
};

/**
 * Fire-and-forget analytics event. Writes to public.analytics_events.
 * Variant tags are stored as top-level columns so they can be queried
 * directly for trial-start (Screen 1) and trial-to-paid (Screen 10) rates.
 */
export async function track(
  event: string,
  variants: VariantTags = {},
  props: Record<string, unknown> = {},
) {
  try {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId) return;
    await supabase.from("analytics_events").insert({
      user_id: userId,
      event,
      variant_screen1: variants.variant_screen1 ?? null,
      variant_screen10: variants.variant_screen10 ?? null,
      props,
    });
  } catch {
    /* analytics must never break the UI */
  }
}

/** 50/50 deterministic-ish coin flip. */
export function assignVariant(): "A" | "B" {
  return Math.random() < 0.5 ? "A" : "B";
}
