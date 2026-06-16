import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/groups")({
  head: () => ({ meta: [{ title: "Groups · Discipleship Companion" }] }),
  component: GroupsPage,
});

type Group = { id: string; name: string; join_code: string; owner_id: string };

function GroupsPage() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<Group[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const { data, error } = await supabase
      .from("groups")
      .select("id, name, join_code, owner_id")
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setGroups((data ?? []) as Group[]);
  }

  function makeJoinCode() {
    // 6-char A-Z2-9, no ambiguous chars
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out = "";
    for (let i = 0; i < 6; i++)
      out += alphabet[Math.floor(Math.random() * alphabet.length)];
    return out;
  }

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data, error } = await supabase
      .from("groups")
      .insert({
        name: name.trim(),
        owner_id: u.user.id,
        join_code: makeJoinCode(),
      })
      .select("id")
      .single();
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setName("");
    navigate({ to: "/groups/$groupId", params: { groupId: data.id } });
  }

  async function joinGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.rpc("join_group_by_code", {
      _code: code.trim(),
    });
    setBusy(false);
    if (error) {
      setError(
        error.message.includes("invalid_code")
          ? "That code didn't match a group."
          : error.message,
      );
      return;
    }
    setCode("");
    navigate({ to: "/groups/$groupId", params: { groupId: data as string } });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Groups</h1>
        <Link to="/settings" className="text-sm text-muted-foreground hover:text-foreground">
          Settings
        </Link>
      </header>

      <p className="text-sm text-muted-foreground">
        A small group, family, or church circle. Everything posted here is only
        visible to members.
      </p>

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Your groups
        </h2>
        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You're not in any groups yet.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {groups.map((g) => (
              <li key={g.id}>
                <Link
                  to="/groups/$groupId"
                  params={{ groupId: g.id }}
                  className="flex items-center justify-between p-4 hover:bg-muted/50"
                >
                  <span className="font-medium">{g.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {g.join_code}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-6 sm:grid-cols-2">
        <form onSubmit={joinGroup} className="space-y-2 rounded-md border p-4">
          <h2 className="font-medium">Join with a code</h2>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
            maxLength={12}
            className="w-full rounded border bg-background px-3 py-2 font-mono uppercase"
          />
          <button
            disabled={busy}
            className="h-10 w-full rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Join group
          </button>
        </form>

        <form onSubmit={createGroup} className="space-y-2 rounded-md border p-4">
          <h2 className="font-medium">Create a group</h2>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Group name"
            maxLength={80}
            className="w-full rounded border bg-background px-3 py-2"
          />
          <button
            disabled={busy}
            className="h-10 w-full rounded-md border px-4 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            Create
          </button>
        </form>
      </section>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
