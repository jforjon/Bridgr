"use client";

import { IconCheck } from "@tabler/icons-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const inputClass =
  "w-full rounded-pill border-none bg-[var(--card-2)] px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none focus:outline-none";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccessMessage("Password updated");
    window.setTimeout(() => {
      router.push("/learn");
    }, 2000);
  };

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text-primary)]">
      <div className="mx-auto w-full max-w-md px-6">
        <section className="pb-8 pt-12 text-center">
          <p className="text-2xl"><span className="font-black tracking-tight text-[var(--text-primary)]">Bridg<span className="text-[var(--accent)]">r</span></span></p>
          <h1 className="mt-8 font-sans text-2xl font-extrabold text-[var(--text-primary)]">Choose a new password</h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">Make it something you&apos;ll remember</p>
        </section>

        {successMessage ? (
          <section className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[var(--accent)]/20 bg-[var(--card-2)]">
              <IconCheck size={28} className="text-[var(--accent)]" stroke={2} aria-hidden />
            </div>
            <h2 className="mt-6 font-sans text-2xl font-extrabold text-[var(--text-primary)]">Password updated</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">Redirecting you to the app...</p>
          </section>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8">
            <label htmlFor="newPassword" className="mb-2 block text-sm font-bold text-[var(--text-primary)]">
              New password
            </label>
            <input
              id="newPassword"
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputClass}
            />

            <label htmlFor="confirmPassword" className="mb-2 mt-4 block text-sm font-bold text-[var(--text-primary)]">
              Confirm password
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputClass}
            />

            {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}

            <div className="mt-6">
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-pill bg-[#BFFF00] py-4 text-base font-extrabold text-[#2A3800] hover:bg-[#A8E000] disabled:opacity-70"
              >
                {loading ? "Updating..." : "Update password"}
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
