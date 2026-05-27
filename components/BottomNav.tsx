"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconBook, IconCards, IconUser } from "@tabler/icons-react";

type BottomNavTab = "home" | "learn" | "review" | "practice" | "profile";

interface BottomNavProps {
  activeTab: BottomNavTab;
  /**
   * When explicitly false, Learn/Practice link to /onboarding/4 only while
   * the user is outside /learn and /practice. Inside those sections, tabs
   * always use /learn and /practice.
   */
  hasLearningLanguage?: boolean;
}

function inLearnOrPracticeSection(pathname: string): boolean {
  return pathname.startsWith("/learn") || pathname.startsWith("/practice");
}

function learnHref(pathname: string, hasLearningLanguage: boolean | undefined): string {
  if (inLearnOrPracticeSection(pathname)) return "/learn";
  if (hasLearningLanguage === false) return "/onboarding/4";
  return "/learn";
}

function practiceHref(pathname: string, hasLearningLanguage: boolean | undefined): string {
  if (inLearnOrPracticeSection(pathname)) return "/practice";
  if (hasLearningLanguage === false) return "/onboarding/4";
  return "/practice";
}

export default function BottomNav({
  activeTab,
  hasLearningLanguage = true
}: BottomNavProps) {
  const pathname = usePathname() ?? "";
  const iconSize = 22;

  const learnActive = activeTab === "learn" || activeTab === "home";
  const practiceActive = activeTab === "practice" || activeTab === "review";
  const profileActive = activeTab === "profile";

  const tabClass = (active: boolean) =>
    `flex flex-col items-center gap-1 no-underline ${
      active
        ? "font-bold text-[var(--accent)]"
        : "font-bold text-[var(--text-secondary)]"
    }`;

  const labelClass = "text-[9px] font-bold uppercase tracking-label";

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--card)]">
      <div className="mx-auto grid w-full max-w-2xl grid-cols-3 px-2 py-2">
        <Link href={learnHref(pathname, hasLearningLanguage)} className={tabClass(learnActive)}>
          <IconBook
            size={iconSize}
            stroke={1.75}
            className={learnActive ? "text-[var(--accent)]" : "text-[var(--text-secondary)]"}
          />
          <span className={labelClass}>Learn</span>
        </Link>
        <Link href={practiceHref(pathname, hasLearningLanguage)} className={tabClass(practiceActive)}>
          <IconCards
            size={iconSize}
            stroke={1.75}
            className={practiceActive ? "text-[var(--accent)]" : "text-[var(--text-secondary)]"}
          />
          <span className={labelClass}>Practice</span>
        </Link>
        <Link href="/profile" className={tabClass(profileActive)}>
          <IconUser
            size={iconSize}
            stroke={1.75}
            className={profileActive ? "text-[var(--accent)]" : "text-[var(--text-secondary)]"}
          />
          <span className={labelClass}>Profile</span>
        </Link>
      </div>
    </nav>
  );
}
