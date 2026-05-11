"use client";

import { ChevronLeft } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { ONBOARDING_TOTAL_STEPS } from "./shared";

export default function OnboardingLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const router = useRouter();

  const stepMatch = pathname.match(/^\/onboarding\/(\d+)/);
  const currentStep = stepMatch ? Number(stepMatch[1]) : 1;
  const safeStep = Number.isNaN(currentStep)
    ? 1
    : Math.max(1, Math.min(ONBOARDING_TOTAL_STEPS, currentStep));

  return (
    <div className="mx-auto min-h-screen w-full max-w-[480px] bg-teal-900">
      <div className="px-6 pt-7">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {safeStep > 1 ? (
              <button
                type="button"
                onClick={() => router.back()}
                aria-label="Go back"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-teal-400/30 bg-teal-800 text-white"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            ) : null}
            <span className="font-sans text-2xl font-extrabold text-lime-300">Bridgr</span>
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-teal-300">
            Step {safeStep} of {ONBOARDING_TOTAL_STEPS}
          </span>
        </div>
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-teal-700">
          <div
            className="h-full rounded-full bg-lime-300 transition-all duration-300"
            style={{ width: `${(safeStep / ONBOARDING_TOTAL_STEPS) * 100}%` }}
          />
        </div>
      </div>
      <div className="px-6 pb-36 pt-8">{children}</div>
    </div>
  );
}
