import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calculateNextReview, type ReviewQuality } from "@/lib/srs";
import type { Flashcard } from "@/types";

interface SrsRequestBody {
  flashcardId: string;
  quality: ReviewQuality;
}

export async function POST(request: Request) {
  let body: SrsRequestBody;
  try {
    body = (await request.json()) as SrsRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const { flashcardId, quality } = body;

  const isQualityValid =
    typeof quality === "number" &&
    Number.isInteger(quality) &&
    quality >= 0 &&
    quality <= 5;

  if (!flashcardId || typeof flashcardId !== "string" || !isQualityValid) {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  const supabase = createClient();
  const { data: flashcard, error: flashcardError } = await supabase
    .from("flashcards")
    .select("*")
    .eq("id", flashcardId)
    .single();

  if (flashcardError || !flashcard) {
    return NextResponse.json({ error: "Flashcard not found." }, { status: 404 });
  }

  const updatedSchedule = calculateNextReview(quality, flashcard as Flashcard);
  const { data: updatedCard, error: updateError } = await supabase
    .from("flashcards")
    .upsert(
      {
        id: flashcardId,
        ...updatedSchedule,
        last_quality: quality
      },
      { onConflict: "id" }
    )
    .select("*")
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ flashcard: updatedCard }, { status: 200 });
}
