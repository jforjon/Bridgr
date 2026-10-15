import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function resolveOrigin(request: Request): string | null {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  try {
    return new URL(request.url).origin;
  } catch {
    return null;
  }
}

async function findCurrentLessonId(
  adminClient: ReturnType<typeof createServiceRoleClient>,
  userId: string,
  languageCode: string
): Promise<string | null> {
  const { data: course, error: courseErr } = await adminClient
    .from("courses")
    .select("id")
    .eq("user_id", userId)
    .eq("language_code", languageCode)
    .maybeSingle();

  if (courseErr || !course?.id) {
    return null;
  }

  const { data: unitRows, error: unitErr } = await adminClient
    .from("units")
    .select("id")
    .eq("course_id", course.id)
    .eq("status", "available")
    .order("order_index", { ascending: true })
    .limit(1);

  const unit = unitRows?.[0] ?? null;
  if (unitErr || !unit?.id) {
    return null;
  }

  const { data: lessonRows, error: lessonErr } = await adminClient
    .from("lessons")
    .select("id")
    .eq("unit_id", unit.id)
    .eq("status", "available")
    .order("order_index", { ascending: true })
    .limit(1);

  const lesson = lessonRows?.[0] ?? null;
  if (lessonErr || !lesson?.id) {
    return null;
  }

  return lesson.id as string;
}

export async function POST(request: Request) {
  const sessionClient = createClient();
  const {
    data: { user }
  } = await sessionClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: Record<string, unknown>;
  try {
    raw = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const word = typeof raw.word === "string" ? raw.word.trim() : "";
  const language_code =
    typeof raw.language_code === "string" ? raw.language_code.toLowerCase().trim() : "";

  if (!word || !language_code) {
    return NextResponse.json(
      { error: "Invalid body: require word and language_code." },
      { status: 400 }
    );
  }

  let adminClient;
  try {
    adminClient = createServiceRoleClient();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[cards/add-personal] service role client:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const [
    { data: learningRow, error: learningErr },
    { data: profileRow, error: profileErr },
    { data: knownRows, error: knownErr }
  ] = await Promise.all([
    adminClient
      .from("learning_languages")
      .select("cefr_level, goal")
      .eq("user_id", user.id)
      .eq("language_code", language_code)
      .maybeSingle(),
    adminClient.from("profiles").select("interests").eq("id", user.id).maybeSingle(),
    adminClient
      .from("known_languages")
      .select("language_name, language_code, proficiency")
      .eq("user_id", user.id)
  ]);

  if (learningErr) {
    console.error("[cards/add-personal] learning_languages:", learningErr);
    return NextResponse.json({ error: learningErr.message }, { status: 500 });
  }
  if (profileErr) {
    console.error("[cards/add-personal] profiles:", profileErr);
    return NextResponse.json({ error: profileErr.message }, { status: 500 });
  }
  if (knownErr) {
    console.error("[cards/add-personal] known_languages:", knownErr);
    return NextResponse.json({ error: knownErr.message }, { status: 500 });
  }
  if (!learningRow?.cefr_level) {
    return NextResponse.json(
      { error: "Learning language not found for this user." },
      { status: 404 }
    );
  }

  const lesson_id = await findCurrentLessonId(adminClient, user.id, language_code);
  const cefr_level = String(learningRow.cefr_level);

  const origin = resolveOrigin(request);
  if (!origin) {
    console.error("[cards/add-personal] could not resolve app origin");
    return NextResponse.json({ error: "Could not queue card generation." }, { status: 500 });
  }

  void fetch(`${origin}/api/cards/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: request.headers.get("cookie") ?? ""
    },
    body: JSON.stringify({
      unit_id: null,
      lesson_id,
      topic_key: "personal",
      grammar_anchor: null,
      situation_context: null,
      language_code,
      cefr_level,
      vocabulary_items: [{ word }]
    })
  }).catch((err) => {
    console.error("[cards/add-personal] background generate request failed:", err);
  });

  return NextResponse.json({
    queued: true,
    message: "Your card will appear in your next session."
  });
}
