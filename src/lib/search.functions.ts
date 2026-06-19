import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { embedTexts } from "./ai-gateway.server";

const EMBED_MODEL = "openai/text-embedding-3-small";

const Input = z.object({ query: z.string().min(2).max(300) });

type VerseHit = {
  id: number;
  book: string;
  chapter: number;
  verse: number;
  text: string;
  score: number;
};

/**
 * Semantic verse search: embeds the query and runs the existing hybrid
 * (vector + full-text) match_verses retrieval — "find verses that *mean* this"
 * rather than keyword matching. No LLM, just retrieval. Falls back to
 * keyword-only ranking if embeddings are unavailable.
 */
export const semanticVerseSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }): Promise<{ results: VerseHit[] }> => {
    const { supabase } = context;

    const { data: version } = await supabase
      .from("bible_versions")
      .select("id")
      .eq("abbreviation", "WEB")
      .maybeSingle();
    if (!version) return { results: [] };

    let embedding: number[] | null = null;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (apiKey) {
      try {
        [embedding] = await embedTexts(apiKey, EMBED_MODEL, [data.query]);
      } catch {
        embedding = null;
      }
    }

    const { data: rows } = await supabase.rpc("match_verses", {
      query_embedding: embedding as unknown as string,
      query_text: data.query,
      p_version_id: version.id as string,
      match_count: 30,
    });

    return { results: (rows ?? []) as VerseHit[] };
  });

const RelatedInput = z.object({
  text: z.string().min(2).max(1000),
  version_id: z.string(),
  book: z.string(),
  chapter: z.number().int(),
  verse: z.number().int(),
});

/**
 * "Verses like this": given a verse, find semantically related verses via the
 * same hybrid retrieval, excluding the verse itself. Reuses the embedding +
 * match_verses pipeline — no LLM call.
 */
export const relatedVerses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RelatedInput.parse(input))
  .handler(async ({ data, context }): Promise<{ results: VerseHit[] }> => {
    const { supabase } = context;

    let embedding: number[] | null = null;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (apiKey) {
      try {
        [embedding] = await embedTexts(apiKey, EMBED_MODEL, [data.text]);
      } catch {
        embedding = null;
      }
    }

    const { data: rows } = await supabase.rpc("match_verses", {
      query_embedding: embedding as unknown as string,
      query_text: data.text,
      p_version_id: data.version_id,
      match_count: 8,
    });

    const results = ((rows ?? []) as VerseHit[]).filter(
      (r) => !(r.book === data.book && r.chapter === data.chapter && r.verse === data.verse),
    );
    return { results: results.slice(0, 6) };
  });
