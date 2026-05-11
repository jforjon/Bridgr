"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const inputClass =
  "w-full rounded-xl border border-teal-400/30 bg-teal-850 px-3 py-3 text-sm text-white placeholder:text-teal-300 outline-none focus:border-lime-300";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (signInError) {
      setLoading(false);
      setError(signInError.message);
      return;
    }

    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      setError("Could not load your account.");
      return;
    }

    const { data: knownRows, error: knownError } = await supabase
      .from("known_languages")
      .select("id")
      .eq("user_id", user.id)
      .limit(1);

    if (knownError) {
      setLoading(false);
      setError(knownError.message);
      return;
    }

    const onboardingComplete = (knownRows ?? []).length > 0;
    if (!onboardingComplete) {
      setLoading(false);
      router.push("/onboarding/1");
      return;
    }

    setLoading(false);
    router.push("/learn");
  };

  return (
    <main className="flex min-h-screen items-start justify-center bg-teal-900">
      <div className="w-full max-w-[375px] rounded-xl border border-teal-400/30 bg-teal-800">
        <div className="px-6 pb-8 pt-12 text-center">
          <h1 className="font-sans text-2xl font-extrabold text-lime-300">Bridgr</h1>
          <h2 className="mt-8 font-sans text-2xl font-extrabold text-white">Welcome back</h2>
          <p className="mt-2 text-sm text-teal-200">Continue your language journey</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 px-6">
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-bold text-white">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="mt-4">
            <label htmlFor="password" className="mb-2 block text-sm font-bold text-white">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${inputClass} pl-3 pr-11`}
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-teal-300 hover:text-lime-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-300"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="mt-2 text-right">
            <Link href="/forgot-password" className="text-sm text-lime-300 hover:underline">
              Forgot your password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-full bg-lime-300 py-4 text-base font-extrabold text-lime-700 transition-opacity disabled:opacity-50"
          >
            {loading ? "Logging in..." : "Log in"}
          </button>

          {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
        </form>

        <div className="mt-6 px-6">
          <div className="relative flex items-center">
            <div className="flex-grow border-t border-teal-400/30" />
            <span className="bg-teal-800 px-4 text-sm text-teal-200">or</span>
            <div className="flex-grow border-t border-teal-400/30" />
          </div>
        </div>

        <div className="mt-6 px-6 pb-12 text-center">
          <p className="text-sm text-teal-200">Don&apos;t have an account?</p>
          <Link href="/signup" className="mt-1 inline-block text-sm font-extrabold text-lime-300 hover:underline">
            Create a free account
          </Link>
        </div>
      </div>
    </main>
  );
}
