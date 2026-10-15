"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { IconCheck, IconChevronDown, IconPlus, IconWorld } from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/client";
import { SUPPORTED_LANGUAGES, type LearningLanguage } from "@/types";

export function LanguageFlag({ code, size = "text-xl" }: { code: string; size?: string }) {
  const flag = SUPPORTED_LANGUAGES.find((l) => l.code === code.toLowerCase())?.flag;
  if (flag) {
    return (
      <span className={`${size} leading-none`} aria-hidden>
        {flag}
      </span>
    );
  }
  return <IconWorld size={18} className="shrink-0 text-ink-secondary" stroke={1.75} aria-hidden />;
}

interface LanguageSwitcherProps {
  languages: LearningLanguage[];
  activeCode: string;
}

/**
 * Top-right course selector (Duolingo-style). Always visible so the user
 * always knows which language the screen's content belongs to.
 *
 * Selecting a language persists it as the active course by bumping
 * `learning_languages.last_accessed_at` — every page that resolves the
 * active language orders by that column. If the backend later grows a
 * `profiles.active_language_code`, swap the write here and nothing else.
 */
export default function LanguageSwitcher({ languages, activeCode }: LanguageSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname() ?? "/learn";
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const active =
    languages.find((l) => l.language_code.toLowerCase() === activeCode.toLowerCase()) ??
    languages[0];

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!active) return null;

  const selectLanguage = async (language: LearningLanguage) => {
    setOpen(false);
    if (language.language_code === active.language_code) return;
    setSwitching(true);
    try {
      const supabase = createClient();
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("learning_languages")
          .update({ last_accessed_at: new Date().toISOString() })
          .eq("user_id", user.id)
          .eq("language_code", language.language_code);
      }
    } catch {
      // Persisting is best-effort; the ?lang param below still switches the view.
    } finally {
      setSwitching(false);
    }
    const base = pathname.startsWith("/learn") ? "/learn" : pathname;
    router.push(`${base}?lang=${encodeURIComponent(language.language_code)}`);
    router.refresh();
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={switching}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Learning ${active.language_name}. Switch language`}
        className="chip tap-target disabled:opacity-60"
      >
        <LanguageFlag code={active.language_code} />
        <IconChevronDown
          size={14}
          stroke={2}
          className={`text-ink-tertiary transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="Your courses"
          className="menu absolute right-0 top-[calc(100%+8px)] z-50 w-64 overflow-hidden"
        >
          <p className="label-caps px-4 pb-1 pt-3">My courses</p>
          {languages.map((language) => {
            const isActive = language.language_code === active.language_code;
            return (
              <button
                key={language.id}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => void selectLanguage(language)}
                className="menu-item w-full text-left"
              >
                <LanguageFlag code={language.language_code} />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                  {language.language_name}
                </span>
                <span className="shrink-0 rounded-pill bg-card-2 px-2 py-0.5 text-[10px] font-bold uppercase text-ink-tertiary">
                  {language.cefr_level}
                </span>
                {isActive ? (
                  <IconCheck size={16} stroke={2.5} className="shrink-0 text-accent" aria-hidden />
                ) : null}
              </button>
            );
          })}
          <div className="border-t border-line">
            <Link
              href="/onboarding/4"
              className="menu-item"
              onClick={() => setOpen(false)}
            >
              <IconPlus size={18} stroke={1.75} aria-hidden />
              Add a new language
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
