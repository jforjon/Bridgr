"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");
    setLoading(true);

    const supabase = createClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/reset-password`
    });

    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }

    setSuccessMessage("Check your email");
  };

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto w-full max-w-md">
        <section className="px-6 pb-8 pt-12 text-center">
          <p className="font-serif text-3xl text-[#2D6A4F]">Bridgr</p>
          <h1 className="mt-8 font-serif text-2xl text-slate-900">Reset your password</h1>
          <p className="mt-2 text-sm text-slate-600">
            Enter your email and we&apos;ll send you a reset link
          </p>
        </section>

        {successMessage ? (
          <section className="px-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-green-200 bg-green-50">
              <span className="text-2xl text-green-600">✓</span>
            </div>
            <h2 className="mt-6 font-serif text-2xl text-slate-900">Check your email</h2>
            <p className="mt-2 text-sm text-slate-600">We sent a reset link to {email}</p>
            <Link href="/login" className="mt-8 inline-block text-sm text-[#2D6A4F] hover:underline">
              Back to login
            </Link>
          </section>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="mt-8 px-6">
              <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/20"
              />
              {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}
              <div className="mt-6">
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl bg-[#2D6A4F] py-4 font-semibold text-white hover:bg-[#255a43] disabled:opacity-70"
                >
                  {loading ? "Sending..." : "Send reset link"}
                </Button>
              </div>
            </form>

            <section className="mt-6 px-6 text-center">
              <p className="text-sm text-slate-600">Remember your password?</p>
              <Link href="/login" className="mt-2 inline-block text-sm font-semibold text-[#2D6A4F] hover:underline">
                Log in
              </Link>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
