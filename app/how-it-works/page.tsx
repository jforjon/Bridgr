import Link from "next/link";

export default function HowItWorksPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold text-primary">How Bridgr works</h1>
      <p className="mt-3 text-slate-600">
        Learn faster by connecting new words to languages you already know.
      </p>

      <div className="mt-8 space-y-4">
        <section className="rounded-xl border border-slate-200 p-4">
          <h2 className="text-lg font-semibold text-slate-900">1. Set your language profile</h2>
          <p className="mt-1 text-sm text-slate-600">
            Choose a target language and tell us which languages you already speak.
          </p>
        </section>
        <section className="rounded-xl border border-slate-200 p-4">
          <h2 className="text-lg font-semibold text-slate-900">2. Learn with tailored hints</h2>
          <p className="mt-1 text-sm text-slate-600">
            Tap to reveal answers and get cross-language hints based on your known languages.
          </p>
        </section>
        <section className="rounded-xl border border-slate-200 p-4">
          <h2 className="text-lg font-semibold text-slate-900">3. Review due words daily</h2>
          <p className="mt-1 text-sm text-slate-600">
            Use spaced repetition to keep the right words active at the right time.
          </p>
        </section>
      </div>

      <div className="mt-8">
        <Link
          href="/signup"
          className="inline-flex rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white hover:bg-primary-700 transition-colors"
        >
          Start for free
        </Link>
      </div>
    </main>
  );
}
