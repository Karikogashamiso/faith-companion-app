import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEntitlement } from "@/hooks/use-entitlement";
import { AppShell } from "@/components/app/app-shell";
import { Icon } from "@/components/app/icon";
import {
  Card,
  IconBadge,
  ScreenTitle,
  Skeleton,
} from "@/components/app/ui";

export const Route = createFileRoute("/_authenticated/listen")({
  head: () => ({ meta: [{ title: "Listen · Faith Companion" }] }),
  component: Listen,
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
};

const CATEGORIES: { key: string; label: string; icon: string }[] = [
  { key: "prayer", label: "Guided Prayer", icon: "self_improvement" },
  { key: "scripture", label: "Audio Scripture", icon: "menu_book" },
  { key: "sleep", label: "Sleep & Rest", icon: "bedtime" },
  { key: "worship", label: "Worship", icon: "music_note" },
];

function fmt(s: number) {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function Listen() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const { entitlement } = useEntitlement();
  const isCompanion = entitlement?.isCompanion ?? false;
  const [current, setCurrent] = useState<Track | null>(null);

  const tracksQuery = useQuery({
    queryKey: ["audio-tracks"],
    queryFn: async (): Promise<Track[]> => {
      const { data, error } = await (supabase as any)
        .from("audio_tracks")
        .select(
          "id, title, subtitle, category, narrator, duration_seconds, audio_url, is_premium",
        )
        .order("sort");
      if (error) throw error;
      return ((data ?? []) as unknown) as Track[];
    },
  });

  function onSelect(t: Track) {
    if (t.is_premium && !isCompanion) {
      navigate({ to: "/companion" });
      return;
    }
    setCurrent(t);
  }

  return (
    <AppShell title="Listen">
      <div className="space-y-stack-lg pb-24">
        <ScreenTitle
          title="Listen"
          subtitle="Guided prayer, Scripture, and rest — for the moments you'd rather close your eyes than read."
        />

        {tracksQuery.isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : (
          CATEGORIES.map((cat) => {
            const items = (tracksQuery.data ?? []).filter(
              (t) => t.category === cat.key,
            );
            if (items.length === 0) return null;
            return (
              <section key={cat.key} className="space-y-3">
                <div className="flex items-center gap-2">
                  <Icon name={cat.icon} className="text-wood-warm" />
                  <h2 className="font-serif text-2xl text-primary">
                    {cat.label}
                  </h2>
                </div>
                <ul className="space-y-2">
                  {items.map((t) => {
                    const locked = t.is_premium && !isCompanion;
                    const active = current?.id === t.id;
                    return (
                      <li key={t.id}>
                        <button
                          onClick={() => onSelect(t)}
                          className={`flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:border-wood-warm ${
                            active ? "border-2 border-primary" : "border-divider-soft"
                          }`}
                        >
                          <IconBadge
                            name={locked ? "lock" : "play_arrow"}
                            filled
                            tone="info"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="truncate font-semibold text-primary">
                                {t.title}
                              </span>
                              {t.is_premium && (
                                <Icon
                                  name="diamond"
                                  filled
                                  className="shrink-0 text-xs text-wood-warm"
                                />
                              )}
                            </span>
                            {t.subtitle && (
                              <span className="block truncate text-sm text-on-surface-variant">
                                {t.subtitle}
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 text-xs text-on-surface-variant">
                            {fmt(t.duration_seconds)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })
        )}

        {!isCompanion && (
          <Link to="/companion" className="block">
            <Card
              tone="ink"
              interactive
              className="flex items-center justify-between gap-4"
            >
              <div>
                <p className="font-serif text-lg text-primary-foreground">
                  Unlock the full library
                </p>
                <p className="text-sm text-on-primary-container">
                  Hundreds of guided prayers, audio Scripture & sleep sessions
                </p>
              </div>
              <Icon name="diamond" filled className="text-2xl text-primary-foreground" />
            </Card>
          </Link>
        )}
      </div>

      {current && (
        <Player track={current} userId={user.id} onClose={() => setCurrent(null)} />
      )}
    </AppShell>
  );
}

function Player({
  track,
  userId,
  onClose,
}: {
  track: Track;
  userId: string;
  onClose: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(track.duration_seconds);

  // Resume from saved position when a track opens.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await (supabase as any)
        .from("audio_progress")
        .select("position_seconds")
        .eq("user_id", userId)
        .eq("track_id", track.id)
        .maybeSingle();
      if (!cancelled && audioRef.current && (data as any)?.position_seconds) {
        audioRef.current.currentTime = (data as any).position_seconds as number;
        setPos((data as any).position_seconds as number);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [track.id, userId]);

  async function saveProgress(completed = false) {
    await (supabase as any).from("audio_progress").upsert(
      {
        user_id: userId,
        track_id: track.id,
        position_seconds: Math.floor(pos),
        completed,
      },
      { onConflict: "user_id,track_id" },
    );
  }

  function toggle() {
    const el = audioRef.current;
    if (!el || !track.audio_url) return;
    if (playing) {
      el.pause();
    } else {
      void el.play().catch(() => setPlaying(false));
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-16 z-40 border-t border-divider-soft bg-scripture-cream/95 backdrop-blur-md">
      <div className="mx-auto w-full max-w-[720px] px-margin-mobile py-3">
        <audio
          ref={audioRef}
          src={track.audio_url ?? undefined}
          onPlay={() => setPlaying(true)}
          onPause={() => {
            setPlaying(false);
            void saveProgress();
          }}
          onTimeUpdate={(e) => setPos(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => {
            if (Number.isFinite(e.currentTarget.duration))
              setDur(e.currentTarget.duration);
          }}
          onEnded={() => {
            setPlaying(false);
            void saveProgress(true);
          }}
        />
        <div className="flex items-center gap-3">
          <button
            onClick={toggle}
            disabled={!track.audio_url}
            aria-label={playing ? "Pause" : "Play"}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary disabled:opacity-40"
          >
            <Icon name={playing ? "pause" : "play_arrow"} filled />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-primary">
              {track.title}
            </p>
            {track.audio_url ? (
              <div className="mt-1 flex items-center gap-2">
                <span className="w-9 text-[11px] tabular-nums text-on-surface-variant">
                  {fmt(pos)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={dur || track.duration_seconds || 1}
                  value={pos}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setPos(v);
                    if (audioRef.current) audioRef.current.currentTime = v;
                  }}
                  className="h-1 flex-1 accent-wood-warm"
                />
                <span className="w-9 text-right text-[11px] tabular-nums text-on-surface-variant">
                  {fmt(dur || track.duration_seconds)}
                </span>
              </div>
            ) : (
              <p className="text-xs text-on-surface-variant">
                Audio coming soon — content is being added.
              </p>
            )}
          </div>
          <button
            onClick={() => {
              void saveProgress();
              onClose();
            }}
            aria-label="Close player"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:text-primary"
          >
            <Icon name="close" />
          </button>
        </div>
      </div>
    </div>
  );
}
