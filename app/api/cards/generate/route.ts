import { NextResponse } from "next/server";
import { generateCards, type VocabularyItemOverride } from "@/lib/generate-cards";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function optionalString(value: unknown): string | null {
  if (value === null) return null;
  return typeof value === "string" ? value : null;
}

function parseVocabularyItems(raw: unknown): VocabularyItemOverride[] | undefined {
  if (!Array.isArray(raw)) return undefined;

  const items: VocabularyItemOverride[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const word = typeof row.word === "string" ? row.word.trim() : "";
    if (!word) continue;

    const parsed: VocabularyItemOverride = { word };
    if (typeof row.translation_en === "string") {
      parsed.translation_en = row.translation_en.trim();
    }
    if (typeof row.part_of_speech === "string") {
      parsed.part_of_speech = row.part_of_speech.trim();
    }
    items.push(parsed);
  }

  return items.length > 0 ? items : undefined;
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: Record<string, unknown>;
  try {
    raw = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const result = await generateCards({
    userId: user.id,
    unit_id: optionalString(raw.unit_id),
    lesson_id: optionalString(raw.lesson_id),
    topic_key: typeof raw.topic_key === "string" ? raw.topic_key : "",
    grammar_anchor: optionalString(raw.grammar_anchor),
    situation_context: optionalString(raw.situation_context),
    language_code: typeof raw.language_code === "string" ? raw.language_code : "",
    cefr_level: typeof raw.cefr_level === "string" ? raw.cefr_level : "",
    vocabulary_items: parseVocabularyItems(raw.vocabulary_items)
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    cards_generated: result.cards_generated,
    false_friends_found: result.false_friends_found
  });
}
