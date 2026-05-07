import { NextResponse } from "next/server";
import { generateHint } from "@/lib/hint-engine";
import { createClient } from "@/lib/supabase/server";
import type { Hint, Proficiency } from "@/types";

interface HintRequestBody {
  wordId: string;
  word: string;
  targetLanguage: string;
  knownLanguages: unknown[];
  contextSentence?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as HintRequestBody;
    console.log("POST /api/hint request body:", body);
    const { wordId, word, targetLanguage, knownLanguages, contextSentence } = body;

    if (!wordId || !word || !targetLanguage || !Array.isArray(knownLanguages)) {
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }

    const supabase = createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: knownRows, error: knownLanguagesError } = await supabase
      .from("known_languages")
      .select("language_name, language_code, proficiency, is_reference_only")
      .eq("user_id", user.id);
    if (knownLanguagesError) {
      return NextResponse.json({ error: knownLanguagesError.message }, { status: 500 });
    }

    const knownLanguageObjects = (knownRows ?? [])
      .filter((row) => !(row as { is_reference_only?: boolean }).is_reference_only)
      .map((language) => ({
        language: language.language_name,
        languageCode: language.language_code,
        proficiency: language.proficiency as Proficiency
      }))
      .filter(
        (language, index, arr) =>
          arr.findIndex((entry) => entry.languageCode === language.languageCode) === index
      );
    if (knownLanguageObjects.length === 0) {
      return NextResponse.json({ error: "No known languages found for user." }, { status: 400 });
    }
    const knownLanguageCodes = knownLanguageObjects.map((entry) => entry.languageCode);

    const { data: cachedHint, error: cacheError } = await supabase
      .from("hints")
      .select("*")
      .eq("word_id", wordId)
      .in("source_language_code", knownLanguageCodes)
      .order("confidence", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cacheError) {
      console.error("Hint cache lookup failed:", cacheError);
    }

    if (cachedHint) {
      return NextResponse.json({ hint: cachedHint as Hint }, { status: 200 });
    }

    let generated: Awaited<ReturnType<typeof generateHint>>;
    try {
      generated = await generateHint({
        word,
        targetLanguage,
        knownLanguages: knownLanguageObjects,
        contextSentence
      });
    } catch (generationError) {
      console.error("Hint generation failed with full error object:", generationError);
      const errorMessage =
        generationError instanceof Error ? generationError.message : String(generationError);
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    if (!generated) {
      return new NextResponse(null, { status: 204 });
    }

    const { data: insertedHint, error } = await supabase
      .from("hints")
      .insert({
        word_id: wordId,
        source_language_code: generated.source_language_code,
        hint_text: generated.hint_text,
        hint_type: generated.hint_type,
        confidence: generated.confidence
      })
      .select("*")
      .single();

    if (error) {
      console.error("Hint insert failed:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ hint: insertedHint as Hint }, { status: 200 });
  } catch (error) {
    console.error("POST /api/hint failed:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
