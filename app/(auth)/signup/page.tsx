"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const inputBase =
  "field-input";

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError("");
    setPasswordError("");
    setConfirmPasswordError("");
    setError("");

    let hasError = false;
    if (!email.includes("@") || !email.includes(".")) {
      setEmailError("Please enter a valid email address");
      hasError = true;
    }
    if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      hasError = true;
    }
    if (password !== confirmPassword) {
      setConfirmPasswordError("Passwords don't match");
      hasError = true;
    }
    if (hasError) {
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password
    });
    setLoading(false);

    if (signUpError) {
      setEmailError(signUpError.message);
      return;
    }

    if (data.user) {
      router.push("/onboarding/1");
      return;
    }

    setError("Signup succeeded, but we could not start onboarding.");
  };

  return (
    <main className="min-h-screen bg-[var(--bg)]">
      <header className="px-page pt-8">
        <h1 className="text-2xl"><span className="font-black tracking-tight text-[var(--text-1)]">Bridg<span className="text-[var(--accent-text)]">r</span></span></h1>
      </header>

      <div className="px-page flex justify-center pt-6">
        <div className="w-full max-w-[375px] rounded-xl bg-[var(--surface-1)]">
        <section className="px-page pb-8 pt-4 text-center">
          <h2 className="text-balance font-sans text-2xl font-semibold text-[var(--text-1)]">
            Create your account
          </h2>
          <p className="mt-2 text-sm text-[var(--text-2)]">Start learning smarter today</p>
        </section>

        <form noValidate onSubmit={handleSubmit} className="px-page mt-8">
          <div>
            <label htmlFor="email" className="field-label">
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailError("");
              }}
              aria-invalid={Boolean(emailError)}
              className={`${inputBase} mt-1.5`}
            />
            {emailError ? (
              <p className="field-help field-help--error mt-2">{emailError}</p>
            ) : null}
          </div>

          <div className="mt-4">
            <label htmlFor="password" className="field-label">
              Password
            </label>
            <div className="relative mt-1.5">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError("");
                }}
                aria-invalid={Boolean(passwordError)}
              className={`${inputBase} pl-4 pr-11`}
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-[var(--text-2)] hover:text-[var(--accent-text)] focus-visible:outline-none"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {passwordError ? (
              <p className="field-help field-help--error mt-2">{passwordError}</p>
            ) : null}
          </div>

          <div className="mt-4">
            <label htmlFor="confirmPassword" className="field-label">
              Confirm password
            </label>
            <div className="relative mt-1.5">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setConfirmPasswordError("");
                }}
                aria-invalid={Boolean(confirmPasswordError)}
              className={`${inputBase} pl-4 pr-11`}
              />
              <button
                type="button"
                aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-[var(--text-2)] hover:text-[var(--accent-text)] focus-visible:outline-none"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirmPasswordError ? (
              <p className="field-help field-help--error mt-2">{confirmPasswordError}</p>
            ) : null}
          </div>

          <div className="mt-6">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </div>

          {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        </form>

        <section className="px-page mt-6 pb-12 text-center">
          <p className="text-sm text-[var(--text-2)]">Already have an account?</p>
          <Link href="/login" className="mt-1 block text-sm font-semibold text-[var(--accent-text)] hover:underline">
            Log in
          </Link>
        </section>
        </div>
      </div>
    </main>
  );
}
