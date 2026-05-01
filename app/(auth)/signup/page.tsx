"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

type FieldErrors = {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
};

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const nextErrors: FieldErrors = {};
    if (!name.trim()) {
      nextErrors.name = "Please enter your name";
    }
    if (!email.trim()) {
      nextErrors.email = "Please enter your email";
    }
    if (password.length < 8) {
      nextErrors.password = "Password must be at least 8 characters";
    }
    if (password !== confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match";
    }

    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name: name.trim() } }
    });
    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (data.user) {
      router.push("/onboarding");
      return;
    }

    setError("Signup succeeded, but we could not start onboarding.");
  };

  return (
    <main className="min-h-screen bg-background flex justify-center">
      <div className="w-full max-w-[375px]">
        <section className="pt-12 pb-8 px-6 text-center">
          <h1 className="font-serif text-2xl text-[#2D6A4F] font-normal">Bridgr</h1>
          <h2 className="font-serif text-2xl text-foreground mt-8 text-balance">
            Create your account
          </h2>
          <p className="text-sm text-muted-foreground mt-2">Start learning smarter today</p>
        </section>

        <form onSubmit={handleSubmit} className="px-6 mt-8">
          <div>
            <label htmlFor="name" className="text-foreground text-sm font-medium">
              Your name
            </label>
            <input
              id="name"
              type="text"
              placeholder="Jonathan"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (fieldErrors.name) {
                  setFieldErrors((current) => ({ ...current, name: undefined }));
                }
              }}
              className={`mt-1.5 w-full rounded-xl border bg-card h-12 px-4 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D6A4F] ${
                fieldErrors.name ? "border-red-500" : "border-input"
              }`}
            />
            {fieldErrors.name ? <p className="mt-1 text-sm text-red-600">{fieldErrors.name}</p> : null}
          </div>

          <div className="mt-4">
            <label htmlFor="email" className="text-foreground text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) {
                  setFieldErrors((current) => ({ ...current, email: undefined }));
                }
              }}
              className={`mt-1.5 w-full rounded-xl border bg-card h-12 px-4 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D6A4F] ${
                fieldErrors.email ? "border-red-500" : "border-input"
              }`}
            />
            {fieldErrors.email ? <p className="mt-1 text-sm text-red-600">{fieldErrors.email}</p> : null}
          </div>

          <div className="mt-4">
            <label htmlFor="password" className="text-foreground text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) {
                  setFieldErrors((current) => ({ ...current, password: undefined }));
                }
              }}
              className={`mt-1.5 w-full rounded-xl border bg-card h-12 px-4 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D6A4F] ${
                fieldErrors.password ? "border-red-500" : "border-input"
              }`}
            />
            {fieldErrors.password ? (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.password}</p>
            ) : null}
          </div>

          <div className="mt-4">
            <label htmlFor="confirmPassword" className="text-foreground text-sm font-medium">
              Confirm password
            </label>
            <input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (fieldErrors.confirmPassword) {
                  setFieldErrors((current) => ({ ...current, confirmPassword: undefined }));
                }
              }}
              className={`mt-1.5 w-full rounded-xl border bg-card h-12 px-4 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D6A4F] ${
                fieldErrors.confirmPassword ? "border-red-500" : "border-input"
              }`}
            />
            {fieldErrors.confirmPassword ? (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.confirmPassword}</p>
            ) : null}
          </div>

          <div className="mt-6">
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#2D6A4F] hover:bg-[#245840] text-white rounded-2xl py-6 text-base font-semibold"
            >
              {loading ? "Creating account..." : "Create account"}
            </Button>
          </div>

          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        </form>

        <section className="px-6 mt-6 pb-12 text-center">
          <p className="text-muted-foreground text-sm">Already have an account?</p>
          <Link href="/login" className="block mt-1 text-[#2D6A4F] font-semibold text-sm hover:underline">
            Log in
          </Link>
        </section>
      </div>
    </main>
  );
}
