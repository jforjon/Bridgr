"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconBell } from "@tabler/icons-react";
import BottomNav from "@/components/BottomNav";
import { setupBeginnerCourseAndSkeleton } from "@/lib/beginner-course-flow";
import type { CEFRLevel } from "@/types";

export type LanguagePage = {
  code: string;
  name: string;
  level: CEFRLevel;
  wordCount: number;
  monthsLearning: number;
  cardsDue: number;
  hasCourse: boolean;
  currentUnitTitle: string | null;
  hasAvailableWork: boolean;
};

type Props = {
  name: string | null;
  pages: LanguagePage[];
  initialIndex: number;
  weeklyGoal: number;
  sessionsThisWeek: number;
  reviewCount: number;
};

/* Each language gets its own hero art. Until illustrations are supplied these
   are the handoff's striped placeholders, hue-shifted per language so paging
   reads as a change of place. */
const HERO_ART = [
  "repeating-linear-gradient(118deg, #2b3120 0 10px, #1e2318 10px 20px)",
  "repeating-linear-gradient(118deg, #1f2b31 0 10px, #182226 10px 20px)",
  "repeating-linear-gradient(118deg, #2f2733 0 10px, #221d26 10px 20px)",
  "repeating-linear-gradient(118deg, #33291f 0 10px, #261f18 10px 20px)",
  "repeating-linear-gradient(118deg, #1f3329 0 10px, #18261f 10px 20px)"
];

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "long"
});

function initialsFor(name: string | null): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "··";
  const parts = trimmed.split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}

/** ~30 seconds a card, rounded to whole minutes, floored at 1. */
function estimateMinutes(cards: number): number {
  return Math.max(1, Math.round(cards * 0.5));
}

