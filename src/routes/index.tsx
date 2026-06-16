import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Discipleship Companion" },
      {
        name: "description",
        content:
          "A gentle, citation-locked companion for daily Scripture, prayer, and reflection.",
      },
      { property: "og:title", content: "Discipleship Companion" },
      {
        property: "og:description",
        content:
          "A gentle, citation-locked companion for daily Scripture, prayer, and reflection.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <div className="max-w-md space-y-6">
        <h1 className="text-4xl font-semibold tracking-tight text-foreground">
          Discipleship Companion
        </h1>
        <p className="text-base text-muted-foreground">
          A quiet space for Scripture, prayer, and reflection — grounded in the
          text, never inventing verses.
        </p>
        <div className="flex flex-col gap-3 pt-2">
          <Link
            to="/auth"
            className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Get started
          </Link>
          <Link
            to="/auth"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            I already have an account
          </Link>
        </div>
      </div>
    </div>
  );
}
