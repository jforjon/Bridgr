import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

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

  const now = new Date().toISOString();

  const { data: lessonRow, error: lessonErr } = await supabase
    .from("lessons")
    .select(
      `
      id,
      order_index,
      unit_id,
      units!inner (
        id,
        order_index,
        course_id,
        courses!inner ( user_id )
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
    id: string;
    order_index: number;
    course_id: string;
    courses: { user_id: string } | { user_id: string }[];
  } | null;

  if (!unit) {
    return NextResponse.json({ error: "Lesson unit not found." }, { status: 404 });
  }

  const course = unwrapOne(unit.courses);
  if (!course || course.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const unitId = unit.id;
  const courseId = unit.course_id;
  const unitOrder = unit.order_index;
  const lessonOrder = lessonRow.order_index as number;

  const { error: updErr } = await supabase
    .from("lessons")
    .update({ status: "completed", completed_at: now })
    .eq("id", lesson_id);

  if (updErr) {
    console.error("[lesson/complete] lesson update:", updErr);
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  const { data: unitLessons, error: listErr } = await supabase
    .from("lessons")
    .select("id, order_index, status")
    .eq("unit_id", unitId)
    .order("order_index", { ascending: true });

  if (listErr) {
    return NextResponse.json({ error: listErr.message }, { status: 500 });
  }

  const lessons = unitLessons ?? [];
  const nextInUnit = lessons.find((l) => l.order_index === lessonOrder + 1);
  if (nextInUnit && nextInUnit.status !== "completed") {
    const { error: unlockNextErr } = await supabase
      .from("lessons")
      .update({ status: "available" })
      .eq("id", nextInUnit.id);
    if (unlockNextErr) {
      console.error("[lesson/complete] unlock next lesson:", unlockNextErr);
    }
  }

  const allUnitLessonsDone = lessons.every((l) => l.status === "completed");

  if (allUnitLessonsDone) {
    const { error: unitDoneErr } = await supabase
      .from("units")
      .update({ status: "completed" })
      .eq("id", unitId);
    if (unitDoneErr) {
      console.error("[lesson/complete] unit complete:", unitDoneErr);
    }

    const { data: nextUnit } = await supabase
      .from("units")
      .select("id")
      .eq("course_id", courseId)
      .eq("order_index", unitOrder + 1)
      .maybeSingle();

    if (nextUnit?.id) {
      await supabase
        .from("units")
        .update({ status: "available", unlocked_at: now })
        .eq("id", nextUnit.id);

      const { data: firstNext } = await supabase
        .from("lessons")
        .select("id, order_index")
        .eq("unit_id", nextUnit.id)
        .order("order_index", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (firstNext?.id) {
        await supabase.from("lessons").update({ status: "available" }).eq("id", firstNext.id);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
