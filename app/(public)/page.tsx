import Link from "next/link";
import { Button } from "@/components/ui/button";
import "@fontsource/bitcount-grid-double";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <header className="flex w-full items-center justify-between px-8 py-6 sm:px-12">
        <span className="font-['Bitcount_Grid_Double'] text-2xl tracking-tight">
          Cortex
        </span>
        <nav className="flex items-center gap-2">
          <Link href="/auth/login">
            <Button variant="ghost" size="lg">
              Log in
            </Button>
          </Link>
          <Link href="/auth/sign-up">
            <Button size="lg">Get started</Button>
          </Link>
        </nav>
      </header>

      <main className="flex flex-1 flex-col items-center px-8 pb-24 sm:px-12">
        <section className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center py-20 text-center">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            AI-native active learning
          </span>

          <h1 className="font-['Bitcount_Grid_Double'] text-[clamp(4rem,14vw,12rem)] leading-[0.9] tracking-tight text-zinc-950 dark:text-zinc-50">
            Cortex
          </h1>

          <p className="mt-8 max-w-2xl text-balance text-lg text-zinc-700 sm:text-xl dark:text-zinc-300">
            Learn <em>through</em> AI, not chat with it. Cortex wraps any model in
            a teaching loop — explaining, quizzing, and resurfacing concepts on
            a spaced-repetition curve so knowledge actually sticks.
          </p>

          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
            <Link href="/auth/sign-up">
              <Button size="lg" className="h-10 px-5 text-sm">
                Start learning
              </Button>
            </Link>
            <Link href="/auth/login">
              <Button variant="outline" size="lg" className="h-10 px-5 text-sm">
                I already have an account
              </Button>
            </Link>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-5xl gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 sm:grid-cols-3 dark:border-zinc-800 dark:bg-zinc-800">
          <Feature
            title="Adaptive teaching"
            body="An orchestrator decides when to explain, quiz, or go Socratic — tuned to a live model of what you know."
          />
          <Feature
            title="Spaced repetition"
            body="Every concept sits on an SM-2 review curve. Cortex surfaces what's about to fade, before it does."
          />
          <Feature
            title="Mastery, mapped"
            body="Sessions build a concept graph with decaying mastery scores, so progress is something you can actually see."
          />
        </section>

        <p className="mx-auto mt-10 max-w-2xl text-center text-xs text-zinc-500 dark:text-zinc-500">
          The LLM is the knowledge engine. Cortex is the learning engine.
        </p>
      </main>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col gap-2 bg-white p-6 dark:bg-black">
      <h3 className="font-medium text-zinc-950 dark:text-zinc-50">{title}</h3>
      <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        {body}
      </p>
    </div>
  );
}
