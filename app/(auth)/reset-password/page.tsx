"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

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
      router.push("/dashboard");
    }, 2000);
  };

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto w-full max-w-md">
        <section className="px-6 pb-8 pt-12 text-center">
          <p className="font-serif text-3xl text-[#2D6A4F]">Bridgr</p>
          <h1 className="mt-8 font-serif text-2xl text-slate-900">Choose a new password</h1>
          <p className="mt-2 text-sm text-slate-600">Make it something you&apos;ll remember</p>
        </section>

        {successMessage ? (
          <section className="px-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-green-200 bg-green-50">
              <span className="text-2xl text-green-600">✓</span>
            </div>
            <h2 className="mt-6 font-serif text-2xl text-slate-900">Password updated</h2>
            <p className="mt-2 text-sm text-slate-600">Redirecting you to the app...</p>
          </section>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 px-6">
            <label htmlFor="newPassword" className="mb-2 block text-sm font-medium text-slate-700">
              New password
            </label>
            <input
              id="newPassword"
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/20"
            />

            <label htmlFor="confirmPassword" className="mb-2 mt-4 block text-sm font-medium text-slate-700">
              Confirm password
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/20"
            />

            {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}

            <div className="mt-6">
              <Button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-[#2D6A4F] py-4 font-semibold text-white hover:bg-[#255a43] disabled:opacity-70"
              >
                {loading ? "Updating..." : "Update password"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
