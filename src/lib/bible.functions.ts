import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { stripUnsanctionedRefs, type VerseRef } from "./bible-refs.server";

const DEFAULT_CHAT_MODEL = "google/gemini-3-flash-preview";

const PROVIDER_MODELS: Record<string, string> = {
  openai: "openai/gpt-4o-mini",
  anthropic: "anthropic/claude-3-haiku",
  api_bible: "google/gemini-3-flash-preview",
};

function modelForProvider(provider: string | null | undefined): string {
  return PROVIDER_MODELS[provider ?? ""] ?? DEFAULT_CHAT_MODEL;
}

const Input = z.object({
  version_id: z.string(),
  book: z.string().min(1).max(60),
  chapter: z.number().int().min(1).max(200),
});

/**
 * A short, citation-locked summary of a single chapter — turns the reader into
 * a study tool. Grounded ONLY on that chapter's verses (the guardrail strips
 * any reference outside it). Cached once per chapter and shared across users.
 */
export const explainChapter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("ai_enabled, ai_provider")
      .eq("id", userId)
      .maybeSingle();
    if (profile && !profile.ai_enabled) return { disabled: true as const };

    const chapterModel = modelForProvider((profile as any)?.ai_provider);

    // Cache hit?
    const { data: cached } = await (supabase as any)
      .from("chapter_summaries")
      .select("summary")
      .eq("version_id", data.version_id)
      .eq("book", data.book)
      .eq("chapter", data.chapter)
      .maybeSingle();
    if (cached?.summary)
      return { disabled: false as const, summary: cached.summary as string };

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { disabled: true as const };

    const { data: verses } = await supabase
      .from("verses")
      .select("book, chapter, verse, text")
      .eq("version_id", data.version_id)
      .eq("book", data.book)
      .eq("chapter", data.chapter)
      .order("verse");
    if (!verses?.length) return { disabled: true as const };

    const block = verses
      .map((v) => `[${v.book} ${v.chapter}:${v.verse}] ${v.text}`)
      .join("\n");
    const allowed: VerseRef[] = verses.map((v) => ({
      book: v.book,
      chapter: v.chapter,
      verse: v.verse,
    }));

    const system = `You are a warm, trustworthy Scripture study companion. In 3–4 plain-language sentences, summarize THIS chapter for someone reading it: what happens and why it matters. You may reference verses ONLY from the chapter below, written as "Book Chapter:Verse". Never quote or cite any verse outside this chapter, and never invent references. End with one short, practical takeaway.

CHAPTER (${data.book} ${data.chapter}):
${block}`;

    let raw = "";
    try {
      const r = await generateText({
        model: gatewayModel(apiKey, chapterModel),
        system,
        prompt: `Summarize ${data.book} ${data.chapter}.`,
      });
      raw = r.text;
    } catch {
      return { disabled: true as const };
    }

    const { clean } = stripUnsanctionedRefs(raw, allowed);

    // Cache for everyone (service role bypasses RLS).
    try {
      const { supabaseAdmin } = await import(
        "@/integrations/supabase/client.server"
      );
      await (supabaseAdmin as any).from("chapter_summaries").insert({
        version_id: data.version_id,
        book: data.book,
        chapter: data.chapter,
        summary: clean,
      });
    } catch {
      /* cache write is best-effort */
    }

    return { disabled: false as const, summary: clean };
  });

function gatewayModel(apiKey: string, model: string) {
  return createLovableAiGatewayProvider(apiKey)(model);
}
