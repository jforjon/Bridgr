"use client";

import { IconCheck } from "@tabler/icons-react";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const inputClass =
  "w-full rounded-xl border border-teal-400/30 bg-teal-850 px-4 py-3 text-sm text-white placeholder:text-teal-300 outline-none focus:border-lime-300";

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
    <main className="min-h-screen bg-teal-900 text-white">
      <div className="mx-auto w-full max-w-md px-6">
        <section className="pb-8 pt-12 text-center">
          <p className="font-sans text-3xl font-extrabold text-lime-300">Bridgr</p>
          <h1 className="mt-8 font-sans text-2xl font-extrabold text-white">Reset your password</h1>
          <p className="mt-2 text-sm text-teal-200">Enter your email and we&apos;ll send you a reset link</p>
        </section>

        {successMessage ? (
          <section className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-lime-300/20 bg-lime-300/10">
              <IconCheck size={28} className="text-lime-300" stroke={2} aria-hidden />
            </div>
            <h2 className="mt-6 font-sans text-2xl font-extrabold text-white">Check your email</h2>
            <p className="mt-2 text-sm text-teal-200">We sent a reset link to {email}</p>
            <Link href="/login" className="mt-8 inline-block text-sm font-extrabold text-lime-300 hover:underline">
              Back to login
            </Link>
          </section>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="mt-8">
              <label htmlFor="email" className="mb-2 block text-sm font-bold text-white">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
              {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
              <div className="mt-6">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-full bg-lime-300 py-4 text-base font-extrabold text-lime-700 disabled:opacity-70"
                >
                  {loading ? "Sending..." : "Send reset link"}
                </button>
              </div>
            </form>

            <section className="mt-6 text-center">
              <p className="text-sm text-teal-200">Remember your password?</p>
              <Link href="/login" className="mt-2 inline-block text-sm font-extrabold text-lime-300 hover:underline">
                Log in
              </Link>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
