import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { word_id?: unknown; lesson_id?: unknown; language_code?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const word_id = typeof body.word_id === "string" ? body.word_id.trim() : "";
  const lesson_id =
    typeof body.lesson_id === "string" && body.lesson_id.trim() ? body.lesson_id.trim() : undefined;
  const language_code =
    typeof body.language_code === "string" && body.language_code.trim()
      ? body.language_code.trim().toLowerCase()
      : undefined;

  if (!word_id) {
    return NextResponse.json({ error: "Invalid body: require word_id." }, { status: 400 });
  }

  const row: Record<string, unknown> = {
    user_id: user.id,
    word_id,
    ease_factor: 2.5,
    interval_days: 1,
    repetitions: 0,
    next_review_date: new Date().toISOString().split("T")[0]
  };
  if (lesson_id) row.lesson_id = lesson_id;
  if (language_code) row.language_code = language_code;

  const { error: upsertErr } = await supabase.from("flashcards").upsert(row, {
    onConflict: "user_id,word_id",
    ignoreDuplicates: true
  });

  if (upsertErr) {
    console.error("[flashcards/upsert]", upsertErr);
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  const { data: fcRow, error: selErr } = await supabase
    .from("flashcards")
    .select("id")
    .eq("user_id", user.id)
    .eq("word_id", word_id)
    .maybeSingle();

  if (selErr || !fcRow?.id) {
    return NextResponse.json(
      { error: selErr?.message ?? "Flashcard not found after upsert." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, id: fcRow.id as string }, { status: 200 });
}
