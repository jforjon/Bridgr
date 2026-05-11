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
    <main className="min-h-screen bg-teal-900">
      <div className="flex items-center justify-between px-6 pt-8">
        <h1 className="font-sans text-3xl font-extrabold text-lime-300">Bridgr</h1>
        <Link href="/login" className="text-sm font-bold text-lime-300 hover:underline">
          Log in
        </Link>
      </div>

      <section className="mt-12 px-6">
        <h2 className="font-sans text-4xl font-extrabold leading-tight text-white">
          Learn faster using the languages you already speak
        </h2>
        <p className="mt-4 text-base text-teal-200">The only app that builds on what you already know</p>
      </section>

      <section className="mt-10">
        <div
          ref={carouselRef}
          onScroll={handleScroll}
          className="flex overflow-x-auto snap-x snap-mandatory [scroll-snap-type:x_mandatory] scrollbar-none [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {slides.map((slide) => (
            <div key={slide.title} className="min-w-full snap-start px-6 py-2">
              <div className="rounded-xl border border-teal-400/30 bg-teal-800 p-8 text-center">
                <div className="mb-4 flex justify-center" role="img" aria-label={slide.iconLabel}>
                  <slide.Icon size={48} className="text-lime-300" stroke={1.5} aria-hidden />
                </div>
                <h3 className="font-sans text-2xl font-extrabold text-white">{slide.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-teal-200">{slide.body}</p>
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
                  ? "h-3 w-3 rounded-full bg-lime-300"
                  : "h-2 w-2 rounded-full bg-teal-600"
              }
              aria-hidden="true"
            />
          ))}
        </div>
      </section>

      <section className="mt-10 px-6 pb-12">
        <Link
          href="/signup"
          className="block w-full rounded-full bg-lime-300 py-4 text-center text-base font-extrabold text-lime-700"
        >
          Start for free
        </Link>
        <Link
          href="/login"
          className="mt-3 block w-full rounded-full border border-teal-400/30 py-4 text-center text-base font-bold text-teal-200"
        >
          I already have an account
        </Link>
      </section>
    </main>
  );
}
