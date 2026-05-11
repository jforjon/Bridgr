"use client";

import { IconCheck } from "@tabler/icons-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const inputClass =
  "w-full rounded-xl border border-teal-400/30 bg-teal-850 px-4 py-3 text-sm text-white placeholder:text-teal-300 outline-none focus:border-lime-300";

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
    <main className="min-h-screen bg-teal-900 text-white">
      <div className="mx-auto w-full max-w-md px-6">
        <section className="pb-8 pt-12 text-center">
          <p className="font-sans text-3xl font-extrabold text-lime-300">Bridgr</p>
          <h1 className="mt-8 font-sans text-2xl font-extrabold text-white">Choose a new password</h1>
          <p className="mt-2 text-sm text-teal-200">Make it something you&apos;ll remember</p>
        </section>

        {successMessage ? (
          <section className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-lime-300/20 bg-lime-300/10">
              <IconCheck size={28} className="text-lime-300" stroke={2} aria-hidden />
            </div>
            <h2 className="mt-6 font-sans text-2xl font-extrabold text-white">Password updated</h2>
            <p className="mt-2 text-sm text-teal-200">Redirecting you to the app...</p>
          </section>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8">
            <label htmlFor="newPassword" className="mb-2 block text-sm font-bold text-white">
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

            <label htmlFor="confirmPassword" className="mb-2 mt-4 block text-sm font-bold text-white">
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
                className="w-full rounded-full bg-lime-300 py-4 text-base font-extrabold text-lime-700 disabled:opacity-70"
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
