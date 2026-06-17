import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/app-shell";
import { Icon } from "@/components/app/icon";
import {
  Button,
  Card,
  Chip,
  EmptyState,
  IconBadge,
  Input,
  ListRow,
  ScreenTitle,
  SectionHeader,
} from "@/components/app/ui";

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
        <ScreenTitle
          title="Groups"
          subtitle="A small group, family, or church circle. Everything posted here is only visible to members."
        />

        <section className="space-y-3">
          <SectionHeader>Your groups</SectionHeader>
          {groups.length === 0 ? (
            <EmptyState
              icon="groups"
              title="No groups yet"
              description="Join one with a code, or start your own below."
            />
          ) : (
            <ul className="space-y-2">
              {groups.map((g) => (
                <li key={g.id}>
                  <Link
                    to="/groups/$groupId"
                    params={{ groupId: g.id }}
                    className="block"
                  >
                    <ListRow
                      leading={<IconBadge name="diversity_3" tone="neutral" />}
                      title={g.name}
                      trailing={
                        <Chip tone="info" className="font-mono">
                          {g.join_code}
                        </Chip>
                      }
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="grid gap-gutter sm:grid-cols-2">
          <form onSubmit={joinGroup}>
            <Card className="space-y-3">
              <h2 className="flex items-center gap-2 font-serif text-xl text-primary">
                <Icon name="login" className="text-base text-wood-warm" />
                Join with a code
              </h2>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                maxLength={12}
                className="font-mono uppercase"
              />
              <Button type="submit" block disabled={busy}>
                Join group
              </Button>
            </Card>
          </form>

          <form onSubmit={createGroup}>
            <Card className="space-y-3">
              <h2 className="flex items-center gap-2 font-serif text-xl text-primary">
                <Icon name="add_circle" className="text-base text-wood-warm" />
                Create a group
              </h2>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Group name"
                maxLength={80}
              />
              <Button type="submit" variant="secondary" block disabled={busy}>
                Create
              </Button>
            </Card>
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
