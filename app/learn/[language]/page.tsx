"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Entry after placement: learning language is already stored in Supabase.
 * Main lesson UI lives at /learn; this path preserves the /learn/[language] URL shape.
 */
export default function LearnByLanguagePage() {
  const router = useRouter();

  useEffect(() => {
    void router.replace("/learn");
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#F8FAF9] px-6">
      <p className="font-serif text-xl text-[#0F1A14]">Starting your course…</p>
      <p className="mt-2 text-sm text-slate-500">Taking you to your lesson</p>
    </main>
  );
}
