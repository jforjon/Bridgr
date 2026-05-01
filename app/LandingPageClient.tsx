"use client";

import Link from "next/link";
import { useRef, useState } from "react";

const slides = [
  {
    emoji: "🔗",
    title: "Bridges not barriers",
    body: "Every new word connects to something you already know in another language"
  },
  {
    emoji: "🧠",
    title: "Science-backed retention",
    body: "Spaced repetition and retrieval practice keep words in your long-term memory"
  },
  {
    emoji: "🎯",
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
    <main className="min-h-screen">
      <div className="px-6 pt-8 flex items-center justify-between">
        <h1 className="font-serif text-3xl text-[#2D6A4F]">Bridgr</h1>
        <Link href="/login" className="text-sm text-[#2D6A4F]">
          Log in
        </Link>
      </div>

      <section className="px-6 mt-12">
        <h2 className="font-serif text-4xl font-normal leading-tight text-[#0F1A14]">
          Learn faster using the languages you already speak
        </h2>
        <p className="text-base text-slate-500 mt-4">
          The only app that builds on what you already know
        </p>
      </section>

      <section className="mt-10">
        <div
          ref={carouselRef}
          onScroll={handleScroll}
          className="flex overflow-x-auto snap-x snap-mandatory [scroll-snap-type:x_mandatory] scrollbar-none [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {slides.map((slide) => (
            <div key={slide.title} className="min-w-full snap-start px-6 py-2">
              <div className="rounded-3xl bg-white border border-slate-100 p-8 text-center">
                <p className="text-5xl mb-4">{slide.emoji}</p>
                <h3 className="font-serif text-2xl">{slide.title}</h3>
                <p className="text-sm text-slate-500 mt-3 leading-relaxed">{slide.body}</p>
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
                  ? "h-3 w-3 rounded-full bg-[#2D6A4F]"
                  : "h-2 w-2 rounded-full bg-slate-300"
              }
              aria-hidden="true"
            />
          ))}
        </div>
      </section>

      <section className="px-6 mt-10 pb-12">
        <Link
          href="/signup"
          className="block w-full bg-[#2D6A4F] text-white rounded-2xl py-4 font-semibold text-base text-center"
        >
          Start for free
        </Link>
        <Link
          href="/login"
          className="block w-full mt-3 border border-slate-200 text-slate-600 rounded-2xl py-4 font-medium text-base text-center"
        >
          I already have an account
        </Link>
      </section>
    </main>
  );
}
