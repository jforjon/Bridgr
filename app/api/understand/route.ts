import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SUPPORTED_LANGUAGES } from "@/types";

export const runtime = "nodejs";

/** Cache table for this route only — `public.word_understanding` (see migration 009). */
const WORD_UNDERSTANDING = "word_understanding" as const;

const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 500;

const SYSTEM_PROMPT =
  "You are a language learning coach specialising in cross-language memory techniques. Your job is to give learners a single, punchy memory hook for a new word. Priority order:\n1. If the word has a cognate or similar word in the learner's known languages — lead with that connection\n2. If no direct cognate exists — find a memorable association, sound similarity, or visual trick using the learner's languages\n3. Only use etymology as a last resort if nothing else works\nKeep it to 2 sentences maximum. Be specific and concrete.\nNever write more than you need to.";

function resolveLanguageName(code: string): string {
  const found = SUPPORTED_LANGUAGES.find((l) => l.code === code);
  if (found) return found.name;
  return code.length > 0 ? code.charAt(0).toUpperCase() + code.slice(1) : code;
}

function sliceJsonObject(text: string): string {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1) {
    throw new Error("No JSON object found in model response");
  }
  return text.slice(first, last + 1);
}

interface KnownLanguageInput {
  language: string;
  code: string;
  cefr_level: string;
}

function knownLanguagesKey(list: KnownLanguageInput[]): string {
  return [...list]
    .map((x) => {
      const code = (x.code ?? "").toLowerCase().trim();
      const lvl = (x.cefr_level ?? "").trim().toUpperCase();
      return code ? `${code}:${lvl}` : "";
    })
    .filter(Boolean)
    .sort()
    .join("|");
}

function formatKnownLanguagesForPrompt(list: KnownLanguageInput[]): string {
  if (list.length === 0) return "(none)";
  return list
    .map((x) => {
      const name = (x.language ?? "").trim();
      const code = (x.code ?? "").trim();
      const lvl = (x.cefr_level ?? "").trim();
      if (!name && !code) return "";
      return [name || code, code && name !== code ? `(${code})` : null, lvl ? lvl : null]
        .filter(Boolean)
        .join(" ");
    })
    .filter(Boolean)
    .join(", ");
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured." }, { status: 500 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const word = typeof body.word === "string" ? body.word.trim() : "";
  const word_id = typeof body.word_id === "string" ? body.word_id.trim() : "";
  const language_code =
    typeof body.language_code === "string" ? body.language_code.toLowerCase().trim() : "";
  const translation = typeof body.translation === "string" ? body.translation.trim() : "";
  const rawKnown = body.known_languages;

  if (!word || !language_code || !translation) {
    return NextResponse.json(
      { error: "Invalid body: require word, language_code, and translation." },
      { status: 400 }
    );
  }

  const known_languages: KnownLanguageInput[] = Array.isArray(rawKnown)
    ? (rawKnown as unknown[]).map((entry) => {
        if (!entry || typeof entry !== "object") {
          return { language: "", code: "", cefr_level: "" };
        }
        const o = entry as Record<string, unknown>;
        return {
          language: typeof o.language === "string" ? o.language : "",
          code: typeof o.code === "string" ? o.code : "",
          cefr_level: typeof o.cefr_level === "string" ? o.cefr_level : ""
        };
      })
    : [];

  const knownKey = knownLanguagesKey(known_languages);
  const wordNorm = word.trim();

  let cacheQuery = supabase
    .from(WORD_UNDERSTANDING)
    .select("hook, source_language, hook_type")
    .eq("user_id", user.id)
    .eq("language_code", language_code)
    .eq("known_languages_key", knownKey)
    .eq("word", wordNorm);

  if (word_id) {
    cacheQuery = cacheQuery.eq("word_id", word_id);
  }

  const { data: cached, error: cacheErr } = await cacheQuery.maybeSingle();

  if (cacheErr) {
    console.error("[understand] cache read:", cacheErr);
    return NextResponse.json({ error: cacheErr.message }, { status: 500 });
  }

  if (cached) {
    return NextResponse.json({
      hook: cached.hook,
      source_language: cached.source_language,
      type: cached.hook_type
    });
  }

  const language_name = resolveLanguageName(language_code);
  const knownListText = formatKnownLanguagesForPrompt(known_languages);

  const userPrompt = `Word: ${word} in ${language_name} meaning '${translation}'
Learner knows: ${knownListText}

Give me ONE memory hook for this word. Maximum 2 sentences.
Focus on connections to their known languages first.
If no connection exists, give a memorable trick or association.

Return ONLY valid JSON:
{
  "hook": string,
  "source_language": string,
  "type": "cognate"|"similar"|"mnemonic"|"etymology"
}`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let text: string;
  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }]
    });
    const block = message.content[0];
    text = block.type === "text" ? block.text : "";
    if (!text.trim()) {
      return NextResponse.json({ error: "Empty model response." }, { status: 502 });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[understand] Anthropic:", e);
    return NextResponse.json({ error: message }, { status: 502 });
  }

  let parsed: {
    hook?: unknown;
    source_language?: unknown;
    type?: unknown;
  };
  try {
    parsed = JSON.parse(sliceJsonObject(text)) as typeof parsed;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[understand] JSON parse:", message, text.slice(0, 400));
    return NextResponse.json({ error: `Failed to parse JSON: ${message}` }, { status: 502 });
  }

  const hook = typeof parsed.hook === "string" ? parsed.hook.trim() : "";
  const source_language =
    typeof parsed.source_language === "string" ? parsed.source_language.trim() : "";
  const hookType = typeof parsed.type === "string" ? parsed.type.trim() : "";
  const validHookType =
    hookType === "cognate" ||
    hookType === "similar" ||
    hookType === "mnemonic" ||
    hookType === "etymology";

  if (!hook || !validHookType) {
    return NextResponse.json(
      { error: "Invalid model output: missing hook or invalid type." },
      { status: 502 }
    );
  }

  const payload = {
    user_id: user.id,
    ...(word_id ? { word_id } : {}),
    word: wordNorm,
    language_code,
    known_languages_key: knownKey,
    hook,
    source_language: source_language || "mnemonic",
    hook_type: hookType
  };

  const { error: insertErr } = word_id
    ? await supabase
        .from(WORD_UNDERSTANDING)
        .upsert(payload, { onConflict: "word_id,user_id" })
    : await supabase.from(WORD_UNDERSTANDING).insert(payload);

  if (insertErr) {
    console.error("[understand] cache insert:", insertErr);
    /* still return payload; cache is best-effort */
  }

  return NextResponse.json({
    hook,
    source_language: source_language || "mnemonic",
    type: hookType
  });
}
