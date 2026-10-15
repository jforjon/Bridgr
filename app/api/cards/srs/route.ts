import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { CardOutcome } from "@/types";

export const runtime = "nodejs";

type FlashcardSrsRow = {
  id: string;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  stage: number | null;
  solid_recall_count: number | null;
};

function isCardOutcome(value: unknown): value is CardOutcome {
  return value === "solid" || value === "struggle" || value === "miss";
}

function addDaysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
}

function outcomeToQuality(outcome: CardOutcome): number {
  if (outcome === "solid") return 5;
  if (outcome === "struggle") return 3;
  return 1;
}

function applySm2(params: {
  quality: number;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
}): {
  ease_factor: number;
  interval_days: number;
  repetitions: number;
} {
  const { quality } = params;
  let easeFactor = params.ease_factor;
  let intervalDays = params.interval_days;
  let repetitions = params.repetitions;

  if (quality >= 3) {
    if (repetitions === 0) {
      intervalDays = 1;
    } else if (repetitions === 1) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(intervalDays * easeFactor);
    }

    easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    easeFactor = Math.max(1.3, easeFactor);
    repetitions += 1;
  } else {
    intervalDays = 1;
    repetitions = 0;
  }

  return {
    ease_factor: easeFactor,
    interval_days: intervalDays,
    repetitions
  };
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const flashcard_id = typeof body.flashcard_id === "string" ? body.flashcard_id.trim() : "";
  const outcome = body.outcome;
  const language_code =
    typeof body.language_code === "string" ? body.language_code.toLowerCase().trim() : "";

  if (!flashcard_id || !isCardOutcome(outcome) || !language_code) {
    return NextResponse.json({ error: "Invalid body: missing or invalid fields." }, { status: 400 });
  }

  const { data: flashcard, error: fetchErr } = await supabase
    .from("flashcards")
    .select("id, ease_factor, interval_days, repetitions, stage, solid_recall_count")
    .eq("id", flashcard_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchErr) {
    console.error("[cards/srs] flashcard fetch:", fetchErr);
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }
  if (!flashcard) {
    return NextResponse.json({ error: "Flashcard not found." }, { status: 404 });
  }

  const row = flashcard as FlashcardSrsRow;
  const currentStage = row.stage ?? 1;
  let solidRecallCount = Math.max(0, row.solid_recall_count ?? 0);

  let update: {
    ease_factor: number;
    interval_days: number;
    repetitions: number;
    stage: number;
    last_outcome: CardOutcome;
    solid_recall_count: number;
    next_review_date: string;
  };

  if (currentStage === 1) {
    if (outcome === "solid") {
      solidRecallCount += 1;
    }

    update = {
      ease_factor: row.ease_factor,
      interval_days: 1,
      repetitions: row.repetitions,
      stage: 2,
      last_outcome: outcome,
      solid_recall_count: solidRecallCount,
      next_review_date: addDaysFromNow(1)
    };
  } else {
    const quality = outcomeToQuality(outcome);
    const sm2 = applySm2({
      quality,
      ease_factor: row.ease_factor,
      interval_days: row.interval_days,
      repetitions: row.repetitions
    });

    if (outcome === "solid") {
      solidRecallCount += 1;
    }

    const newStage = sm2.interval_days > 21 ? 3 : 2;

    update = {
      ease_factor: sm2.ease_factor,
      interval_days: sm2.interval_days,
      repetitions: sm2.repetitions,
      stage: newStage,
      last_outcome: outcome,
      solid_recall_count: solidRecallCount,
      next_review_date: addDaysFromNow(sm2.interval_days)
    };
  }

  const { error: updateErr } = await supabase
    .from("flashcards")
    .update(update)
    .eq("id", flashcard_id)
    .eq("user_id", user.id);

  if (updateErr) {
    console.error("[cards/srs] flashcard update:", updateErr);
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({
    stage: update.stage,
    next_review_date: update.next_review_date,
    solid_recall_count: update.solid_recall_count
  });
}
