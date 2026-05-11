import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const languageCode = searchParams.get("language_code")?.toLowerCase().trim();
  if (!languageCode) {
    return NextResponse.json({ error: "language_code is required" }, { status: 400 });
  }

  const { data: courseRow, error } = await supabase
    .from("courses")
    .select("id")
    .eq("user_id", user.id)
    .eq("language_code", languageCode)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ exists: Boolean(courseRow?.id), course_id: courseRow?.id ?? null });
}
