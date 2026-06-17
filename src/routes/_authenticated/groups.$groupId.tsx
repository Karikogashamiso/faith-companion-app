import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/app-shell";
import { Icon } from "@/components/app/icon";

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
    if (!error) {
      setMyPrayed(new Set([...myPrayed, reqId]));
      void supabase.rpc("unlock_achievement", { _code: "intercessor" });
    }
  }

  if (error)
    return (
      <AppShell title="Group">
        <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      </AppShell>
    );
  if (!group)
    return (
      <AppShell title="Group">
        <p className="text-sm text-on-surface-variant">Loading…</p>
      </AppShell>
    );

  const isOwner = me === group.owner_id;
  const threeDaysAgo = Date.now() - 3 * 24 * 3600 * 1000;
  const followups = requests.filter(
    (r) =>
      r.status === "open" &&
      myPrayed.has(r.id) &&
      new Date(r.created_at).getTime() < threeDaysAgo,
  );

  return (
    <AppShell title={group.name}>
      <div className="space-y-stack-lg">
        <header className="space-y-2">
          <Link
            to="/groups"
            className="inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-primary"
          >
            <Icon name="arrow_back" className="text-base" />
            All groups
          </Link>
          <h1 className="font-serif text-3xl text-primary">{group.name}</h1>
          <p className="flex flex-wrap items-center gap-1 text-sm text-on-surface-variant">
            <Icon name="group" className="text-base text-wood-warm" />
            {members.length} {members.length === 1 ? "member" : "members"} · share
            this code to invite:{" "}
            <span className="rounded-lg bg-crisis-blue px-2 py-0.5 font-mono text-xs font-bold text-primary">
              {group.join_code}
            </span>
          </p>
        </header>

        {followups.length > 0 && (
          <section className="space-y-2 rounded-xl border border-divider-soft bg-crisis-blue p-5">
            <h2 className="flex items-center gap-2 font-serif text-lg text-primary">
              <Icon name="favorite" filled className="text-base text-wood-warm" />
              Want to check in?
            </h2>
            <p className="text-xs text-on-surface-variant">
              You prayed for these earlier — see how things are going.
            </p>
            <ul className="space-y-1 text-sm text-on-surface">
              {followups.map((r) => (
                <li key={r.id} className="line-clamp-1">
                  · {r.body}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="font-serif text-2xl text-primary">Prayer requests</h2>
          <form
            onSubmit={postRequest}
            className="space-y-2 rounded-xl border border-divider-soft bg-white p-4"
          >
            <textarea
              value={newRequest}
              onChange={(e) => setNewRequest(e.target.value)}
              placeholder="Share what's on your heart…"
              rows={3}
              maxLength={1000}
              className="w-full resize-none rounded-lg border border-divider-soft bg-scripture-cream px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
            <button
              disabled={busy || !newRequest.trim()}
              className="flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary transition-colors hover:bg-navy-deep disabled:opacity-50"
            >
              <Icon name="send" className="text-base" />
              Post request
            </button>
          </form>

          {requests.length === 0 ? (
            <p className="rounded-xl border border-divider-soft bg-white p-6 text-center text-sm text-on-surface-variant">
              No requests yet. Be the first to share.
            </p>
          ) : (
            <ul className="space-y-3">
              {requests.map((r) => {
                const author = profiles[r.author_id];
                return (
                  <li
                    key={r.id}
                    className="rounded-xl border border-divider-soft bg-white p-5"
                  >
                    <div className="flex items-center justify-between text-xs text-on-surface-variant">
                      <span className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary-container text-xs font-bold text-on-secondary-container">
                          {(author?.display_name ?? "M").charAt(0).toUpperCase()}
                        </span>
                        {author?.display_name ?? "Member"} · {timeAgo(r.created_at)}
                      </span>
                      {r.status === "answered" && (
                        <span className="flex items-center gap-1 rounded-full bg-secondary-container px-2 py-0.5 font-semibold text-on-secondary-container">
                          <Icon name="check" className="text-sm" />
                          Answered
                        </span>
                      )}
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-on-surface">
                      {r.body}
                    </p>
                    {r.testimony && (
                      <p className="mt-3 rounded-lg bg-crisis-blue p-3 font-serif text-sm italic text-primary">
                        “{r.testimony}”
                      </p>
                    )}
                    <div className="mt-4 flex items-center gap-4 border-t border-divider-soft pt-3">
                      <button
                        onClick={() => prayFor(r.id)}
                        disabled={myPrayed.has(r.id)}
                        className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-wood-warm disabled:text-on-surface-variant"
                      >
                        <Icon
                          name="front_hand"
                          filled={myPrayed.has(r.id)}
                          className="text-base"
                        />
                        {myPrayed.has(r.id) ? "You prayed" : "I prayed for this"}
                      </button>
                      <Link
                        to="/groups/$groupId/requests/$requestId"
                        params={{ groupId, requestId: r.id }}
                        className="ml-auto flex items-center gap-1 text-sm text-on-surface-variant hover:text-primary"
                      >
                        Open
                        <Icon name="arrow_forward" className="text-base" />
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="font-serif text-2xl text-primary">Members</h2>
          <ul className="overflow-hidden rounded-xl border border-divider-soft bg-white text-sm">
            {members.map((m, i) => {
              const p = profiles[m.user_id];
              return (
                <li
                  key={m.user_id}
                  className={`flex items-center justify-between p-4 ${
                    i > 0 ? "border-t border-divider-soft" : ""
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container text-xs font-bold text-primary">
                      {(p?.display_name ?? "M").charAt(0).toUpperCase()}
                    </span>
                    <span className="font-medium text-on-surface">
                      {p?.display_name ?? "Member"}
                    </span>
                  </span>
                  <span className="text-xs text-on-surface-variant">
                    {m.role}
                    {p?.share_progress ? " · sharing progress" : ""}
                  </span>
                </li>
              );
            })}
          </ul>
          {isOwner && (
            <p className="pt-2 text-xs text-on-surface-variant">
              You're the owner. Invite by sharing the join code above.
            </p>
          )}
        </section>
      </div>
    </AppShell>
  );
}
