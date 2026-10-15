import { NextResponse } from "next/server";
import { generateCards } from "@/lib/generate-cards";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const sessionClient = createClient();
  const {
    data: { user }
  } = await sessionClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let adminClient;
  try {
    adminClient = createServiceRoleClient();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[cards/trigger] service role client:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  let raw: Record<string, unknown>;
  try {
    raw = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const current_unit_id =
    typeof raw.current_unit_id === "string" ? raw.current_unit_id.trim() : "";
  if (!current_unit_id) {
    return NextResponse.json({ error: "Invalid body: require current_unit_id." }, { status: 400 });
  }

  const { data: currentUnitRows, error: currentUnitErr } = await adminClient
    .from("units")
    .select("*")
    .eq("id", current_unit_id)
    .limit(1);

  if (currentUnitErr) {
    console.error("[cards/trigger] current unit:", currentUnitErr);
    return NextResponse.json({ error: currentUnitErr.message }, { status: 500 });
  }

  const currentUnitRow = currentUnitRows?.[0] ?? null;
  if (!currentUnitRow) {
    return NextResponse.json({ error: "Unit not found." }, { status: 404 });
  }

  const { data: courseRow, error: courseErr } = await adminClient
    .from("courses")
    .select("language_code, user_id")
    .eq("id", currentUnitRow.course_id as string)
    .maybeSingle();

  if (courseErr) {
    console.error("[cards/trigger] course:", courseErr);
    return NextResponse.json({ error: courseErr.message }, { status: 500 });
  }
  if (!courseRow || courseRow.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const course_id = currentUnitRow.course_id as string;
  const current_order_index = currentUnitRow.order_index as number;
  const language_code = courseRow.language_code as string;

  const { data: nextUnitRows, error: nextUnitErr } = await adminClient
    .from("units")
    .select(
      "id, topic_key, grammar_anchor, situation_context, cefr_level, cards_generated, order_index"
    )
    .eq("course_id", course_id)
    .eq("order_index", current_order_index + 1)
    .limit(1);

  if (nextUnitErr) {
    console.error("[cards/trigger] next unit:", nextUnitErr);
    return NextResponse.json({ error: nextUnitErr.message }, { status: 500 });
  }

  const nextUnit = nextUnitRows?.[0] ?? null;
  if (!nextUnit) {
    return NextResponse.json({ queued: false, reason: "last_unit" });
  }

  if (nextUnit.cards_generated === true) {
    return NextResponse.json({ queued: false, reason: "already_generated" });
  }

  const { data: lessons, error: lessonsErr } = await adminClient
    .from("lessons")
    .select("id")
    .eq("unit_id", nextUnit.id)
    .order("order_index", { ascending: true });

  if (lessonsErr) {
    console.error("[cards/trigger] lessons:", lessonsErr);
    return NextResponse.json({ error: lessonsErr.message }, { status: 500 });
  }

  const grammar_anchor = nextUnit.grammar_anchor?.trim() ?? "";
  const situation_context = nextUnit.situation_context?.trim() ?? "";
  if (!grammar_anchor || !situation_context) {
    return NextResponse.json(
      { error: "Next unit is missing grammar_anchor or situation_context." },
      { status: 400 }
    );
  }

  if (!lessons?.length) {
    return NextResponse.json({ error: "No lessons found for next unit." }, { status: 400 });
  }

  for (const lesson of lessons) {
    const result = await generateCards({
      userId: user.id,
      unit_id: nextUnit.id,
      lesson_id: lesson.id,
      topic_key: nextUnit.topic_key,
      grammar_anchor,
      situation_context,
      language_code,
      cefr_level: nextUnit.cefr_level
    });

    if (!result.ok) {
      console.error(
        `[cards/trigger] card generation failed lesson_id=${lesson.id}:`,
        result.error
      );
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
  }

  return NextResponse.json({
    queued: true,
    next_unit_id: nextUnit.id,
    cards_generated: true
  });
}
