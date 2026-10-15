"use client";

import { IconArrowLeft } from "@tabler/icons-react";
import { usePathname, useRouter } from "next/navigation";
import { OnboardingBackProvider, useOnboardingBackHandler } from "./OnboardingBackContext";
import { ONBOARDING_TOTAL_STEPS } from "./shared";

const backButtonClass =
  "flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full bg-[var(--surface-1)] text-[var(--text-2)] transition hover:opacity-90";

function OnboardingLayoutHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const customBackHandler = useOnboardingBackHandler();

  const stepMatch = pathname.match(/^\/onboarding\/(\d+)/);
  const currentStep = stepMatch ? Number(stepMatch[1]) : 1;
  const safeStep = Number.isNaN(currentStep)
    ? 1
    : Math.max(1, Math.min(ONBOARDING_TOTAL_STEPS, currentStep));

  const showBackButton = safeStep > 1;

  const handleBack = () => {
    if (customBackHandler) {
      customBackHandler();
      return;
    }
    router.back();
  };

  return (
    <div className="px-page pt-7">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {showBackButton ? (
            <button
              type="button"
              onClick={handleBack}
              aria-label="Go back"
              className={backButtonClass}
            >
              <IconArrowLeft size={18} stroke={1.75} aria-hidden />
            </button>
          ) : null}
          <span className="font-sans text-2xl font-bold tracking-tight text-[var(--text-1)]">
            Bridg<span className="text-[var(--accent-text)]">r</span>
          </span>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-label text-[var(--text-2)]">
          Step {safeStep} of {ONBOARDING_TOTAL_STEPS}
        </span>
      </div>
      <div className="progress-bar mt-4 h-[3px] w-full">
        <div
          className="progress-bar__fill duration-300"
          style={{ width: `${(safeStep / ONBOARDING_TOTAL_STEPS) * 100}%` }}
        />
      </div>
    </div>
  );
}

export default function OnboardingLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <OnboardingBackProvider>
      <div className="mx-auto min-h-screen w-full max-w-[480px] bg-[var(--bg)]">
        <OnboardingLayoutHeader />
        <div className="px-page pb-36 pt-8">{children}</div>
      </div>
    </OnboardingBackProvider>
  );
}
