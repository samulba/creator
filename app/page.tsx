import Link from "next/link";

import { buttonClassName } from "@/components/ui/button";
import { Wordmark } from "@/components/ui/wordmark";

const storyStages = [
  {
    label: "Raw gameplay",
    title: "The full match stays intact.",
    copy: "Creator starts with the recording you already have: quiet stretches, chases, mistakes, rescues, and the messy context that makes the payoff land.",
    detail: "Source 01:12:44 · uncut gameplay",
  },
  {
    label: "Understand",
    title: "The footage becomes structured context.",
    copy: "Match events, momentum shifts, player decisions, and candidate moments are organized before any story or edit is created.",
    detail: "37 events · 12 candidate moments",
  },
  {
    label: "Story",
    title: "A video angle emerges from the match.",
    copy: "Creator builds the hook, setup, escalation, turning point, climax, and payoff around what actually happened in the gameplay.",
    detail: "Angle: pressure into reversal",
  },
  {
    label: "Narrate",
    title: "Narration supports the edit.",
    copy: "Voiceover is written against the timeline so it adds context, tension, and rhythm instead of repeating what viewers can already see.",
    detail: "6 timestamped script sections",
  },
  {
    label: "Edit",
    title: "Pacing turns raw footage into a watchable video.",
    copy: "Dead time is removed, key moments are preserved, audio is balanced, and the final timeline is assembled for long-form YouTube viewing.",
    detail: "Timeline 12:48 · balanced density",
  },
  {
    label: "Final video",
    title: "A finished production is ready to review.",
    copy: "The result is a coherent long-form video with chapters, narration, edit decisions, and a render that can be inspected before approval.",
    detail: "Ready for review · version 01",
  },
] as const;

