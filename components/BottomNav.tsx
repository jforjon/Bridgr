import Link from "next/link";
import { BookOpen, Home, Repeat, UserCircle } from "lucide-react";

type BottomNavTab = "home" | "learn" | "review" | "profile";

interface BottomNavProps {
  activeTab: BottomNavTab;
}

function getTabClass(isActive: boolean) {
  return `flex flex-col items-center gap-1 ${isActive ? "text-primary" : "text-slate-600"}`;
}

export default function BottomNav({ activeTab }: BottomNavProps) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white">
      <div className="mx-auto grid w-full max-w-2xl grid-cols-4 px-2 py-2">
        <Link href="/dashboard" className={getTabClass(activeTab === "home")}>
          <Home className="h-5 w-5" />
          <span className="text-[11px] font-medium">Home</span>
        </Link>
        <Link href="/learn" className={getTabClass(activeTab === "learn")}>
          <BookOpen className="h-5 w-5" />
          <span className="text-[11px] font-medium">Learn</span>
        </Link>
        <Link href="/review" className={getTabClass(activeTab === "review")}>
          <Repeat className="h-5 w-5" />
          <span className="text-[11px] font-medium">Review</span>
        </Link>
        <Link href="/profile" className={getTabClass(activeTab === "profile")}>
          <UserCircle className="h-5 w-5" />
          <span className="text-[11px] font-medium">Profile</span>
        </Link>
      </div>
    </nav>
  );
}
