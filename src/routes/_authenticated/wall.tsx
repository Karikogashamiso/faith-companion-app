import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/app-shell";
import { Icon } from "@/components/app/icon";
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  ScreenTitle,
  Skeleton,
  Textarea,
} from "@/components/app/ui";

export const Route = createFileRoute("/_authenticated/wall")({
  head: () => ({ meta: [{ title: "Prayer Wall · Discipleship Companion" }] }),
  component: Wall,
});

type Prayer = {
  id: string;
  author_name: string;
  body: string;
  prayed_count: number;
  created_at: string;
};

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function Wall() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [anon, setAnon] = useState(false);
  const [prayedLocal, setPrayedLocal] = useState<Set<string>>(new Set());

  const feed = useQuery({
    queryKey: ["global-wall", user.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("global_prayers")
        .select("id, author_name, body, prayed_count, created_at")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      const { data: mine } = await (supabase as any)
        .from("global_prayer_prayed")
        .select("prayer_id")
        .eq("user_id", user.id);
      return {
        prayers: ((data ?? []) as unknown) as Prayer[],
        prayed: new Set(((mine ?? []) as any[]).map((m: any) => m.prayer_id as string)),
      };
    },
  });

  const post = useMutation({
    mutationFn: async () => {
      const text = body.trim();
      if (!text) return;
      let name = "Anonymous";
      if (!anon) {
        const { data: p } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", user.id)
          .maybeSingle();
        name = (p?.display_name as string | null) || "Friend";
      }
      const { error } = await (supabase as any)
        .from("global_prayers")
        .insert({ author_id: user.id, author_name: name, body: text });
      if (error) throw error;
    },
    onSuccess: async () => {
      setBody("");
      await qc.invalidateQueries({ queryKey: ["global-wall", user.id] });
    },
  });

  async function pray(id: string) {
    if (prayedLocal.has(id) || feed.data?.prayed.has(id)) return;
    setPrayedLocal(new Set([...prayedLocal, id]));
    await supabase.rpc("pray_for_global" as any, { _prayer_id: id });
    void supabase.rpc("unlock_achievement" as any, { _code: "intercessor" });
    await qc.invalidateQueries({ queryKey: ["global-wall", user.id] });
  }

  return (
    <AppShell title="Prayer Wall">
      <div className="space-y-stack-md">
        <ScreenTitle
          title="Prayer Wall"
          subtitle="Share what's on your heart, and pray for others around the world. You're never praying alone."
        />

        {/* Composer */}
        <Card className="space-y-3">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            maxLength={600}
            placeholder="Ask the community to pray with you…"
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-on-surface-variant">
              <input
                type="checkbox"
                checked={anon}
                onChange={(e) => setAnon(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Post anonymously
            </label>
            <Button
              leftIcon="send"
              loading={post.isPending}
              disabled={body.trim().length === 0}
              onClick={() => post.mutate()}
            >
              Share
            </Button>
          </div>
        </Card>

        {/* Feed */}
        {feed.isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : feed.data && feed.data.prayers.length > 0 ? (
          <ul className="space-y-3">
            {feed.data.prayers.map((p) => {
              const prayed = prayedLocal.has(p.id) || feed.data!.prayed.has(p.id);
              const count =
                p.prayed_count +
                (prayedLocal.has(p.id) && !feed.data!.prayed.has(p.id) ? 1 : 0);
              return (
                <li key={p.id}>
                  <Card>
                    <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                      <Avatar name={p.author_name} className="h-7 w-7" />
                      {p.author_name} · {timeAgo(p.created_at)}
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-on-surface">
                      {p.body}
                    </p>
                    <div className="mt-4 flex items-center justify-between border-t border-divider-soft pt-3">
                      <button
                        onClick={() => pray(p.id)}
                        disabled={prayed}
                        className={`flex items-center gap-1.5 text-sm font-semibold transition-gentle ${
                          prayed
                            ? "text-on-surface-variant"
                            : "text-primary hover:text-wood-warm"
                        }`}
                      >
                        <Icon name="front_hand" filled={prayed} className="text-base" />
                        {prayed ? "You prayed" : "I'll pray"}
                      </button>
                      <span className="text-xs text-on-surface-variant">
                        {count} {count === 1 ? "prayer" : "prayers"}
                      </span>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon="volunteer_activism"
            title="No prayers yet"
            description="Be the first to share what's on your heart."
          />
        )}
      </div>
    </AppShell>
  );
}
