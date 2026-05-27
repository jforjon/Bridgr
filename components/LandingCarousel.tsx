"use client";

import { IconBrain, IconLink, IconTarget } from "@tabler/icons-react";
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
    body: "Made for people who already speak 2+ languages and want to add another"
  }
];

export default function LandingCarousel() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) return;
    const width = container.clientWidth;
    if (!width) return;
    const nextIndex = Math.round(container.scrollLeft / width);
    setActiveIndex(Math.max(0, Math.min(slides.length - 1, nextIndex)));
  };

  return (
    <section className="mt-7">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex flex-row overflow-x-auto snap-x snap-mandatory rounded-2xl bg-[var(--card)] scrollbar-none [-webkit-overflow-scrolling:touch] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((slide) => (
          <article
            key={slide.title}
            className="flex min-w-full shrink-0 snap-start flex-col items-center justify-center px-6 py-8 text-center"
          >
            <span role="img" aria-label={slide.iconLabel} className="flex justify-center leading-none">
              <slide.Icon size={48} className="text-[var(--accent)]" stroke={1.5} aria-hidden />
            </span>
            <h3 className="mt-5 text-xl font-extrabold tracking-tighter text-[var(--text-primary)]">
              {slide.title}
            </h3>
            <p className="mt-3 max-w-xs text-sm leading-6 text-[var(--text-secondary)]">{slide.body}</p>
          </article>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-center gap-2">
        {slides.map((slide, index) => (
          <span
            key={slide.title}
            className={`h-2.5 w-2.5 rounded-pill ${
              activeIndex === index ? "bg-[#BFFF00]" : "bg-[var(--card-2)]"
            }`}
            aria-hidden="true"
          />
        ))}
      </div>
    </section>
  );
}
