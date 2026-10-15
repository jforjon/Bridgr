import { createClient } from "@/lib/supabase/client";

export type BeginnerCourseFlowParams = {
  languageCode: string;
  languageName: string;
};

export async function setupBeginnerCourseAndSkeleton({
  languageCode,
  languageName
}: BeginnerCourseFlowParams): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw authError ?? new Error("User not authenticated.");
  }

  const language_code = languageCode.toLowerCase().trim();
  if (!language_code) {
    throw new Error("Language code is required.");
  }

  const now = new Date().toISOString();
  const { error: llError } = await supabase.from("learning_languages").upsert(
    {
      user_id: user.id,
      language_code,
      language_name: languageName.trim() || language_code,
      cefr_level: "A1",
      placement_completed: true,
      last_accessed_at: now
    },
    { onConflict: "user_id,language_code" }
  );

  if (llError) {
    throw new Error(llError.message);
  }

  const skeletonRes = await fetch("/api/course/skeleton", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ language_code })
  });

  if (!skeletonRes.ok) {
    const payload = (await skeletonRes.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? "Could not build your course.");
  }
}
