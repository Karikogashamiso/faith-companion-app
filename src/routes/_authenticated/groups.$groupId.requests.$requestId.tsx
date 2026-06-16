import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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

  if (error) return <p className="p-6 text-sm text-destructive">{error}</p>;
  if (!req) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;

  const isAuthor = me === req.author_id;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <Link
        to="/groups/$groupId"
        params={{ groupId }}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to group
      </Link>

      <article className="space-y-3 rounded-md border p-4">
        <div className="text-xs text-muted-foreground">
          {profiles[req.author_id] ?? "Member"} ·{" "}
          {new Date(req.created_at).toLocaleString()}
        </div>
        <p className="whitespace-pre-wrap">{req.body}</p>
        {req.status === "answered" && (
          <div className="rounded bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
            <p className="font-medium">Answered prayer</p>
            <p className="mt-1 italic">“{req.testimony}”</p>
          </div>
        )}
      </article>

      {isAuthor && req.status === "open" && (
        <section className="space-y-2 rounded-md border p-4">
          <h2 className="font-medium">Mark as answered</h2>
          <p className="text-xs text-muted-foreground">
            Share a short testimony — the group will see it.
          </p>
          <textarea
            value={testimony}
            onChange={(e) => setTestimony(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="What happened?"
            className="w-full rounded border bg-background px-3 py-2 text-sm"
          />
          <button
            onClick={markAnswered}
            disabled={busy || !testimony.trim()}
            className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Mark answered
          </button>
        </section>
      )}

      {req.status === "open" && (
        <section className="space-y-2 rounded-md border p-4">
          <h2 className="font-medium">Pray & respond</h2>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="A short note of encouragement (optional)"
            className="w-full rounded border bg-background px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={() => submitResponse(true)}
              disabled={busy}
              className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              I prayed for this
            </button>
            {note.trim() && (
              <button
                onClick={() => submitResponse(false)}
                disabled={busy}
                className="h-9 rounded-md border px-4 text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                Send note only
              </button>
            )}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          {responses.length} {responses.length === 1 ? "response" : "responses"}
        </h2>
        <ul className="space-y-2">
          {responses.map((r) => (
            <li key={r.id} className="rounded-md border p-3 text-sm">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{profiles[r.responder_id] ?? "Member"}</span>
                <span>{new Date(r.created_at).toLocaleDateString()}</span>
              </div>
              {r.prayed && <p className="mt-1 text-primary">✓ Prayed</p>}
              {r.note && <p className="mt-1 whitespace-pre-wrap">{r.note}</p>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
