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
 * but with an aggressive per-IP rate limit and no user logging.
 *
 * Limits: 4 requests / 10 min / IP (per Worker process — best-effort).
 */

const CHAT_MODEL = "google/gemini-3-flash-preview";
const EMBED_MODEL = "openai/text-embedding-3-small";

const Input = z.object({
  question: z.string().min(3).max(300),
});

// In-memory limiter; per-process on the edge runtime. Good enough to keep
// casual abuse off the page — for hard guarantees, swap for a DB counter.
const RATE: Map<string, { count: number; resetAt: number }> = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 4;

function rateLimit(ip: string): { ok: boolean; remaining: number } {
  const now = Date.now();
  const cur = RATE.get(ip);
  if (!cur || cur.resetAt < now) {
    RATE.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true, remaining: MAX_PER_WINDOW - 1 };
  }
  if (cur.count >= MAX_PER_WINDOW) return { ok: false, remaining: 0 };
  cur.count += 1;
  return { ok: true, remaining: MAX_PER_WINDOW - cur.count };
}

function buildSystem(verses: { book: string; chapter: number; verse: number; text: string }[]) {
  const block = verses.length
    ? verses.map((v) => `[${v.book} ${v.chapter}:${v.verse}] ${v.text}`).join("\n")
    : "(none)";
  return `You are a Scripture study companion. You may ONLY quote verse text that appears in the CANDIDATE VERSES block below, and you must use the reference verbatim. If the candidates don't answer the question, say so honestly. Stay broadly Christian, warm, and concise (under 180 words). End with: "This is a brief demo — the full app has more."

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
        const rl = rateLimit(ip);
        if (!rl.ok) {
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

        const supabase = createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );

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
