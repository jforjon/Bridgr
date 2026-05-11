import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type StreakProfile = {
  weekly_goal: number | null;
  weekly_streak: number | null;
  sessions_this_week: number | null;
  week_start_date: string | null;
  best_weekly_streak: number | null;
};

export async function POST() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profileRow, error: profileError } = await supabase
    .from("profiles")
    .select("weekly_goal,weekly_streak,sessions_this_week,week_start_date,best_weekly_streak")
    .eq("id", user.id)
    .single();

  if (profileError || !profileRow) {
    return NextResponse.json({ error: profileError?.message ?? "Profile not found." }, { status: 500 });
  }

  const profile = profileRow as StreakProfile;
  const weeklyGoal = Math.max(1, profile.weekly_goal ?? 3);
  const weeklyStreak = Math.max(0, profile.weekly_streak ?? 0);
  const sessionsThisWeek = Math.max(0, profile.sessions_this_week ?? 0);
  const bestWeeklyStreak = Math.max(0, profile.best_weekly_streak ?? 0);

  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - daysToMonday);
  weekStart.setHours(0, 0, 0, 0);
  const weekStartStr = weekStart.toISOString().split("T")[0];

  const isNewWeek = profile.week_start_date !== weekStartStr;

  let nextWeeklyStreak = weeklyStreak;
  let nextSessionsThisWeek = sessionsThisWeek;
  let nextBestWeeklyStreak = bestWeeklyStreak;

  if (isNewWeek) {
    nextWeeklyStreak = sessionsThisWeek >= weeklyGoal ? weeklyStreak + 1 : 0;
    nextSessionsThisWeek = 1;
    if (nextWeeklyStreak > nextBestWeeklyStreak) {
      nextBestWeeklyStreak = nextWeeklyStreak;
    }
  } else {
    nextSessionsThisWeek = sessionsThisWeek + 1;
  }

  const updatePayload: Record<string, unknown> = {
    weekly_streak: nextWeeklyStreak,
    sessions_this_week: nextSessionsThisWeek
  };

  if (isNewWeek) {
    updatePayload.week_start_date = weekStartStr;
    updatePayload.best_weekly_streak = nextBestWeeklyStreak;
  }

  const { error: updateError } = await supabase.from("profiles").update(updatePayload).eq("id", user.id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    weekly_streak: nextWeeklyStreak,
    sessions_this_week: nextSessionsThisWeek,
    weekly_goal: weeklyGoal,
    week_complete: nextSessionsThisWeek >= weeklyGoal
  });
}
