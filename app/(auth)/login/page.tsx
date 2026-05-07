"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

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
      router.push("/onboarding");
      return;
    }

    setLoading(false);
    router.push("/dashboard");
  };

  return (
    <main className="min-h-screen bg-background flex items-start justify-center">
      <div className="w-full max-w-[375px] bg-card">
        <div className="pt-12 pb-8 px-6 text-center">
          <h1 className="font-serif text-2xl text-[#2D6A4F] font-normal">Bridgr</h1>
          <h2 className="font-serif text-2xl text-foreground mt-8">Welcome back</h2>
          <p className="text-sm text-muted-foreground mt-2">Continue your language journey</p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 mt-8">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl h-12 border border-slate-300 px-3 text-sm outline-none ring-primary focus:ring-2"
            />
          </div>

          <div className="mt-4">
            <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
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
                className="w-full rounded-xl h-12 border border-slate-300 pl-3 pr-11 text-sm outline-none ring-primary focus:ring-2"
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D6A4F]"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="mt-2 text-right">
            <Link href="/forgot-password" className="text-sm text-primary hover:underline">
              Forgot your password?
            </Link>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="mt-6 h-auto min-h-0 border-0 w-full bg-[#2D6A4F] text-white rounded-2xl py-4 font-semibold text-base hover:bg-[#245c42] transition-colors"
          >
            {loading ? "Logging in..." : "Log in"}
          </Button>

          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        </form>

        <div className="px-6 mt-6">
          <div className="relative flex items-center">
            <div className="flex-grow border-t border-border" />
            <span className="px-4 text-sm text-muted-foreground bg-card">or</span>
            <div className="flex-grow border-t border-border" />
          </div>
        </div>

        <div className="px-6 mt-6 pb-12 text-center">
          <p className="text-sm text-muted-foreground">Don&apos;t have an account?</p>
          <Link href="/signup" className="inline-block mt-1 text-primary font-semibold hover:underline">
            Create a free account
          </Link>
        </div>
      </div>
    </main>
  );
}
