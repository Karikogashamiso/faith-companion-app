import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, SectionHeading } from "@/components/app/app-shell";
import { Icon } from "@/components/app/icon";

export const Route = createFileRoute("/_authenticated/groups")({
  head: () => ({ meta: [{ title: "Groups · Discipleship Companion" }] }),
  component: GroupsPage,
});

type Group = { id: string; name: string; join_code: string; owner_id: string };

function GroupsPage() {
  const navigate = useNavigate();
  const { user } = Route.useRouteContext();
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
    const { data, error } = await supabase
      .from("groups")
      .insert({
        name: name.trim(),
        owner_id: user.id,
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
    <AppShell title="Groups">
      <div className="space-y-stack-lg">
        <header className="space-y-2">
          <h1 className="font-serif text-3xl text-primary">Groups</h1>
          <p className="text-on-surface-variant">
            A small group, family, or church circle. Everything posted here is
            only visible to members.
          </p>
        </header>

        <section className="space-y-3">
          <SectionHeading>Your groups</SectionHeading>
          {groups.length === 0 ? (
            <div className="rounded-xl border border-divider-soft bg-white p-6 text-center">
              <Icon
                name="groups"
                className="text-4xl text-on-surface-variant opacity-40"
              />
              <p className="mt-2 text-on-surface-variant">
                You're not in any groups yet.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {groups.map((g) => (
                <li key={g.id}>
                  <Link
                    to="/groups/$groupId"
                    params={{ groupId: g.id }}
                    className="flex items-center justify-between rounded-xl border border-divider-soft bg-white p-4 transition-colors hover:border-wood-warm"
                  >
                    <span className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container text-primary">
                        <Icon name="diversity_3" />
                      </span>
                      <span className="font-semibold text-primary">
                        {g.name}
                      </span>
                    </span>
                    <span className="rounded-lg bg-crisis-blue px-2 py-1 font-mono text-xs font-bold text-primary">
                      {g.join_code}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="grid gap-gutter sm:grid-cols-2">
          <form
            onSubmit={joinGroup}
            className="space-y-3 rounded-xl border border-divider-soft bg-white p-5"
          >
            <h2 className="flex items-center gap-2 font-serif text-xl text-primary">
              <Icon name="login" className="text-base text-wood-warm" />
              Join with a code
            </h2>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={12}
              className="w-full rounded-lg border border-divider-soft bg-scripture-cream px-3 py-2.5 font-mono uppercase focus:border-primary focus:outline-none"
            />
            <button
              disabled={busy}
              className="h-11 w-full rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary transition-colors hover:bg-navy-deep disabled:opacity-50"
            >
              Join group
            </button>
          </form>

          <form
            onSubmit={createGroup}
            className="space-y-3 rounded-xl border border-divider-soft bg-white p-5"
          >
            <h2 className="flex items-center gap-2 font-serif text-xl text-primary">
              <Icon name="add_circle" className="text-base text-wood-warm" />
              Create a group
            </h2>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Group name"
              maxLength={80}
              className="w-full rounded-lg border border-divider-soft bg-scripture-cream px-3 py-2.5 focus:border-primary focus:outline-none"
            />
            <button
              disabled={busy}
              className="h-11 w-full rounded-lg border border-divider-soft bg-white px-4 text-sm font-semibold text-primary transition-colors hover:border-wood-warm disabled:opacity-50"
            >
              Create
            </button>
          </form>
        </section>

        {error && (
          <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </AppShell>
  );
}
