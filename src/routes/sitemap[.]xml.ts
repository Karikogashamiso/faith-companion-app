import { createFileRoute } from "@tanstack/react-router";

/** Served at /sitemap.xml — the public, indexable pages (app pages require auth). */
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const origin = new URL(request.url).origin;
        const paths = ["/", "/auth"];
        const urls = paths
          .map(
            (p) =>
              `  <url><loc>${origin}${p}</loc><changefreq>weekly</changefreq></url>`,
          )
          .join("\n");
        const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
        return new Response(body, {
          headers: {
            "content-type": "application/xml; charset=utf-8",
            "cache-control": "public, max-age=86400",
          },
        });
      },
    },
  },
});
