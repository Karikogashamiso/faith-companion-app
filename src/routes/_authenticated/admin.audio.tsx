import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/app-shell";
import { Icon } from "@/components/app/icon";
import { Button, Card, Chip, EmptyState, ScreenTitle, Skeleton } from "@/components/app/ui";

export const Route = createFileRoute("/_authenticated/admin/audio")({
  head: () => ({ meta: [{ title: "Audio admin · Faith Companion" }] }),
  component: AudioAdmin,
});

type Track = {
  id: string;
  title: string;
  subtitle: string | null;
  category: string;
  narrator: string | null;
  duration_seconds: number;
  audio_url: string | null;
  is_premium: boolean;
  sort: number;
};

const CATEGORIES = ["prayer", "scripture", "sleep", "worship"];

function fmtDuration(s: number): string {
  if (!s) return "—";
  const m = Math.round(s / 60);
  return `${m} min`;
}

function AudioAdmin() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const key = ["admin-audio"];

  const isAdmin = useQuery({
    queryKey: ["is-admin", user.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      return Boolean(data);
    },
  });

  const tracks = useQuery({
    queryKey: key,
    enabled: isAdmin.data === true,
    queryFn: async (): Promise<Track[]> => {
      const { data, error } = await (supabase as any)
        .from("audio_tracks")
        .select("id, title, subtitle, category, narrator, duration_seconds, audio_url, is_premium, sort")
        .order("category")
        .order("sort");
      if (error) throw error;
      return (data ?? []) as Track[];
    },
  });

  // New-track form state.
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [category, setCategory] = useState("prayer");
  const [narrator, setNarrator] = useState("");
  const [minutes, setMinutes] = useState("10");
  const [premium, setPremium] = useState(true);

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("audio_tracks").insert({
        title: title.trim(),
        subtitle: subtitle.trim() || null,
        category,
        narrator: narrator.trim() || null,
        duration_seconds: Math.max(0, Math.round(Number(minutes) * 60)) || 0,
        is_premium: premium,
        sort: 100,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setTitle("");
      setSubtitle("");
      setNarrator("");
      toast.success("Track added");
      await qc.invalidateQueries({ queryKey: key });
    },
    onError: (e) => toast.error("Couldn't add track", { description: String((e as Error).message) }),
  });

  const patch = useMutation({
    mutationFn: async (p: { id: string; values: Partial<Track> }) => {
      const { error } = await (supabase as any)
        .from("audio_tracks")
        .update(p.values)
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (e) => toast.error("Update failed", { description: String((e as Error).message) }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("audio_tracks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  if (isAdmin.isLoading) {
    return (
      <AppShell title="Audio admin">
        <Skeleton className="h-40" />
      </AppShell>
    );
  }
  if (!isAdmin.data) {
    return (
      <AppShell title="Audio admin">
        <EmptyState
          icon="lock"
          title="Admins only"
          description="This page requires the admin role."
        />
      </AppShell>
    );
  }

  return (
    <AppShell title="Audio admin">
      <div className="space-y-stack-md">
        <ScreenTitle title="Audio library" subtitle="Add tracks and upload audio files." />
        <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <Icon name="arrow_back" className="text-base" /> Back to analytics
        </Link>

        {/* New track */}
        <Card className="space-y-3">
          <h3 className="font-serif text-lg text-primary">Add a track</h3>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="h-11 w-full rounded-lg border border-divider-soft bg-background px-3 text-sm focus:border-primary focus:outline-none"
          />
          <input
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="Subtitle (optional)"
            className="h-11 w-full rounded-lg border border-divider-soft bg-background px-3 text-sm focus:border-primary focus:outline-none"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-11 rounded-lg border border-divider-soft bg-background px-3 text-sm focus:border-primary focus:outline-none"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              type="number"
              min={0}
              placeholder="Minutes"
              className="h-11 rounded-lg border border-divider-soft bg-background px-3 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <input
            value={narrator}
            onChange={(e) => setNarrator(e.target.value)}
            placeholder="Narrator (optional)"
            className="h-11 w-full rounded-lg border border-divider-soft bg-background px-3 text-sm focus:border-primary focus:outline-none"
          />
          <label className="flex items-center gap-2 text-sm text-on-surface">
            <input type="checkbox" checked={premium} onChange={(e) => setPremium(e.target.checked)} />
            Companion (premium)
          </label>
          <Button
            block
            leftIcon="add"
            loading={create.isPending}
            disabled={title.trim().length === 0}
            onClick={() => create.mutate()}
          >
            Add track
          </Button>
        </Card>

        {/* Existing tracks */}
        {tracks.isLoading ? (
          <Skeleton className="h-40" />
        ) : (tracks.data?.length ?? 0) === 0 ? (
          <EmptyState icon="library_music" title="No tracks yet" description="Add one above." />
        ) : (
          <ul className="space-y-2">
            {tracks.data!.map((t) => (
              <TrackRow
                key={t.id}
                track={t}
                onPatch={(values) => patch.mutate({ id: t.id, values })}
                onDelete={() => remove.mutate(t.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}

function TrackRow({
  track,
  onPatch,
  onDelete,
}: {
  track: Track;
  onPatch: (values: Partial<Track>) => void;
  onDelete: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "mp3";
      const path = `${track.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("audio")
        .upload(path, file, { upsert: true, contentType: file.type || "audio/mpeg" });
      if (error) throw error;
      const { data } = supabase.storage.from("audio").getPublicUrl(path);
      onPatch({ audio_url: data.publicUrl });
      toast.success("Audio uploaded", { description: track.title });
    } catch (err) {
      toast.error("Upload failed", { description: String((err as Error).message) });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <li>
      <Card padding="sm">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-on-surface">{track.title}</span>
              <Chip tone={track.audio_url ? "info" : "neutral"}>
                {track.audio_url ? "has audio" : "no audio"}
              </Chip>
            </div>
            <p className="mt-0.5 text-xs text-on-surface-variant">
              {track.category} · {fmtDuration(track.duration_seconds)}
              {track.narrator ? ` · ${track.narrator}` : ""}
            </p>
          </div>
          <button
            onClick={onDelete}
            aria-label="Delete track"
            className="text-on-surface-variant transition-gentle hover:text-destructive"
          >
            <Icon name="delete" className="text-lg" />
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-divider-soft pt-3">
          <input ref={fileRef} type="file" accept="audio/*" onChange={onFile} className="hidden" />
          <Button size="sm" variant="secondary" leftIcon="upload" loading={uploading} onClick={() => fileRef.current?.click()}>
            {track.audio_url ? "Replace audio" : "Upload audio"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onPatch({ is_premium: !track.is_premium })}
          >
            {track.is_premium ? "★ Companion" : "Free sample"}
          </Button>
          {track.audio_url && (
            <a
              href={track.audio_url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-primary hover:underline"
            >
              Preview
            </a>
          )}
        </div>
      </Card>
    </li>
  );
}
