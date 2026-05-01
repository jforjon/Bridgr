"use client";

import { useState } from "react";
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
      setError("Could not load your account.");
      return;
    }

    const { data: languageRows, error: languageError } = await supabase
      .from("user_languages")
      .select("id")
      .eq("user_id", user.id)
      .limit(1);

    if (languageError) {
      setLoading(false);
      setError(languageError.message);
      return;
    }

    if ((languageRows ?? []).length === 0) {
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
            <input
              id="password"
              type="password"
              required
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl h-12 border border-slate-300 px-3 text-sm outline-none ring-primary focus:ring-2"
            />
          </div>

          <div className="mt-2 text-right">
            <Link href="/forgot-password" className="text-sm text-primary hover:underline">
              Forgot your password?
            </Link>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full mt-6 rounded-2xl py-4 h-auto text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
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
