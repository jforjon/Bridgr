"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Home, Repeat, UserCircle } from "lucide-react";

type BottomNavTab = "home" | "learn" | "review" | "profile";

interface BottomNavProps {
  activeTab: BottomNavTab;
  /** When false, Learn/Review navigate to /languages/add. Defaults to true. */
  hasLearningLanguage?: boolean;
}

function getTabClass(isActive: boolean) {
  return `flex flex-col items-center gap-1 ${isActive ? "text-primary" : "text-slate-600"}`;
}

export default function BottomNav({
  activeTab,
  hasLearningLanguage = true
}: BottomNavProps) {
  const router = useRouter();

  const goLearnOrAdd = () => {
    router.push(hasLearningLanguage ? "/learn" : "/languages/add");
  };

  const goReviewOrAdd = () => {
    router.push(hasLearningLanguage ? "/review" : "/languages/add");
  };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white">
      <div className="mx-auto grid w-full max-w-2xl grid-cols-4 px-2 py-2">
        <Link href="/dashboard" className={getTabClass(activeTab === "home")}>
          <Home className="h-5 w-5" />
          <span className="text-[11px] font-medium">Home</span>
        </Link>
        <button
          type="button"
          onClick={goLearnOrAdd}
          className={`${getTabClass(activeTab === "learn")} border-0 bg-transparent p-0`}
        >
          <BookOpen className="h-5 w-5" />
          <span className="text-[11px] font-medium">Learn</span>
        </button>
        <button
          type="button"
          onClick={goReviewOrAdd}
          className={`${getTabClass(activeTab === "review")} border-0 bg-transparent p-0`}
        >
          <Repeat className="h-5 w-5" />
          <span className="text-[11px] font-medium">Review</span>
        </button>
        <Link href="/profile" className={getTabClass(activeTab === "profile")}>
          <UserCircle className="h-5 w-5" />
          <span className="text-[11px] font-medium">Profile</span>
        </Link>
      </div>
    </nav>
  );
}