export default function LearnHomeClient({
  name,
  pages,
  initialIndex,
  weeklyGoal,
  sessionsThisWeek,
  reviewCount
}: Props) {
  const router = useRouter();
  const pagerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [beginnerBuilding, setBeginnerBuilding] = useState("");
  const [beginnerError, setBeginnerError] = useState("");

  const today = useMemo(() => DATE_FORMAT.format(new Date()), []);
  const initials = useMemo(() => initialsFor(name), [name]);
  const activePage = pages[activeIndex] ?? pages[0];

  // Jump to the requested language without animating on first paint.
  useEffect(() => {
    const pager = pagerRef.current;
    if (!pager || initialIndex === 0) return;
    pager.scrollTo({ left: pager.clientWidth * initialIndex, behavior: "auto" });
    // Only on mount: after this the scroll position is the user's to control.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Paging is native scroll-snap, so the drag already tracks the finger 1:1 and
     the browser owns the release. All this does is keep the rail in step. */
  const handleScroll = useCallback(() => {
    const pager = pagerRef.current;
    if (!pager || pager.clientWidth === 0) return;
    const next = Math.round(pager.scrollLeft / pager.clientWidth);
    setActiveIndex((current) => (current === next ? current : Math.min(next, pages.length - 1)));
  }, [pages.length]);

  const goToPage = useCallback((index: number) => {
    const pager = pagerRef.current;
    if (!pager) return;
    pager.scrollTo({ left: pager.clientWidth * index, behavior: "smooth" });
  }, []);

  const runBeginnerFlow = async (page: LanguagePage) => {
    setBeginnerError("");
    setBeginnerBuilding(page.code);
    try {
      await setupBeginnerCourseAndSkeleton({
        languageCode: page.code,
        languageName: page.name
      });
      router.refresh();
    } catch (error) {
      setBeginnerError(error instanceof Error ? error.message : String(error));
    } finally {
      setBeginnerBuilding("");
    }
  };

  return (
    <>
      <main className="flex h-[100dvh] flex-col overflow-hidden bg-app">
        <div
          ref={pagerRef}
          onScroll={handleScroll}
          className="lang-pager flex-1"
          aria-label="Languages"
        >
          {pages.map((page, index) => {
            const cards = page.cardsDue;
            const sessionsDone = Math.min(sessionsThisWeek, weeklyGoal);
            const nextPage = pages[(index + 1) % pages.length];

            return (
              <section
                key={page.code}
                className="lang-page"
                aria-label={page.name}
                aria-hidden={index !== activeIndex}
              >
                <div
                  className="hero-lang"
                  style={{ backgroundImage: HERO_ART[index % HERO_ART.length] }}
                >
                  <div className="hero-lang__scrim" aria-hidden />

                  <div className="hero-lang__header">
                    <span className="label-caps !text-[var(--text-on-image-2)]">{today}</span>
                    <div className="flex gap-2">
                      <Link
                        href="/settings#notifications"
                        className="hero-lang__action"
                        aria-label="Notifications"
                      >
                        <IconBell size={24} stroke={1.75} aria-hidden />
                      </Link>
                      {/* The design puts the profile behind the avatar, but in
                          this app /profile *is* the stats screen the Progress
                          tab owns — so the avatar goes to account settings. */}
                      <Link href="/settings" className="hero-lang__avatar" aria-label="Your account">
                        {initials}
                      </Link>
                    </div>
                  </div>

                  <div className="hero-lang__block">
                    <span className="hero-lang__eyebrow">
                      {page.monthsLearning > 0
                        ? `Learning · ${page.monthsLearning} ${page.monthsLearning === 1 ? "month" : "months"}`
                        : "Just started"}
                    </span>
                    <span className="hero-lang__name">{page.name}</span>
                    <div className="hero-lang__meta">
                      <span>
                        {page.level} · {page.wordCount.toLocaleString()}{" "}
                        {page.wordCount === 1 ? "word" : "words"}
                      </span>
                      <span
                        className="h-1 w-1 shrink-0 rounded-pill bg-[var(--grey-500)]"
                        aria-hidden
                      />
                      <span className="hero-lang__meta-strong">
                        {sessionsDone} of {weeklyGoal} sessions
                      </span>
                    </div>
                    <div
                      className="session-pips"
                      role="img"
                      aria-label={`${sessionsDone} of ${weeklyGoal} sessions this week`}
                    >
                      {Array.from({ length: weeklyGoal }).map((_, pip) => (
                        <span
                          key={pip}
                          className={`session-pips__pip ${
                            pip < sessionsDone ? "session-pips__pip--filled" : ""
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* One mark per language, then an outline dot to add another.
                    Sits between the hero and the sheet. */}
                <nav className="pager-rail" aria-label="Switch language">
                  {pages.map((dot, dotIndex) => (
                    <button
                      key={dot.code}
                      type="button"
                      onClick={() => goToPage(dotIndex)}
                      className={`pager-rail__dot ${
                        dotIndex === index ? "pager-rail__dot--active" : ""
                      }`}
                      aria-label={dot.name}
                      aria-current={dotIndex === index}
                    />
                  ))}
                  <Link
                    href="/languages/add"
                    className="pager-rail__dot pager-rail__dot--add"
                    aria-label="Add a language"
                  />
                </nav>

                <div className="lang-sheet pb-[92px]">
                  {page.hasCourse ? (
                    <>
                      <button
                        type="button"
                        className="cta-session"
                        disabled={!page.hasAvailableWork && cards === 0}
                        /* The sub-line describes rather than names the action, so
                           the accessible name stays the title alone. */
                        aria-label="Start today’s session"
                        aria-describedby={`cta-sub-${page.code}`}
                        onClick={() =>
                          router.push(`/learn/${encodeURIComponent(page.code)}/session`)
                        }
                      >
                        <span className="flex flex-col">
                          <span className="cta-session__title">Start today&rsquo;s session</span>
                          <span className="cta-session__sub" id={`cta-sub-${page.code}`}>
                            {cards > 0
                              ? `${cards} ${cards === 1 ? "card" : "cards"} · about ${estimateMinutes(cards)} ${estimateMinutes(cards) === 1 ? "minute" : "minutes"}`
                              : "New cards, ready when you are"}
                          </span>
                        </span>
                        <span className="cta-session__go" aria-hidden>
                          →
                        </span>
                      </button>

                      <div className="card flex-none shadow-[inset_0_0_0_1px_var(--border)]">
                        <Link
                          href={`/practice/review?lang=${encodeURIComponent(page.code)}`}
                          className="list-row"
                        >
                          <svg width="24" height="24" viewBox="0 0 26 26" fill="none" className="flex-none" aria-hidden>
                            <rect x="4" y="4" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.75" />
                            <path d="M9 13h8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                          </svg>
                          <span className="list-row__body">
                            <span className="list-row__title">Translate sentences</span>
                            <span className="list-row__meta">
                              {cards} waiting · type your answer
                            </span>
                          </span>
                          <span className="list-row__chevron" aria-hidden>
                            ›
                          </span>
                        </Link>

                        <div className="ruled mx-6" role="presentation" />

                        <Link
                          href={`/practice/reading?lang=${encodeURIComponent(page.code)}`}
                          className="list-row"
                        >
                          <svg width="24" height="24" viewBox="0 0 26 26" fill="none" className="flex-none" aria-hidden>
                            <circle cx="13" cy="13" r="9" stroke="currentColor" strokeWidth="1.75" />
                            <path d="M13 8v10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                          </svg>
                          <span className="list-row__body">
                            <span className="list-row__title">
                              {page.currentUnitTitle
                                ? `Read «${page.currentUnitTitle}»`
                                : `Read in ${page.name}`}
                            </span>
                            <span className="list-row__meta">
                              2 min · {page.level} reading
                            </span>
                          </span>
                          <span className="list-row__chevron" aria-hidden>
                            ›
                          </span>
                        </Link>
                      </div>
                    </>
                  ) : (
                    /* No course yet — the language still gets a page, but the
                       action is to build the course rather than start a session. */
                    <div className="flex flex-col gap-4">
                      <p className="text-[15px] leading-relaxed text-ink-secondary">
                        A short placement test tailors your {page.name} course to what you already
                        know — no starting from &quot;hello&quot; if you&apos;re past it.
                      </p>
                      <Link
                        href={`/placement/${encodeURIComponent(page.code)}`}
                        className="btn-primary w-full"
                      >
                        Take the placement test
                      </Link>
                      <button
                        type="button"
                        onClick={() => void runBeginnerFlow(page)}
                        disabled={beginnerBuilding === page.code}
                        className="btn-secondary w-full"
                      >
                        {beginnerBuilding === page.code
                          ? "Building your course…"
                          : "I’m a complete beginner"}
                      </button>
                      {beginnerError ? (
                        <p className="field-help field-help--error text-center">{beginnerError}</p>
                      ) : null}
                    </div>
                  )}

                  {pages.length > 1 ? (
                    <div className="flex flex-none items-center justify-between">
                      <button
                        type="button"
                        className="label-caps text-left"
                        onClick={() => goToPage((index + 1) % pages.length)}
                      >
                        Swipe for {nextPage.name} →
                      </button>
                      <span className="label-caps">
                        {index + 1} / {pages.length}
                      </span>
                    </div>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>

      </main>

      <BottomNav activeTab="learn" reviewCount={reviewCount} activeLanguage={activePage?.code} />
    </>
  );
}
