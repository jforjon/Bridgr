import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { calculateNextReview, type ReviewQuality } from "@/lib/srs";
import type { Flashcard } from "@/types";

interface SrsRequestBody {
  flashcardId: string;
  quality: ReviewQuality;
}

export async function POST(request: Request) {
  let bodyText = "";
  try {
    bodyText = await request.text();
  } catch (readErr) {
    console.error("[api/srs] failed to read request body:", readErr);
    return NextResponse.json({ error: "Could not read request body." }, { status: 400 });
  }

  console.log("[api/srs] raw request body:", bodyText);

  let body: Partial<SrsRequestBody>;
  try {
    body = bodyText ? (JSON.parse(bodyText) as Partial<SrsRequestBody>) : {};
  } catch (parseErr) {
    console.error("[api/srs] invalid JSON:", parseErr);
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  console.log("[api/srs] parsed body:", JSON.stringify(body));

  const { flashcardId, quality } = body;

  const isQualityValid =
    typeof quality === "number" &&
    Number.isInteger(quality) &&
    quality >= 0 &&
    quality <= 5;

  if (!flashcardId || typeof flashcardId !== "string" || !isQualityValid) {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl?.trim() || !serviceKey?.trim()) {
    console.error("[api/srs] missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  let user: User | null = null;

  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const jwt = authHeader.slice(7).trim();
    if (jwt) {
      const { data: authData, error: jwtUserError } = await adminClient.auth.getUser(jwt);
      if (!jwtUserError && authData.user) {
        user = authData.user;
      }
    }
  }

  if (!user) {
    const regularClient = createServerSupabaseClient();
    const {
      data: { user: cookieUser }
    } = await regularClient.auth.getUser();
    user = cookieUser ?? null;
  }

  console.log("user from session:", user?.id);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: flashcard, error: flashcardError } = await adminClient
    .from("flashcards")
    .select("*")
    .eq("id", flashcardId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (flashcardError) {
    console.error("[api/srs] flashcard fetch error (full):", JSON.stringify(flashcardError, null, 2));
    return NextResponse.json(
      {
        error:
          flashcardError.message ??
          "Could not load your flashcard from the database. Please try again."
      },
      { status: 500 }
    );
  }

  if (!flashcard) {
    console.warn("[api/srs] no flashcard row for id:", flashcardId, "user:", user.id);
    return NextResponse.json(
      {
        error: `No flashcard found for id "${flashcardId}". It may not exist yet or may belong to another account.`
      },
      { status: 404 }
    );
  }

  const row = flashcard as Flashcard;

  console.log("[api/srs] flashcard loaded from DB:", JSON.stringify(flashcard));

  const nextReview = calculateNextReview(quality, row);
  const { data: updatedCard, error } = await adminClient
    .from("flashcards")
    .update({
      ease_factor: nextReview.ease_factor,
      interval_days: nextReview.interval_days,
      repetitions: nextReview.repetitions,
      next_review_date: nextReview.next_review_date,
      last_quality: quality
    })
    .eq("id", flashcardId)
    .eq("user_id", user.id)
    .select("*")
    .single();

  console.log("update result:", error);

  if (error) {
    console.error("[api/srs] update failed (full Supabase error):", JSON.stringify(error, null, 2));
    return NextResponse.json(
      { error: error.message ?? "Could not update flashcard schedule." },
      { status: 500 }
    );
  }

  return NextResponse.json({ flashcard: updatedCard }, { status: 200 });
}
