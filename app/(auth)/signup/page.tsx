"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type FieldErrors = {
  email?: string;
  password?: string;
  confirmPassword?: string;
};

const inputBase =
  "w-full rounded-xl border bg-teal-850 px-4 py-3 text-sm text-white placeholder:text-teal-300 outline-none focus:border-lime-300";

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const nextErrors: FieldErrors = {};
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
      password
    });
    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (data.user) {
      router.push("/onboarding/1");
      return;
    }

    setError("Signup succeeded, but we could not start onboarding.");
  };

  return (
    <main className="flex min-h-screen justify-center bg-teal-900">
      <div className="w-full max-w-[375px] rounded-xl border border-teal-400/30 bg-teal-800">
        <section className="px-6 pb-8 pt-12 text-center">
          <h1 className="font-sans text-2xl font-extrabold text-lime-300">Bridgr</h1>
          <h2 className="mt-8 text-balance font-sans text-2xl font-extrabold text-white">
            Create your account
          </h2>
          <p className="mt-2 text-sm text-teal-200">Start learning smarter today</p>
        </section>

        <form onSubmit={handleSubmit} className="mt-8 px-6">
          <div>
            <label htmlFor="email" className="text-sm font-bold text-white">
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
              className={`${inputBase} mt-1.5 ${fieldErrors.email ? "border-red-500" : "border-teal-400/30"}`}
            />
            {fieldErrors.email ? <p className="mt-1 text-sm text-red-400">{fieldErrors.email}</p> : null}
          </div>

          <div className="mt-4">
            <label htmlFor="password" className="text-sm font-bold text-white">
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
                  if (fieldErrors.password) {
                    setFieldErrors((current) => ({ ...current, password: undefined }));
                  }
                }}
                className={`${inputBase} pl-4 pr-11 ${fieldErrors.password ? "border-red-500" : "border-teal-400/30"}`}
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
            {fieldErrors.password ? (
              <p className="mt-1 text-sm text-red-400">{fieldErrors.password}</p>
            ) : null}
          </div>

          <div className="mt-4">
            <label htmlFor="confirmPassword" className="text-sm font-bold text-white">
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
                  if (fieldErrors.confirmPassword) {
                    setFieldErrors((current) => ({ ...current, confirmPassword: undefined }));
                  }
                }}
                className={`${inputBase} pl-4 pr-11 ${
                  fieldErrors.confirmPassword ? "border-red-500" : "border-teal-400/30"
                }`}
              />
              <button
                type="button"
                aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-teal-300 hover:text-lime-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-300"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {fieldErrors.confirmPassword ? (
              <p className="mt-1 text-sm text-red-400">{fieldErrors.confirmPassword}</p>
            ) : null}
          </div>

          <div className="mt-6">
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-lime-300 py-4 text-base font-extrabold text-lime-700 disabled:opacity-50"
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </div>

          {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
        </form>

        <section className="mt-6 px-6 pb-12 text-center">
          <p className="text-sm text-teal-200">Already have an account?</p>
          <Link href="/login" className="mt-1 block text-sm font-extrabold text-lime-300 hover:underline">
            Log in
          </Link>
        </section>
      </div>
    </main>
  );
}
