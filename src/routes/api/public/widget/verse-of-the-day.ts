import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Public verse-of-the-day endpoint for native widgets (iOS/Android home & lock screen).
// CDN-cached by date — no auth required, no PII, read-only.
// Usage from a WidgetKit / Glance widget:
//   GET /api/public/widget/verse-of-the-day?version=WEB
// Response: { date, reference, text, version }
export const Route = createFileRoute("/api/public/widget/verse-of-the-day")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const versionAbbr = (url.searchParams.get("version") ?? "WEB").toUpperCase();

        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );

        const { data: v, error: vErr } = await supabase
          .from("bible_versions")
          .select("id, name, abbreviation")
          .eq("abbreviation", versionAbbr)
          .maybeSingle();

        if (vErr || !v) {
          return Response.json({ error: "version_not_found" }, { status: 404 });
        }

        const { data: rows, error } = await supabase.rpc("verse_of_the_day", {
          p_version_id: v.id,
        });
        if (error || !rows || (Array.isArray(rows) && rows.length === 0)) {
          return Response.json({ error: "no_verse" }, { status: 503 });
        }
        const row = Array.isArray(rows) ? rows[0] : rows;

        const today = new Date().toISOString().slice(0, 10);
        const body = {
          date: today,
          version: v.abbreviation,
          reference: `${row.book} ${row.chapter}:${row.verse}`,
          text: row.text,
        };

        return new Response(JSON.stringify(body), {
          status: 200,
          headers: {
            "content-type": "application/json",
            // Cache through end of UTC day; clients should poll once/day.
            "cache-control": "public, max-age=300, s-maxage=3600",
            "access-control-allow-origin": "*",
          },
        });
      },
    },
  },
});
