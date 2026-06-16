import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Entitlement = {
  tier: "free" | "companion" | "companion_gift";
  trial_ends_at: string | null;
  expires_at: string | null;
  isCompanion: boolean;
};

export function useEntitlement() {
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [aiUsedToday, setAiUsedToday] = useState<number>(0);
  const FREE_DAILY_LIMIT = 5;

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;

    const { data: ent } = await supabase
      .from("entitlements")
      .select("tier, trial_ends_at, expires_at")
      .eq("user_id", u.user.id)
      .maybeSingle();

    const now = Date.now();
    const tier = (ent?.tier as Entitlement["tier"]) ?? "free";
    const expires = ent?.expires_at ? new Date(ent.expires_at).getTime() : null;
    const isCompanion =
      (tier === "companion" || tier === "companion_gift") &&
      (expires === null || expires > now);

    setEntitlement({
      tier,
      trial_ends_at: (ent?.trial_ends_at as string | null) ?? null,
      expires_at: (ent?.expires_at as string | null) ?? null,
      isCompanion,
    });

    const today = new Date().toISOString().slice(0, 10);
    const { data: usage } = await supabase
      .from("ai_usage_daily")
      .select("count")
      .eq("user_id", u.user.id)
      .eq("usage_date", today)
      .maybeSingle();
    setAiUsedToday((usage?.count as number | undefined) ?? 0);
  }

  return { entitlement, aiUsedToday, aiDailyLimit: FREE_DAILY_LIMIT, reload: load };
}
