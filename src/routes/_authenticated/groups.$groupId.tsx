import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/groups/$groupId")({
  head: () => ({ meta: [{ title: "Group · Discipleship Companion" }] }),
  component: GroupHome,
});

type Group = {
  id: string;
  name: string;
  join_code: string;
  owner_id: string;
  active_plan_id: string | null;
};
type Member = { user_id: string; role: string; joined_at: string };
type Profile = { id: string; display_name: string | null; share_progress: boolean };
type PrayerRequest = {
  id: string;
  body: string;
  author_id: string;
  status: "open" | "answered" | "archived";
  created_at: string;
  testimony: string | null;
  answered_at: string | null;
};

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function GroupHome() {
  const { groupId } = Route.useParams();
  const navigate = useNavigate();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [requests, setRequests] = useState<PrayerRequest[]>([]);
  const [myPrayed, setMyPrayed] = useState<Set<string>>(new Set());
  const [newRequest, setNewRequest] = useState("");
  const [me, setMe] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  async function load() {
    const { data: u } = await supabase.auth.getUser();
    setMe(u.user?.id ?? null);

    const [{ data: g, error: ge }, { data: ms }, { data: rs }] = await Promise.all([
      supabase
        .from("groups")
        .select("id, name, join_code, owner_id, active_plan_id")
        .eq("id", groupId)
        .maybeSingle(),
      supabase
        .from("group_members")
        .select("user_id, role, joined_at")
        .eq("group_id", groupId),
      supabase
        .from("prayer_requests")
        .select("id, body, author_id, status, created_at, testimony, answered_at")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false }),
    ]);

    if (ge) setError(ge.message);
    setGroup(g as Group | null);
    setMembers((ms ?? []) as Member[]);
    setRequests((rs ?? []) as PrayerRequest[]);

    const memberIds = (ms ?? []).map((m: any) => m.user_id);
    if (memberIds.length) {
      const { data: pr } = await supabase
        .from("profiles")
        .select("id, display_name, share_progress")
        .in("id", memberIds);
      const map: Record<string, Profile> = {};
      (pr ?? []).forEach((p: any) => (map[p.id] = p));
      setProfiles(map);
    }

    if (u.user && rs && rs.length) {
      const { data: my } = await supabase
        .from("prayer_responses")
        .select("request_id")
        .eq("responder_id", u.user.id)
        .in(
          "request_id",
          rs.map((r: any) => r.id),
        );
      setMyPrayed(new Set((my ?? []).map((m: any) => m.request_id)));
    }
  }

  async function postRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!newRequest.trim() || !me) return;
    setBusy(true);
    const { error } = await supabase.from("prayer_requests").insert({
      group_id: groupId,
      author_id: me,
      body: newRequest.trim(),
      status: "open",
    });
    setBusy(false);
    if (error) setError(error.message);
    else {
      setNewRequest("");
      void load();
    }
  }

  async function prayFor(reqId: string) {
    if (!me) return;
    const { error } = await supabase
      .from("prayer_responses")
      .insert({ request_id: reqId, responder_id: me, prayed: true });
    if (!error) setMyPrayed(new Set([...myPrayed, reqId]));
  }

  if (error) return <p className="p-6 text-sm text-destructive">{error}</p>;
  if (!group) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;

  const isOwner = me === group.owner_id;
  const threeDaysAgo = Date.now() - 3 * 24 * 3600 * 1000;
  const followups = requests.filter(
    (r) =>
      r.status === "open" &&
      myPrayed.has(r.id) &&
      new Date(r.created_at).getTime() < threeDaysAgo,
  );

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <header className="space-y-2">
        <Link to="/groups" className="text-sm text-muted-foreground hover:text-foreground">
          ← All groups
        </Link>
        <h1 className="text-2xl font-semibold">{group.name}</h1>
        <p className="text-sm text-muted-foreground">
          {members.length} {members.length === 1 ? "member" : "members"} ·
          {" "}share this code to invite:{" "}
          <span className="font-mono">{group.join_code}</span>
        </p>
      </header>

      {followups.length > 0 && (
        <section className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-4">
          <h2 className="text-sm font-medium">Want to check in?</h2>
          <p className="text-xs text-muted-foreground">
            You prayed for these earlier — see how things are going.
          </p>
          <ul className="space-y-1 text-sm">
            {followups.map((r) => (
              <li key={r.id} className="line-clamp-1">
                · {r.body}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Prayer requests
        </h2>
        <form onSubmit={postRequest} className="space-y-2">
          <textarea
            value={newRequest}
            onChange={(e) => setNewRequest(e.target.value)}
            placeholder="Share what's on your heart…"
            rows={3}
            maxLength={1000}
            className="w-full rounded border bg-background px-3 py-2 text-sm"
          />
          <button
            disabled={busy || !newRequest.trim()}
            className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Post request
          </button>
        </form>

        {requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No requests yet. Be the first to share.
          </p>
        ) : (
          <ul className="space-y-3">
            {requests.map((r) => {
              const author = profiles[r.author_id];
              return (
                <li key={r.id} className="rounded-md border p-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {author?.display_name ?? "Member"} · {timeAgo(r.created_at)}
                    </span>
                    {r.status === "answered" && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                        Answered
                      </span>
                    )}
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{r.body}</p>
                  {r.testimony && (
                    <p className="mt-2 rounded bg-emerald-50 p-2 text-sm italic text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
                      “{r.testimony}”
                    </p>
                  )}
                  <div className="mt-3 flex items-center gap-3">
                    <button
                      onClick={() => prayFor(r.id)}
                      disabled={myPrayed.has(r.id)}
                      className="text-sm text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
                    >
                      {myPrayed.has(r.id) ? "✓ You prayed" : "I prayed for this"}
                    </button>
                    <Link
                      to="/groups/$groupId/requests/$requestId"
                      params={{ groupId, requestId: r.id }}
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      Open →
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Members
        </h2>
        <ul className="divide-y rounded-md border text-sm">
          {members.map((m) => {
            const p = profiles[m.user_id];
            return (
              <li key={m.user_id} className="flex items-center justify-between p-3">
                <span>{p?.display_name ?? "Member"}</span>
                <span className="text-xs text-muted-foreground">
                  {m.role}
                  {p?.share_progress ? " · sharing progress" : ""}
                </span>
              </li>
            );
          })}
        </ul>
        {isOwner && (
          <p className="pt-2 text-xs text-muted-foreground">
            You're the owner. Invite by sharing the join code above.
          </p>
        )}
      </section>
    </div>
  );
}
