"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconBook, IconChartBar, IconTargetArrow } from "@tabler/icons-react";

type BottomNavTab = "home" | "learn" | "review" | "practice" | "profile" | "progress";

interface BottomNavProps {
  activeTab: BottomNavTab;
  /**
   * When explicitly false, Learn links to /onboarding/4 only while the user is
   * outside /learn and /practice. Inside those sections it always uses /learn.
   */
  hasLearningLanguage?: boolean;
  /** Items waiting in review — rendered as the badge on the Review tab. */
  reviewCount?: number;
  /** Scopes Review to the language the user is currently looking at. */
  activeLanguage?: string;
}

function inLearnOrPracticeSection(pathname: string): boolean {
  return pathname.startsWith("/learn") || pathname.startsWith("/practice");
}

function learnHref(pathname: string, hasLearningLanguage: boolean | undefined): string {
  if (inLearnOrPracticeSection(pathname)) return "/learn";
  if (hasLearningLanguage === false) return "/onboarding/4";
  return "/learn";
}

export default function BottomNav({
  activeTab,
  hasLearningLanguage = true,
  reviewCount = 0,
  activeLanguage
}: BottomNavProps) {
  const pathname = usePathname() ?? "";
  const iconSize = 24;

  const learnActive = activeTab === "learn" || activeTab === "home";
  const reviewActive = activeTab === "review" || activeTab === "practice";
  const progressActive = activeTab === "progress" || activeTab === "profile";

  const reviewHref = activeLanguage
    ? `/practice/review?lang=${encodeURIComponent(activeLanguage)}`
    : "/practice/review";

  /* Only the active tab carries a label — it expands into a capsule and is the
     one filled mark on the screen. The other two stay 24px icons. */
  const tabClass = (active: boolean) =>
    `navbar-tab no-underline ${active ? "navbar-tab--active" : ""}`;

  return (
    <nav
      className="fixed inset-x-4 z-40 mx-auto flex max-w-md flex-col gap-1"
      style={{ bottom: "max(env(safe-area-inset-bottom), 12px)" }}
    >
      <div className="navbar-float">
        <Link
          href={learnHref(pathname, hasLearningLanguage)}
          className={tabClass(learnActive)}
          aria-label="Learn"
          aria-current={learnActive ? "page" : undefined}
        >
          <IconBook size={iconSize} stroke={1.75} aria-hidden />
          {learnActive ? <span>Learn</span> : null}
        </Link>

        <Link
          href={reviewHref}
          className={tabClass(reviewActive)}
          aria-label={reviewCount > 0 ? `Review, ${reviewCount} waiting` : "Review"}
          aria-current={reviewActive ? "page" : undefined}
        >
          <span className="relative inline-flex">
            <IconTargetArrow size={iconSize} stroke={1.75} aria-hidden />
            {reviewCount > 0 && !reviewActive ? (
              <span className="notification absolute -right-4 -top-2.5" aria-hidden>
                {reviewCount > 99 ? "99+" : reviewCount}
              </span>
            ) : null}
          </span>
          {reviewActive ? <span>Review</span> : null}
        </Link>

        <Link
          href="/profile"
          className={tabClass(progressActive)}
          aria-label="Progress"
          aria-current={progressActive ? "page" : undefined}
        >
          <IconChartBar size={iconSize} stroke={1.75} aria-hidden />
          {progressActive ? <span>Progress</span> : null}
        </Link>
      </div>
    </nav>
  );
}
