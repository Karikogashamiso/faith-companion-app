import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/app-shell";
import { Icon } from "@/components/app/icon";

export const Route = createFileRoute(
  "/_authenticated/groups/$groupId/requests/$requestId",
)({
  head: () => ({ meta: [{ title: "Prayer request · Discipleship Companion" }] }),
  component: RequestDetail,
});

type Req = {
  id: string;
  group_id: string;
  body: string;
  author_id: string;
  status: "open" | "answered" | "archived";
  created_at: string;
  testimony: string | null;
  answered_at: string | null;
};
type Response = {
  id: string;
  responder_id: string;
  note: string | null;
  prayed: boolean;
  created_at: string;
};

function RequestDetail() {
  const { groupId, requestId } = Route.useParams();
  const [me, setMe] = useState<string | null>(null);
  const [req, setReq] = useState<Req | null>(null);
  const [responses, setResponses] = useState<Response[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [testimony, setTestimony] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  async function load() {
    const { data: u } = await supabase.auth.getUser();
    setMe(u.user?.id ?? null);

    const { data: r, error: rErr } = await supabase
      .from("prayer_requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle();
    if (rErr) setError(rErr.message);
    setReq(r as Req | null);

    const { data: resp } = await supabase
      .from("prayer_responses")
      .select("id, responder_id, note, prayed, created_at")
      .eq("request_id", requestId)
      .order("created_at", { ascending: false });
    setResponses((resp ?? []) as Response[]);

    const ids = new Set<string>();
    if (r) ids.add((r as Req).author_id);
    (resp ?? []).forEach((x: any) => ids.add(x.responder_id));
    if (ids.size) {
      const { data: pr } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", Array.from(ids));
      const map: Record<string, string> = {};
      (pr ?? []).forEach((p: any) => (map[p.id] = p.display_name ?? "Member"));
      setProfiles(map);
    }
  }

  async function submitResponse(prayed: boolean) {
    if (!me) return;
    setBusy(true);
    const { error } = await supabase.from("prayer_responses").insert({
      request_id: requestId,
      responder_id: me,
      prayed,
      note: note.trim() || null,
    });
    setBusy(false);
    if (error) setError(error.message);
    else {
      setNote("");
      void load();
    }
  }

  async function markAnswered() {
    if (!req || !testimony.trim()) return;
    setBusy(true);
    const { error } = await supabase
      .from("prayer_requests")
      .update({
        status: "answered",
        testimony: testimony.trim(),
        answered_at: new Date().toISOString(),
      })
      .eq("id", req.id);
    setBusy(false);
    if (error) setError(error.message);
    else void load();
  }

  if (error)
    return (
      <AppShell title="Prayer">
        <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      </AppShell>
    );
  if (!req)
    return (
      <AppShell title="Prayer">
        <p className="text-sm text-on-surface-variant">Loading…</p>
      </AppShell>
    );

  const isAuthor = me === req.author_id;

  return (
    <AppShell title="Prayer">
      <div className="space-y-stack-md">
        <Link
          to="/groups/$groupId"
          params={{ groupId }}
          className="inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-primary"
        >
          <Icon name="arrow_back" className="text-base" />
          Back to group
        </Link>

        <article className="space-y-3 rounded-xl border border-divider-soft bg-card p-5">
          <div className="flex items-center gap-2 text-xs text-on-surface-variant">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary-container text-xs font-bold text-on-secondary-container">
              {(profiles[req.author_id] ?? "M").charAt(0).toUpperCase()}
            </span>
            {profiles[req.author_id] ?? "Member"} ·{" "}
            {new Date(req.created_at).toLocaleString()}
          </div>
          <p className="whitespace-pre-wrap font-serif text-lg leading-relaxed text-on-surface">
            {req.body}
          </p>
          {req.status === "answered" && (
            <div className="rounded-lg bg-crisis-blue p-4 text-sm text-primary">
              <p className="flex items-center gap-1.5 font-semibold">
                <Icon name="celebration" filled className="text-base text-wood-warm" />
                Answered prayer
              </p>
              <p className="mt-1 font-serif italic">“{req.testimony}”</p>
            </div>
          )}
        </article>

        {isAuthor && req.status === "open" && (
          <section className="space-y-2 rounded-xl border border-divider-soft bg-card p-5">
            <h2 className="font-serif text-xl text-primary">Mark as answered</h2>
            <p className="text-xs text-on-surface-variant">
              Share a short testimony — the group will see it.
            </p>
            <textarea
              value={testimony}
              onChange={(e) => setTestimony(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="What happened?"
              className="w-full resize-none rounded-lg border border-divider-soft bg-scripture-cream px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
            <button
              onClick={markAnswered}
              disabled={busy || !testimony.trim()}
              className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary transition-colors hover:bg-navy-deep disabled:opacity-50"
            >
              Mark answered
            </button>
          </section>
        )}

        {req.status === "open" && (
          <section className="space-y-2 rounded-xl border border-divider-soft bg-crisis-blue p-5">
            <h2 className="flex items-center gap-2 font-serif text-xl text-primary">
              <Icon name="front_hand" filled className="text-base text-wood-warm" />
              Pray &amp; respond
            </h2>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="A short note of encouragement (optional)"
              className="w-full resize-none rounded-lg border border-divider-soft bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => submitResponse(true)}
                disabled={busy}
                className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary transition-colors hover:bg-navy-deep disabled:opacity-50"
              >
                I prayed for this
              </button>
              {note.trim() && (
                <button
                  onClick={() => submitResponse(false)}
                  disabled={busy}
                  className="h-10 rounded-lg border border-divider-soft bg-card px-4 text-sm font-semibold text-primary transition-colors hover:border-wood-warm disabled:opacity-50"
                >
                  Send note only
                </button>
              )}
            </div>
          </section>
        )}

        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-wood-warm">
            {responses.length}{" "}
            {responses.length === 1 ? "response" : "responses"}
          </h2>
          <ul className="space-y-2">
            {responses.map((r) => (
              <li
                key={r.id}
                className="rounded-xl border border-divider-soft bg-card p-4 text-sm"
              >
                <div className="flex items-center justify-between text-xs text-on-surface-variant">
                  <span className="font-medium text-on-surface">
                    {profiles[r.responder_id] ?? "Member"}
                  </span>
                  <span>{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
                {r.prayed && (
                  <p className="mt-1 flex items-center gap-1 font-semibold text-primary">
                    <Icon name="front_hand" filled className="text-sm" />
                    Prayed
                  </p>
                )}
                {r.note && (
                  <p className="mt-1 whitespace-pre-wrap text-on-surface">
                    {r.note}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
