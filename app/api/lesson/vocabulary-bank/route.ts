import { NextResponse } from "next/server";
import { upsertUserFlashcard } from "@/lib/flashcards/upsert-for-user";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

interface VocabBankItem {
  word_id: string;
  /** Surface form in the target (course) language. */
  word: string;
  /** English gloss (primary answer language for typing checks). */
  translation: string;
  translation_en: string;
  flashcard_id: string;
  part_of_speech: string | null;
}

function unwrapOne<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { lesson_id?: string };
  try {
    body = (await request.json()) as { lesson_id?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const lesson_id = typeof body.lesson_id === "string" ? body.lesson_id.trim() : "";
  if (!lesson_id) {
    return NextResponse.json({ error: "Invalid body: require lesson_id." }, { status: 400 });
  }

  const { data: lessonRow, error: lessonErr } = await supabase
    .from("lessons")
    .select(
      `
      id,
      units!inner (
        id,
        topic_key,
        cefr_level,
        course_id,
        courses!inner ( user_id, language_code )
      )
    `
    )
    .eq("id", lesson_id)
    .maybeSingle();

  if (lessonErr || !lessonRow) {
    return NextResponse.json({ error: lessonErr?.message ?? "Lesson not found." }, { status: 404 });
  }

  const unitRaw = lessonRow.units as unknown;
  const unit = unwrapOne(unitRaw) as {
    topic_key: string;
    cefr_level: string;
    course_id: string;
    courses: { user_id: string; language_code: string } | { user_id: string; language_code: string }[];
  } | null;

  if (!unit) {
    return NextResponse.json({ error: "Lesson unit not found." }, { status: 404 });
  }

  const course = unwrapOne(unit.courses);
  if (!course || course.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const language_code = course.language_code.toLowerCase();
  const topic_key = unit.topic_key;
  const cefr_level = unit.cefr_level;

  let admin;
  try {
    admin = createServiceRoleClient();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const { data: curriculumRows } = await admin
    .from("curriculum_vocabulary")
    .select("id, word, translation_en, part_of_speech")
    .eq("language_code", language_code)
    .eq("topic_key", topic_key)
    .eq("cefr_level", cefr_level)
    .order("frequency_rank", { ascending: true })
    .limit(60);

  let rows =
    (curriculumRows ?? []).length > 0
      ? (curriculumRows as { id: string; word: string; translation_en: string; part_of_speech: string | null }[])
      : [];

  if (rows.length === 0) {
    const { data: wordFallback } = await admin
      .from("words")
      .select("id, word, translation, part_of_speech")
      .eq("language_code", language_code)
      .limit(40);

    rows = (wordFallback ?? []).map((w) => ({
      id: w.id,
      word: w.word,
      translation_en: w.translation,
      part_of_speech: w.part_of_speech
    }));
  }

  const items: VocabBankItem[] = [];

  for (const row of rows) {
    const surface = (row.word ?? "").trim();
    const gloss = (row.translation_en ?? "").trim();
    if (!surface || !gloss) continue;

    const { data: existing } = await admin
      .from("words")
      .select("id")
      .eq("language_code", language_code)
      .eq("word", surface)
      .maybeSingle();

    let wordId = existing?.id as string | undefined;
    if (!wordId) {
      const { data: inserted, error: wErr } = await admin
        .from("words")
        .insert({
          word: surface,
          language_code,
          translation: gloss,
          romanization: null,
          part_of_speech: row.part_of_speech?.trim() ? row.part_of_speech : null
        })
        .select("id")
        .single();
      if (wErr || !inserted?.id) {
        console.error("[lesson/vocabulary-bank] word insert:", wErr);
        continue;
      }
      wordId = inserted.id as string;
    }

    const fcResult = await upsertUserFlashcard(supabase, user.id, {
      word_id: wordId,
      lesson_id,
      language_code
    });
    if ("error" in fcResult) {
      console.error("[lesson/vocabulary-bank] flashcard upsert:", fcResult.error);
      continue;
    }

    const pos = row.part_of_speech?.trim() ? row.part_of_speech.trim() : null;

    items.push({
      word_id: wordId,
      word: surface,
      translation: gloss,
      translation_en: gloss,
      flashcard_id: fcResult.id,
      part_of_speech: pos
    });
  }

  if (items.length === 0) {
    return NextResponse.json({ error: "No vocabulary items available for this lesson." }, { status: 400 });
  }

  return NextResponse.json({ items });
}
