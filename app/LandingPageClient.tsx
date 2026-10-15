"use client";

import { IconBrain, IconLink, IconTarget } from "@tabler/icons-react";
import Link from "next/link";
import { useRef, useState } from "react";

const slides: {
  Icon: typeof IconLink;
  iconLabel: string;
  title: string;
  body: string;
}[] = [
  {
    Icon: IconLink,
    iconLabel: "Bridge",
    title: "Bridges not barriers",
    body: "Every new word connects to something you already know in another language"
  },
  {
    Icon: IconBrain,
    iconLabel: "Brain",
    title: "Science-backed retention",
    body: "Spaced repetition and retrieval practice keep words in your long-term memory"
  },
  {
    Icon: IconTarget,
    iconLabel: "Target",
    title: "Built for polyglots",
    body: "Made for people who already speak 2 or more languages and want to add another"
  }
];

export default function LandingPageClient() {
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);

  const handleScroll = () => {
    const container = carouselRef.current;
    if (!container) return;
    const width = container.clientWidth;
    if (!width) return;
    const nextIndex = Math.round(container.scrollLeft / width);
    setActiveSlide(Math.max(0, Math.min(slides.length - 1, nextIndex)));
  };

  return (
    <main className="min-h-screen bg-[var(--bg)]">
      <div className="px-page pt-8">
        <h1 className="text-2xl"><span className="font-black tracking-tight text-[var(--text-1)]">Bridg<span className="text-[var(--accent-text)]">r</span></span></h1>
      </div>

      <section className="px-page mt-12">
        <h2 className="font-sans text-4xl font-semibold leading-tight text-[var(--text-1)]">
          Learn faster using the languages you already speak
        </h2>
        <p className="mt-4 text-base text-[var(--text-2)]">The only app that builds on what you already know</p>
      </section>

      <section className="mt-10">
        <div
          ref={carouselRef}
          onScroll={handleScroll}
          className="flex overflow-x-auto snap-x snap-mandatory [scroll-snap-type:x_mandatory] scrollbar-none [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {slides.map((slide) => (
            <div key={slide.title} className="px-page min-w-full snap-start py-2">
              <div className="rounded-xl bg-[var(--surface-1)] p-8 text-center">
                <div className="mb-4 flex justify-center" role="img" aria-label={slide.iconLabel}>
                  <slide.Icon size={48} className="text-[var(--accent-text)]" stroke={1.5} aria-hidden />
                </div>
                <h3 className="font-sans text-2xl font-semibold text-[var(--text-1)]">{slide.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-[var(--text-2)]">{slide.body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-center gap-2">
          {slides.map((slide, index) => (
            <span
              key={slide.title}
              className={
                activeSlide === index
                  ? "h-3 w-3 rounded-pill bg-accent-fill hover:bg-accent-pressed"
                  : "h-2 w-2 rounded-full bg-[var(--surface-2)]"
              }
              aria-hidden="true"
            />
          ))}
        </div>
      </section>

      <section className="px-page mt-10 pb-12">
        <Link
          href="/signup"
          className="btn-primary w-full"
        >
          Start for free
        </Link>
        <Link
          href="/login"
          className="mt-3 block w-full rounded-pill bg-[var(--surface-2)] py-4 text-center text-base font-bold text-[var(--text-1)]"
        >
          I already have an account
        </Link>
      </section>
    </main>
  );
}
