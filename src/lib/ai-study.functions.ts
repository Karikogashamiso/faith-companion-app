import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider, embedTexts } from "./ai-gateway.server";
import {
  classifyCrisis,
  CRISIS_RESOURCES,
  PASTORAL_HANDOFF,
  type CrisisLevel,
} from "./crisis-detection.server";
import { stripUnsanctionedRefs, type VerseRef } from "./bible-refs.server";

const CHAT_MODEL = "google/gemini-3-flash-preview";
const EMBED_MODEL = "openai/text-embedding-3-small";

type RetrievedVerse = {
  id: number;
  book: string;
  chapter: number;
  verse: number;
  text: string;
  score: number;
};

const AskInput = z.object({
  question: z.string().min(3).max(500),
  // Recent conversation turns, so follow-up questions stay coherent. Memory
  // informs the model's phrasing only — retrieval/citations still come from
  // the current question alone, so the guardrail is unaffected.
  context: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        text: z.string().max(4000),
      }),
    )
    .max(8)
    .optional(),
});

// ---------------------------------------------------------------------------
// System prompt — the trust contract.
// ---------------------------------------------------------------------------
function buildSystemPrompt(opts: {
  tradition: string;
  crisis: CrisisLevel;
  candidates: RetrievedVerse[];
}): string {
  const verseBlock = opts.candidates.length
    ? opts.candidates
        .map((v) => `[${v.book} ${v.chapter}:${v.verse}] ${v.text}`)
        .join("\n")
    : "(none — no candidate verses were retrieved)";

  const traditionLine =
    opts.tradition && opts.tradition !== "unspecified"
      ? `The user identifies with the ${opts.tradition} tradition. Frame your explanation in a way that is honest to that tradition's reading of Scripture.`
      : `The user has not specified a tradition. Stay broadly Christian and avoid taking sides on contested questions.`;

  const crisisLine =
    opts.crisis === "crisis"
      ? `THE USER MAY BE IN CRISIS. Lead with care and a clear pointer to a real person and crisis resources. Offer Scripture as comfort, not as instruction or judgment. Do NOT diagnose, prescribe, or tell them what to do.`
      : opts.crisis === "pastoral"
        ? `This is a high-stakes pastoral question. Lead with a gentle handoff to a pastor, counselor, or trusted person who actually knows the user. Offer Scripture as companionship, not as a verdict.`
        : `Answer warmly and pastorally. You are a study companion, not an authority.`;

  return `You are a Scripture study companion inside a Christian discipleship app.

NON-NEGOTIABLE RULES:
1. You may ONLY quote verse text that appears in the CANDIDATE VERSES block below. Quote it verbatim, with the reference exactly as written (e.g. "Philippians 4:6").
2. You MUST NOT cite any verse reference that is not in the CANDIDATE VERSES block. Do not invent references. Do not quote verses from memory. If the candidate set is empty, say plainly that you could not find relevant verses in the user's Bible and suggest a search term — do not paste verses from your training data.
2b. Never paraphrase, summarize, or reconstruct the wording of any Bible verse that is not in the CANDIDATE VERSES block — not even loosely. If you want to refer to a passage you were not given, name it by reference only and tell the user to look it up; do not reproduce its words. Scripture wording in your answer must be either a verbatim quote from the block or absent.
3. Your own commentary, encouragement, and explanation is welcome and should be the bulk of the answer — and it is clearly YOUR words, not Scripture. Use Scripture sparingly — quote at most 3-4 verses.
4. On contested doctrines (e.g. faith vs works, baptism, predestination, sacraments, end times, women in ministry), state how the user's tradition has historically read the passage AND note in one sentence that other Christian traditions read it differently. Never present a contested view as the only Christian view.
5. ${traditionLine}
6. ${crisisLine}

CANDIDATE VERSES (World English Bible, public domain — the ONLY verses you may quote):
${verseBlock}

Format your answer in clean Markdown. When you quote a verse, put the reference in the form "Book Chapter:Verse" so the app can render it as a citation chip.`;
}

