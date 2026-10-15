"use client";

import { IconCheck } from "@tabler/icons-react";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const inputClass =
  "field-input";

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
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text-1)]">
      <div className="px-page mx-auto w-full max-w-md">
        <section className="pb-8 pt-12 text-center">
          <p className="text-2xl"><span className="font-black tracking-tight text-[var(--text-1)]">Bridg<span className="text-[var(--accent-text)]">r</span></span></p>
          <h1 className="mt-8 font-sans text-2xl font-semibold text-[var(--text-1)]">Reset your password</h1>
          <p className="mt-2 text-sm text-[var(--text-2)]">Enter your email and we&apos;ll send you a reset link</p>
        </section>

        {successMessage ? (
          <section className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[var(--accent-text)]/20 bg-[var(--surface-2)]">
              <IconCheck size={28} className="text-[var(--accent-text)]" stroke={2} aria-hidden />
            </div>
            <h2 className="mt-6 font-sans text-2xl font-semibold text-[var(--text-1)]">Check your email</h2>
            <p className="mt-2 text-sm text-[var(--text-2)]">We sent a reset link to {email}</p>
            <Link href="/login" className="mt-8 inline-block text-sm font-semibold text-[var(--accent-text)] hover:underline">
              Back to login
            </Link>
          </section>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="mt-8">
              <label htmlFor="email" className="field-label mb-2 block">
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
              {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
              <div className="mt-6">
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full"
                >
                  {loading ? "Sending..." : "Send reset link"}
                </button>
              </div>
            </form>

            <section className="mt-6 text-center">
              <p className="text-sm text-[var(--text-2)]">Remember your password?</p>
              <Link href="/login" className="mt-2 inline-block text-sm font-semibold text-[var(--accent-text)] hover:underline">
                Log in
              </Link>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
