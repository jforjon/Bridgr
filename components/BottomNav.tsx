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

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-teal-700/50 bg-teal-900">
      <div className="mx-auto grid w-full max-w-2xl grid-cols-3 px-2 py-2">
        <Link
          href={learnHref(pathname, hasLearningLanguage)}
          className={`flex flex-col items-center gap-1 no-underline ${
            learnActive ? "text-lime-300 font-extrabold" : "text-teal-300 font-bold"
          }`}
        >
          <IconBook
            size={iconSize}
            stroke={1.75}
            className={learnActive ? "text-lime-300" : "text-teal-300"}
          />
          <span className="text-[11px]">Learn</span>
        </Link>
        <Link
          href={practiceHref(pathname, hasLearningLanguage)}
          className={`flex flex-col items-center gap-1 no-underline ${
            practiceActive ? "text-lime-300 font-extrabold" : "text-teal-300 font-bold"
          }`}
        >
          <IconCards
            size={iconSize}
            stroke={1.75}
            className={practiceActive ? "text-lime-300" : "text-teal-300"}
          />
          <span className="text-[11px]">Practice</span>
        </Link>
        <Link
          href="/profile"
          className={`flex flex-col items-center gap-1 no-underline ${
            profileActive ? "text-lime-300 font-extrabold" : "text-teal-300 font-bold"
          }`}
        >
          <IconUser
            size={iconSize}
            stroke={1.75}
            className={profileActive ? "text-lime-300" : "text-teal-300"}
          />
          <span className="text-[11px]">Profile</span>
        </Link>
      </div>
    </nav>
  );
}