// ---------------------------------------------------------------------------
// askStudy — the main endpoint.
// ---------------------------------------------------------------------------
export const askStudy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AskInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    // 1) Profile — gate on ai_enabled, read tradition.
    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("ai_enabled, tradition")
      .eq("id", userId)
      .maybeSingle();
    if (profErr) throw profErr;

    if (profile && !profile.ai_enabled) {
      return {
        disabled: true as const,
        message:
          "AI study is turned off in your settings. You can re-enable it any time from Settings → AI.",
      };
    }
    const tradition = profile?.tradition ?? "unspecified";

    // 1b) AI allowance for free tier (companion = unlimited). Enforced
    //     server-side via an atomic, race-safe SECURITY DEFINER RPC so the
    //     counter can never be tampered with from the client.
    const FREE_DAILY_LIMIT = 5;
    const { data: gate, error: gateErr } = await supabase.rpc(
      "consume_ai_session" as any,
      { _limit: FREE_DAILY_LIMIT },
    );
    if (gateErr) throw gateErr;
    const allowance = Array.isArray(gate) ? gate[0] : gate;
    if (allowance && !(allowance as any).allowed) {
      return {
        disabled: true as const,
        message: `You've used your ${(allowance as any).day_limit} free AI study sessions for today. Tomorrow the count resets — or unlock unlimited with Companion. Scripture reading, search, and prayer are always free.`,
        paywall: true as const,
        used: (allowance as any).used,
        limit: (allowance as any).day_limit,
      };
    }


    // 2) Crisis triage on the raw question.
    const crisis = classifyCrisis(data.question);

    // 3) Active Bible version (first public-domain one).
    const { data: version, error: vErr } = await supabase
      .from("bible_versions")
      .select("id, abbreviation")
      .eq("abbreviation", "WEB")
      .maybeSingle();
    if (vErr || !version) throw new Error("No Bible version available");

    // 4) Retrieval — embed the question, then hybrid match.
    let embedding: number[] | null = null;
    try {
      const [emb] = await embedTexts(apiKey, EMBED_MODEL, [data.question]);
      embedding = emb;
    } catch {
      // Embedding failure is non-fatal — fall back to keyword-only.
      embedding = null;
    }

    const { data: candidates, error: matchErr } = await supabase.rpc("match_verses", {
      // Supabase types vector columns as `string`; runtime accepts number[]/null.
      query_embedding: embedding as unknown as string,
      query_text: data.question,
      p_version_id: version.id,
      match_count: 12,
    });
    if (matchErr) throw matchErr;

    const retrieved: RetrievedVerse[] = (candidates ?? []) as RetrievedVerse[];
    const allowed: VerseRef[] = retrieved.map((v) => ({
      book: v.book,
      chapter: v.chapter,
      verse: v.verse,
    }));

    // 5) LLM call — system prompt locks the model to the retrieved set.
    const gateway = createLovableAiGatewayProvider(apiKey);
    const system = buildSystemPrompt({ tradition, crisis, candidates: retrieved });

    const messages = [
      ...(data.context ?? []).map((m) => ({
        role: m.role,
        content: m.text,
      })),
      { role: "user" as const, content: data.question },
    ];

    let raw = "";
    try {
      const result = await generateText({
        model: gateway(CHAT_MODEL),
        system,
        messages,
      });
      raw = result.text;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("429")) {
        throw new Error("AI is rate-limited right now. Please try again in a moment.");
      }
      if (msg.includes("402")) {
        throw new Error("AI credits are exhausted on this workspace.");
      }
      throw err;
    }

    // 6) Server-side guardrail — strip any reference not in the retrieved set.
    const { clean, stripped } = stripUnsanctionedRefs(raw, allowed);

    // 7) Prepend crisis / pastoral preambles.
    let answer = clean;
    if (crisis === "crisis") {
      answer = `${CRISIS_RESOURCES}\n\n---\n\n${answer}`;
    } else if (crisis === "pastoral") {
      answer = `${PASTORAL_HANDOFF}\n\n---\n\n${answer}`;
    }

    // 8) Audit log (best-effort).
    await supabase.from("ai_study_logs").insert({
      user_id: userId,
      question: data.question,
      tradition: tradition,
      crisis_level: crisis,
      retrieved_refs: allowed,
      stripped_refs: stripped,
      answer,
      model: CHAT_MODEL,
    });

    return {
      disabled: false as const,
      answer,
      candidates: retrieved.map((v) => ({
        book: v.book,
        chapter: v.chapter,
        verse: v.verse,
        text: v.text,
        score: v.score,
      })),
      tradition,
      crisis,
      stripped,
      model: CHAT_MODEL,
    };
  });

// ---------------------------------------------------------------------------
// flagAnswer — user-reported bad/misleading AI answer → review queue.
// ---------------------------------------------------------------------------
const FlagInput = z.object({
  question: z.string().min(1).max(500),
  answer: z.string().min(1).max(8000),
  reason: z.string().max(500).optional(),
  refs: z
    .array(
      z.object({
        book: z.string(),
        chapter: z.number(),
        verse: z.number(),
      }),
    )
    .optional(),
});

