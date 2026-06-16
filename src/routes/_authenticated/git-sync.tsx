import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getGitDiagnostics } from "@/lib/git-diagnostics.functions";

export const Route = createFileRoute("/_authenticated/git-sync")({
  head: () => ({
    meta: [{ title: "Git sync · Diagnostics" }],
  }),
  component: GitSyncPage,
});

function GitSyncPage() {
  const fetchDiag = useServerFn(getGitDiagnostics);
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["git-diagnostics"],
    queryFn: () => fetchDiag(),
  });

  return (
    <main className="mx-auto max-w-2xl px-6 py-10 space-y-8">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">
          <Link to="/settings" className="underline">
            ← Back to settings
          </Link>
        </p>
        <h1 className="text-2xl font-semibold">Git sync &amp; build</h1>
        <p className="text-sm text-muted-foreground">
          What the running app knows about its own build and GitHub sync.
        </p>
      </header>

      <section className="rounded-lg border p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Runtime snapshot</h2>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-xs rounded border px-2 py-1 hover:bg-muted disabled:opacity-50"
          >
            {isFetching ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {error && (
          <p className="text-sm text-destructive">
            Couldn't read diagnostics: {(error as Error).message}
          </p>
        )}

        {data && (
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Server booted</dt>
            <dd className="font-mono">{formatTime(data.serverBootAt)}</dd>

            <dt className="text-muted-foreground">Observed at</dt>
            <dd className="font-mono">{formatTime(data.observedAt)}</dd>

            <dt className="text-muted-foreground">Node</dt>
            <dd className="font-mono">{data.nodeVersion ?? "—"}</dd>

            <dt className="text-muted-foreground">Runtime</dt>
            <dd className="font-mono break-all">{data.runtime}</dd>
          </dl>
        )}
      </section>

      <section className="rounded-lg border p-5 space-y-3">
        <h2 className="font-medium">Git metadata</h2>
        {data && data.knownMetadata.length > 0 ? (
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
            {data.knownMetadata.map((m) => (
              <div key={m.key} className="contents">
                <dt className="text-muted-foreground">{m.key}</dt>
                <dd className="font-mono break-all">{m.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              No commit SHA or branch is exposed to this runtime. Lovable manages
              git state internally — commit info isn't injected as build-time
              env vars by default.
            </p>
            <p>
              Checked: <code className="font-mono">{data?.checkedEnvKeys.join(", ")}</code>
            </p>
          </div>
        )}
      </section>

      <section className="rounded-lg border p-5 space-y-3 text-sm">
        <h2 className="font-medium">How sync works</h2>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li>
            Lovable ↔ GitHub sync is <strong>bidirectional and automatic</strong>.
            Edits here push to your connected repo; pushes to GitHub flow back
            into Lovable in real time.
          </li>
          <li>
            For authoritative commit history, branch state, and "what synced when",
            open your GitHub repo. That's the source of truth.
          </li>
          <li>
            To expose a commit SHA on this page, set an env var like
            {" "}<code className="font-mono">COMMIT_SHA</code> during build and
            it will appear above automatically.
          </li>
        </ul>
      </section>
    </main>
  );
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
