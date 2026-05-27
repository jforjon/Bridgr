import Link from "next/link";

export default function HowItWorksPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl bg-[var(--bg)] px-6 py-12">
      <h1 className="text-3xl font-black tracking-tight text-[var(--text-primary)]">
        How <span className="font-black tracking-tight text-[var(--text-primary)]">Bridg<span className="text-[var(--accent)]">r</span></span> works
      </h1>
      <p className="mt-3 text-[var(--text-secondary)]">
        Learn faster by connecting new words to languages you already know.
      </p>

      <div className="mt-8 space-y-4">
        <section className="rounded-xl bg-[var(--card)] p-4">
          <h2 className="text-lg font-extrabold tracking-tighter text-[var(--text-primary)]">
            1. Set your language profile
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Choose a target language and tell us which languages you already speak.
          </p>
        </section>
        <section className="rounded-xl bg-[var(--card)] p-4">
          <h2 className="text-lg font-extrabold tracking-tighter text-[var(--text-primary)]">
            2. Learn with tailored hints
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Tap to reveal answers and get cross-language hints based on your known languages.
          </p>
        </section>
        <section className="rounded-xl bg-[var(--card)] p-4">
          <h2 className="text-lg font-extrabold tracking-tighter text-[var(--text-primary)]">
            3. Review due words daily
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Use spaced repetition to keep the right words active at the right time.
          </p>
        </section>
      </div>

      <div className="mt-8">
        <Link
          href="/signup"
          className="inline-flex rounded-pill bg-[#BFFF00] px-6 py-3 text-sm font-extrabold text-[#2A3800] transition-colors hover:bg-[#A8E000]"
        >
          Start for free
        </Link>
      </div>
    </main>
  );
}
