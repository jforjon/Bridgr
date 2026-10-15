import Link from "next/link";

export default function HowItWorksPage() {
  return (
    <main className="px-page mx-auto min-h-screen w-full max-w-3xl bg-[var(--bg)] py-12">
      <h1 className="text-3xl font-bold tracking-tight text-[var(--text-1)]">
        How <span className="font-black tracking-tight text-[var(--text-1)]">Bridg<span className="text-[var(--accent-text)]">r</span></span> works
      </h1>
      <p className="mt-3 text-[var(--text-2)]">
        Learn faster by connecting new words to languages you already know.
      </p>

      <div className="mt-8 space-y-4">
        <section className="rounded-xl bg-[var(--surface-1)] p-4">
          <h2 className="text-lg font-semibold tracking-tighter text-[var(--text-1)]">
            1. Set your language profile
          </h2>
          <p className="mt-1 text-sm text-[var(--text-2)]">
            Choose a target language and tell us which languages you already speak.
          </p>
        </section>
        <section className="rounded-xl bg-[var(--surface-1)] p-4">
          <h2 className="text-lg font-semibold tracking-tighter text-[var(--text-1)]">
            2. Learn with tailored hints
          </h2>
          <p className="mt-1 text-sm text-[var(--text-2)]">
            Tap to reveal answers and get cross-language hints based on your known languages.
          </p>
        </section>
        <section className="rounded-xl bg-[var(--surface-1)] p-4">
          <h2 className="text-lg font-semibold tracking-tighter text-[var(--text-1)]">
            3. Review due words daily
          </h2>
          <p className="mt-1 text-sm text-[var(--text-2)]">
            Use spaced repetition to keep the right words active at the right time.
          </p>
        </section>
      </div>

      <div className="mt-8">
        <Link
          href="/signup"
          className="btn-primary"
        >
          Start for free
        </Link>
      </div>
    </main>
  );
}
