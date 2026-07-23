import Link from "next/link";

import { Reveal, ScrollProgress } from "@/components/landing/reveal";
import { ScrollStory } from "@/components/landing/scroll-story";
import { buttonClassName } from "@/components/ui/button";
import { Wordmark } from "@/components/ui/wordmark";

const proofPoints = [
  ["Context", "Understands why a moment matters before it cuts."],
  ["Story", "Shapes a hook, escalation, turning point, and payoff."],
  ["Pacing", "Keeps long-form rhythm instead of chasing highlights."],
  ["Payoff", "Preserves the setup that makes the ending worth watching."],
] as const;

/**
 * Static interface preview that mirrors the real /app workspace layout:
 * sidebar, project library, and workspace panel with the same tokens.
 */
function ProductFrame() {
  const frameProjects = [
    ["The Ghost Face Who Wouldn’t Leave Me Alone", "Ready", "text-ok"],
    ["Huntress Match 042", "Processing", "text-info"],
    ["Gameplay 039", "Rendering", "text-info"],
  ] as const;

  return (
    <div
      aria-hidden="true"
      className="mx-auto w-full max-w-5xl border border-edge-strong bg-surface p-1.5 shadow-[0_40px_120px_rgba(0,0,0,0.55)]"
    >
      <div className="grid min-h-[440px] border border-edge bg-canvas lg:grid-cols-[200px_260px_minmax(0,1fr)]">
        <aside className="hidden flex-col border-r border-edge lg:flex">
          <div className="border-b border-edge px-4 py-4">
            <Wordmark size="sm" />
            <p className="mt-1 text-[11px] text-ink-muted">Video production</p>
          </div>
          <div className="space-y-0.5 px-2.5 py-3 text-[13px]">
            <div className="rounded-sm bg-raised px-2.5 py-1.5 font-medium text-ink">
              Projects
            </div>
            <div className="px-2.5 py-1.5 text-ink-secondary">New video</div>
            <div className="px-2.5 py-1.5 text-ink-muted">Settings</div>
          </div>
        </aside>

        <section className="border-b border-edge lg:border-r lg:border-b-0">
          <div className="flex items-center justify-between border-b border-edge px-4 py-3.5">
            <p className="text-[13px] font-semibold text-ink">Projects</p>
            <span className="rounded-sm border border-accent bg-accent px-2 py-1 text-[11px] font-medium text-accent-ink">
              New video
            </span>
          </div>
          <ul>
            {frameProjects.map(([title, status, tone], index) => (
              <li
                key={title}
                className={`relative border-b border-edge px-4 py-3 ${index === 0 ? "bg-raised" : ""}`}
              >
                {index === 0 ? (
                  <span className="absolute inset-y-0 left-0 w-0.5 bg-accent" />
                ) : null}
                <p
                  className={`text-[13px] leading-5 ${index === 0 ? "font-medium text-ink" : "text-ink-secondary"}`}
                >
                  {title}
                </p>
                <p className={`mt-1.5 text-[11px] font-medium ${tone}`}>
                  ● {status}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex min-w-0 flex-col">
          <div className="border-b border-edge px-5 pt-4">
            <p className="text-[11px] font-medium text-ok">● Ready</p>
            <p className="mt-2 text-lg leading-6 font-semibold tracking-tight text-ink">
              The Ghost Face Who Wouldn’t Leave Me Alone
            </p>
            <div className="mt-4 flex gap-5 text-[13px]">
              {["Overview", "Story", "Script", "Edit", "Output"].map(
                (tab, index) => (
                  <span
                    key={tab}
                    className={`border-b-2 pb-2 ${index === 0 ? "border-accent font-medium text-ink" : "border-transparent text-ink-secondary"}`}
                  >
                    {tab}
                  </span>
                ),
              )}
            </div>
          </div>
          <div className="flex-1 px-5 py-5">
            <div className="flex aspect-video flex-col justify-between border border-edge bg-black/40 p-4">
              <div className="h-1 w-24 bg-accent" />
              <div>
                <p className="text-[11px] tracking-[0.2em] text-ink-muted uppercase">
                  Final video
                </p>
                <p className="tabular mt-2 font-mono text-3xl font-semibold text-ink">
                  10:42
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-px bg-edge">
              {["Hook", "Turning point", "Payoff"].map((beat) => (
                <div
                  key={beat}
                  className="bg-canvas px-3 py-2.5 text-[11px] text-ink-secondary"
                >
                  {beat}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-edge bg-canvas/90 backdrop-blur-xl">
        <nav
          aria-label="Main navigation"
          className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8"
        >
          <Link href="/" className="inline-flex">
            <Wordmark />
          </Link>
          <div className="hidden items-center gap-8 text-sm text-ink-secondary md:flex">
            <a className="transition-colors hover:text-ink" href="#workflow">
              Workflow
            </a>
            <a className="transition-colors hover:text-ink" href="#difference">
              Difference
            </a>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login" className={buttonClassName("ghost", "sm")}>
              Log in
            </Link>
            <Link href="/app" className={buttonClassName("primary", "sm")}>
              Open Creator
            </Link>
          </div>
        </nav>
        <ScrollProgress />
      </header>

      <section className="px-5 pt-24 pb-24 sm:px-8 lg:pt-36">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold tracking-[0.3em] text-accent uppercase">
              Long-form YouTube production for Dead by Daylight
            </p>
            <h1 className="mt-7 text-5xl font-semibold tracking-[-0.045em] text-ink sm:text-6xl lg:text-7xl">
              Your gameplay already has the content.
            </h1>
            <p className="mx-auto mt-7 max-w-xl text-lg leading-8 text-ink-secondary">
              Creator understands the match, finds the story, writes the
              narration, and builds the edit — a finished long-form video, not
              disposable clips.
            </p>
            <div className="mt-9 flex justify-center gap-3">
              <Link href="/app" className={buttonClassName("primary")}>
                Open Creator
              </Link>
              <a href="#workflow" className={buttonClassName("secondary")}>
                See how it works
              </a>
            </div>
          </Reveal>
          <Reveal className="mt-20" delay={150}>
            <ProductFrame />
          </Reveal>
        </div>
      </section>

      <section className="px-5 pb-28 sm:px-8">
        <Reveal className="mx-auto max-w-3xl border-t border-edge pt-20 text-center">
          <h2 className="text-3xl font-semibold tracking-[-0.04em] text-ink sm:text-4xl">
            Recording is the easy part.
          </h2>
          <p className="mt-6 text-lg leading-8 text-ink-secondary">
            The hard part is knowing what to keep, where the story turns, and
            how the final video earns its payoff.
          </p>
        </Reveal>
      </section>

      <ScrollStory />

      <section id="difference" className="px-5 py-28 sm:px-8 lg:py-36">
        <div className="mx-auto max-w-6xl">
          <Reveal className="max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.3em] text-accent uppercase">
              Not an AI clip generator
            </p>
            <h2 className="mt-5 text-3xl font-semibold tracking-[-0.04em] text-ink sm:text-5xl">
              Built for the shape of a real video.
            </h2>
          </Reveal>
          <div className="mt-14 grid gap-px border border-edge bg-edge sm:grid-cols-2 lg:grid-cols-4">
            {proofPoints.map(([title, copy], index) => (
              <Reveal key={title} delay={index * 90} className="bg-canvas">
                <article className="h-full p-7">
                  <h3 className="text-xl font-semibold tracking-[-0.02em] text-ink">
                    {title}
                  </h3>
                  <p className="mt-4 text-sm leading-6 text-ink-secondary">
                    {copy}
                  </p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-edge px-5 py-28 text-center sm:px-8 lg:py-36">
        <Reveal>
          <p className="mx-auto max-w-3xl text-4xl font-semibold tracking-[-0.045em] text-ink sm:text-6xl">
            Play the match.
            <br />
            Ship the video.
          </p>
          <div className="mt-10">
            <Link href="/app" className={buttonClassName("primary")}>
              Open Creator
            </Link>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-edge px-5 py-10 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 text-sm text-ink-muted md:flex-row md:items-center md:justify-between">
          <div>
            <Wordmark size="sm" />
            <p className="mt-3">
              Premium long-form video production for gaming creators.
            </p>
          </div>
          <a
            className="transition-colors hover:text-ink"
            href="https://framepath.de"
            rel="noreferrer"
            target="_blank"
          >
            Built by Framepath
          </a>
        </div>
      </footer>
    </main>
  );
}