const proofPoints = [
  ["Context", "Understands why a moment matters before it cuts."],
  ["Story", "Shapes a hook, escalation, turning point, and payoff."],
  ["Pacing", "Keeps long-form rhythm instead of chasing isolated highlights."],
  ["Payoff", "Preserves the setup that makes the final moment worth watching."],
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
      className="mx-auto w-full max-w-6xl border border-edge-strong bg-surface p-1.5 shadow-[0_40px_120px_rgba(0,0,0,0.55)]"
    >
      <div className="grid min-h-[480px] border border-edge bg-canvas lg:grid-cols-[200px_260px_minmax(0,1fr)]">
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

function ScrollStory() {
  return (
    <section
      id="workflow"
      className="border-y border-edge bg-surface px-5 py-24 sm:px-8 lg:py-32"
    >
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="lg:sticky lg:top-28 lg:h-fit">
            <p className="text-xs font-semibold tracking-[0.3em] text-accent uppercase">
              The workflow
            </p>
            <h2 className="mt-6 text-5xl font-semibold tracking-[-0.05em] text-ink sm:text-6xl">
              A production sequence, not a clipping trick.
            </h2>
            <p className="mt-7 max-w-md text-lg leading-8 text-ink-secondary">
              Follow the work from raw gameplay to finished video. Each stage
              earns the next one.
            </p>
          </div>
          <div className="space-y-6">
            {storyStages.map((stage, index) => (
              <article
                className="sticky min-h-[380px] border border-edge bg-canvas p-6 lg:p-9"
                key={stage.label}
                style={{ top: `${96 + index * 10}px` }}
              >
                <div className="flex items-start justify-between gap-6 border-b border-edge pb-5">
                  <span className="tabular font-mono text-xs text-ink-muted">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="text-right text-xs font-semibold tracking-[0.24em] text-accent uppercase">
                    {stage.label}
                  </span>
                </div>
                <div className="mt-10 grid gap-10 md:grid-cols-[0.9fr_1.1fr] md:items-end">
                  <div>
                    <h3 className="text-3xl font-semibold tracking-[-0.04em] text-ink sm:text-4xl">
                      {stage.title}
                    </h3>
                    <p className="mt-5 leading-7 text-ink-secondary">
                      {stage.copy}
                    </p>
                  </div>
                  <div className="border border-edge bg-surface p-5">
                    <div className="h-32 border border-edge bg-canvas p-4">
                      <div className="h-full border-l-2 border-accent/60 pl-4 text-sm leading-6 text-ink-secondary">
                        {stage.detail}
                      </div>
                    </div>
                    <div className="mt-4 h-px bg-gradient-to-r from-accent via-edge-strong to-transparent" />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden">
      <header className="sticky top-0 z-50 border-b border-edge bg-canvas/90 backdrop-blur-xl">
        <nav
          aria-label="Main navigation"
          className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8"
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
            <a className="transition-colors hover:text-ink" href="#product">
              Product
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
      </header>

      <section className="relative px-5 pt-20 pb-20 sm:px-8 lg:pt-28 lg:pb-28">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-5xl">
            <p className="text-xs font-semibold tracking-[0.3em] text-accent uppercase">
              Long-form YouTube production for Dead by Daylight creators
            </p>
            <h1 className="mt-8 text-6xl font-semibold tracking-[-0.05em] text-ink sm:text-7xl lg:text-8xl">
              Your gameplay already has the content. Creator turns it into the
              video.
            </h1>
          </div>
          <div className="mt-10 grid gap-8 lg:grid-cols-[0.55fr_0.45fr] lg:items-end">
            <p className="max-w-2xl text-xl leading-9 text-ink-secondary">
              Creator understands the match, finds the story, writes
              timeline-aware narration, builds the edit, and renders a polished
              long-form video without turning your footage into disposable
              clips.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
              <Link href="/app" className={buttonClassName("primary")}>
                Open Creator
              </Link>
              <a href="#workflow" className={buttonClassName("secondary")}>
                Follow the sequence
              </a>
            </div>
          </div>
          <div id="product" className="mt-16">
            <ProductFrame />
          </div>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-12 border-y border-edge py-20 lg:grid-cols-[0.7fr_1.3fr] lg:items-center">
          <h2 className="text-4xl font-semibold tracking-[-0.045em] text-ink sm:text-6xl">
            Recording is the easy part.
          </h2>
          <p className="max-w-3xl text-2xl leading-10 text-ink-secondary">
            The hard part is understanding what happened, what should be kept,
            where the story turns, when narration should enter, and how the
            final video earns its payoff.
          </p>
        </div>
      </section>

      <ScrollStory />

      <section id="difference" className="px-5 py-28 sm:px-8 lg:py-36">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:items-end">
            <div>
              <p className="text-xs font-semibold tracking-[0.3em] text-accent uppercase">
                Not an AI clip generator
              </p>
              <h2 className="mt-6 text-5xl font-semibold tracking-[-0.05em] text-ink sm:text-7xl">
                Built for the shape of a real video.
              </h2>
            </div>
            <p className="text-xl leading-9 text-ink-secondary">
              Short-form tools optimize for extraction. Creator is designed
              around the full arc: the setup viewers need, the pacing that keeps
              them watching, and the payoff that makes the video feel authored.
            </p>
          </div>
          <div className="mt-16 grid gap-px border border-edge bg-edge lg:grid-cols-4">
            {proofPoints.map(([title, copy]) => (
              <article className="min-h-64 bg-canvas p-7" key={title}>
                <h3 className="text-3xl font-semibold tracking-[-0.045em] text-ink">
                  {title}
                </h3>
                <p className="mt-16 leading-7 text-ink-secondary">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-edge px-5 py-24 text-center sm:px-8 lg:py-32">
        <p className="mx-auto max-w-4xl text-5xl font-semibold tracking-[-0.05em] text-ink sm:text-7xl">
          Play the match. Keep the story. Ship the video.
        </p>
        <p className="mx-auto mt-8 max-w-2xl text-lg leading-8 text-ink-secondary">
          Open the Creator workspace and review the production interface behind
          this page.
        </p>
        <div className="mt-10">
          <Link href="/app" className={buttonClassName("primary")}>
            Open Creator
          </Link>
        </div>
      </section>

      <footer className="border-t border-edge px-5 py-10 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 text-sm text-ink-muted md:flex-row md:items-center md:justify-between">
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
