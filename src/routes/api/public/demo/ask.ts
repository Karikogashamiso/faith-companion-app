import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";
import {
  createLovableAiGatewayProvider,
  embedTexts,
} from "@/lib/ai-gateway.server";
import { stripUnsanctionedRefs, type VerseRef } from "@/lib/bible-refs.server";
import {
  classifyCrisis,
  CRISIS_RESOURCES,
  PASTORAL_HANDOFF,
} from "@/lib/crisis-detection.server";

/**
 * Public, anonymous AI demo for the marketing landing page.
 * Uses the same retrieval-grounded pipeline as the authenticated /ask flow,
 * but with an aggressive per-IP rate limit (durable, DB-backed) and no
 * user logging.
 *
 * Limits: 4 requests / 10 min / IP, enforced atomically in Postgres so the
 * limit holds across processes and serverless cold starts.
 */

const CHAT_MODEL = "google/gemini-3-flash-preview";
const EMBED_MODEL = "openai/text-embedding-3-small";
const MAX_PER_WINDOW = 4;
const WINDOW_SECONDS = 10 * 60;

const Input = z.object({
  question: z.string().min(3).max(300),
});

function buildSystem(verses: { book: string; chapter: number; verse: number; text: string }[]) {
  const block = verses.length
    ? verses.map((v) => `[${v.book} ${v.chapter}:${v.verse}] ${v.text}`).join("\n")
    : "(none)";
  return `You are a Scripture study companion. You may ONLY quote verse text that appears in the CANDIDATE VERSES block below, and you must use the reference verbatim. Never paraphrase, summarize, or reconstruct the wording of any verse that is not in the block — refer to such passages by reference only. If the candidates don't answer the question, say so honestly. Stay broadly Christian, warm, and concise (under 180 words). End with: "This is a brief demo — the full app has more."

CANDIDATE VERSES:
${block}`;
}

export const Route = createFileRoute("/api/public/demo/ask")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip =
          request.headers.get("cf-connecting-ip") ??
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          "anon";

        const supabase = createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );

        // Durable, cross-process rate limit (atomic in Postgres). Fails open
        // for the marketing page if the limiter is briefly unavailable.
        const { data: rlRows } = await supabase.rpc("demo_rate_check", {
          _ip: ip,
          _max: MAX_PER_WINDOW,
          _window_seconds: WINDOW_SECONDS,
        });
        const rl = (Array.isArray(rlRows) ? rlRows[0] : rlRows) ?? {
          allowed: true,
          remaining: MAX_PER_WINDOW - 1,
        };
        if (!rl.allowed) {
          return Response.json(
            { error: "You've reached the demo limit. Install the app to keep going." },
            { status: 429 },
          );
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response("bad json", { status: 400 });
        }
        const parsed = Input.safeParse(body);
        if (!parsed.success) {
          return Response.json({ error: "Please ask a short question." }, { status: 400 });
        }
        const question = parsed.data.question;

        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) {
          return Response.json({ error: "AI is not configured." }, { status: 500 });
        }

        const crisis = classifyCrisis(question);

        const { data: version } = await supabase
          .from("bible_versions")
          .select("id")
          .eq("abbreviation", "WEB")
          .maybeSingle();
        if (!version) {
          return Response.json({ error: "Bible not ready yet." }, { status: 503 });
        }

        let embedding: number[] | null = null;
        try {
          [embedding] = await embedTexts(apiKey, EMBED_MODEL, [question]);
        } catch {
          embedding = null;
        }

        const { data: candidates } = await supabase.rpc("match_verses", {
          query_embedding: embedding as unknown as string,
          query_text: question,
          p_version_id: version.id,
          match_count: 8,
        });
        const retrieved = (candidates ?? []) as {
          book: string;
          chapter: number;
          verse: number;
          text: string;
        }[];

        const allowed: VerseRef[] = retrieved.map((v) => ({
          book: v.book,
          chapter: v.chapter,
          verse: v.verse,
        }));

        const gateway = createLovableAiGatewayProvider(apiKey);
        let raw = "";
        try {
          const r = await generateText({
            model: gateway(CHAT_MODEL),
            system: buildSystem(retrieved),
            prompt: question,
          });
          raw = r.text;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes("429"))
            return Response.json({ error: "Busy — try again in a moment." }, { status: 429 });
          return Response.json({ error: "AI is unavailable right now." }, { status: 502 });
        }

        const { clean } = stripUnsanctionedRefs(raw, allowed);
        let answer = clean;
        if (crisis === "crisis") answer = `${CRISIS_RESOURCES}\n\n${answer}`;
        else if (crisis === "pastoral") answer = `${PASTORAL_HANDOFF}\n\n${answer}`;

        return Response.json({
          answer,
          citations: retrieved.slice(0, 4).map((v) => ({
            book: v.book,
            chapter: v.chapter,
            verse: v.verse,
          })),
          remaining: rl.remaining,
        });
      },
    },
  },
});