export const flagAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => FlagInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await (supabase as any).from("flagged_answers").insert({
      user_id: userId,
      question: data.question,
      answer: data.answer,
      reason: data.reason ?? null,
      refs: data.refs ?? [],
    });
    if (error) throw error;
    return { ok: true as const };
  });

// ---------------------------------------------------------------------------
// dailyDevotional — a personalized daily reflection on the user's verse of the
// day. Cached once per user per day. Grounded on the real verse text only.
// ---------------------------------------------------------------------------
export const dailyDevotional = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("ai_enabled, tradition, default_version_id")
      .eq("id", userId)
      .maybeSingle();
    if (profile && !profile.ai_enabled) return { disabled: true as const };

    const today = new Date().toISOString().slice(0, 10);

    const { data: cached } = await (supabase as any)
      .from("daily_devotionals")
      .select("verse_ref, reflection, prayer")
      .eq("user_id", userId)
      .eq("devo_date", today)
      .maybeSingle();
    if (cached) return { disabled: false as const, ...(cached as any) };

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { disabled: true as const };

    let versionId = profile?.default_version_id ?? null;
    if (!versionId) {
      const { data: v } = await supabase
        .from("bible_versions")
        .select("id")
        .eq("abbreviation", "WEB")
        .maybeSingle();
      versionId = v?.id ?? null;
    }
    if (!versionId) return { disabled: true as const };

    const { data: vot } = await supabase.rpc("verse_of_the_day", {
      p_version_id: versionId,
    });
    const verse = Array.isArray(vot) ? (vot[0] as RetrievedVerse | undefined) : undefined;
    if (!verse) return { disabled: true as const };
    const ref = `${verse.book} ${verse.chapter}:${verse.verse}`;
    const tradition = profile?.tradition ?? "unspecified";

    const gateway = createLovableAiGatewayProvider(apiKey);
    const system = `You write a brief daily devotional for a Christian app. You are given ONE already-verified verse. Reflect on THIS verse only — never quote or cite any other verse, and never invent verse text. Be warm, pastoral, and concrete. Honor the reader's tradition where relevant. Output EXACTLY two labeled sections and nothing else:
REFLECTION: <50-70 words, second person>
PRAYER: <one or two sentences, first person>`;
    const prompt = `Verse (${ref}, for a ${tradition} reader): "${verse.text}"`;

    let raw = "";
    try {
      const r = await generateText({ model: gateway(CHAT_MODEL), system, prompt });
      raw = r.text;
    } catch {
      return { disabled: true as const };
    }

    const reflection = (
      raw.match(/REFLECTION:\s*([\s\S]*?)(?:\n\s*PRAYER:|$)/i)?.[1] ?? ""
    ).trim();
    const prayer = (raw.match(/PRAYER:\s*([\s\S]*)$/i)?.[1] ?? "").trim();
    if (!reflection || !prayer) return { disabled: true as const };

    await (supabase as any).from("daily_devotionals").insert({
      user_id: userId,
      devo_date: today,
      verse_ref: ref,
      reflection,
      prayer,
    });

    return { disabled: false as const, verse_ref: ref, reflection, prayer };
  });

// ---------------------------------------------------------------------------
// embedVerses — admin job. Embeds any verses that don't have embeddings yet.
// Call in batches; rate-limit-friendly.
// ---------------------------------------------------------------------------
const EmbedInput = z.object({
  batch_size: z.number().int().min(1).max(100).default(64),
});

export const embedVerses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => EmbedInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    // Admin gate
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden: admin role required");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabaseAdmin
      .from("verses")
      .select("id, book, chapter, verse, text")
      .is("embedding", null)
      .limit(data.batch_size);
    if (error) throw error;
    if (!rows || rows.length === 0) return { embedded: 0, done: true };

    const inputs = rows.map((r) => `${r.book} ${r.chapter}:${r.verse} — ${r.text}`);
    const vectors = await embedTexts(apiKey, EMBED_MODEL, inputs);

    // Update one-by-one (Supabase JS doesn't bulk-update varied values cleanly).
    let n = 0;
    for (let i = 0; i < rows.length; i++) {
      const { error: upErr } = await supabaseAdmin
        .from("verses")
        .update({ embedding: vectors[i] as unknown as string, embedded_at: new Date().toISOString() })
        .eq("id", rows[i].id);
      if (!upErr) n++;
    }
    return { embedded: n, done: rows.length < data.batch_size };
  });
