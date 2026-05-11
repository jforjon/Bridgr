import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createServiceRoleClient();

  const tablesWithUserId = [
    "achievements",
    "flashcards",
    "lesson_progress",
    "placements",
    "known_languages",
    "learning_languages",
    "courses"
  ];

  for (const table of tablesWithUserId) {
    const { error } = await admin.from(table).delete().eq("user_id", user.id);
    if (error) {
      return NextResponse.json({ error: `Failed clearing ${table}: ${error.message}` }, { status: 500 });
    }
  }

  const { error: profileError } = await admin.from("profiles").delete().eq("id", user.id);
  if (profileError) {
    return NextResponse.json({ error: `Failed clearing profile: ${profileError.message}` }, { status: 500 });
  }

  const { error: authDeleteError } = await admin.auth.admin.deleteUser(user.id);
  if (authDeleteError) {
    return NextResponse.json({ error: authDeleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
