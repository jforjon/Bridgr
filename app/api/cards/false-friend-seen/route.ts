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

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const alert_id = typeof body.alert_id === "string" ? body.alert_id.trim() : "";
  if (!alert_id) {
    return NextResponse.json({ error: "Invalid body: alert_id is required." }, { status: 400 });
  }

  const { data: row, error: fetchErr } = await supabase
    .from("false_friend_alerts")
    .select("alert_shown_to")
    .eq("id", alert_id)
    .maybeSingle();

  if (fetchErr) {
    console.error("[cards/false-friend-seen] fetch:", fetchErr);
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (!row) {
    return NextResponse.json({ ok: true });
  }

  const shownTo = Array.isArray(row.alert_shown_to)
    ? row.alert_shown_to.map(String)
    : [];

  if (shownTo.includes(user.id)) {
    return NextResponse.json({ ok: true });
  }

  const { error: updateErr } = await supabase
    .from("false_friend_alerts")
    .update({ alert_shown_to: [...shownTo, user.id] })
    .eq("id", alert_id)
    .not("alert_shown_to", "cs", `{${user.id}}`);

  if (updateErr) {
    console.error("[cards/false-friend-seen] update:", updateErr);
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
