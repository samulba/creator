import type { ReactNode } from "react";

const productionSteps = [
  ["Understanding gameplay", "Complete"],
  ["Finding key moments", "Complete"],
  ["Building the story", "Complete"],
  ["Creating narration", "Complete"],
  ["Building final edit", "Processing"],
] as const;

const workItems = [
  "reviewing footage",
  "finding meaningful moments",
  "deciding what the video is actually about",
  "writing narration",
  "cutting dead time",
  "creating pacing",
  "mixing audio",
  "rendering",
] as const;

const features = [
  {
    title: "Gameplay Intelligence",
    copy: "Maps the match, events, decisions, and turning points before production begins.",
  },
  {
    title: "Story Direction",
    copy: "Finds the narrative angle that makes the footage worth watching as a complete video.",
  },
  {
    title: "Context-Aware Narration",
    copy: "Develops narration that supports the edit instead of describing what viewers can already see.",
  },
  {
    title: "Automated Editing",
    copy: "Removes dead time, preserves important moments, and builds pacing around the story.",
  },
  {
    title: "Audio & Rendering",
    copy: "Connects voice, gameplay audio, timing, and final output into a single production pass.",
  },
  {
    title: "Reviewable Production",
    copy: "Keeps the pipeline inspectable so creative decisions can be understood before the final render.",
  },
] as const;

const pipeline = [
  "RAW GAMEPLAY",
  "UNDERSTAND",
  "STORY",
  "NARRATE",
  "EDIT",
  "RENDER",
  "FINAL VIDEO",
] as const;

function ArrowLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      className="group inline-flex items-center gap-3 rounded-full border border-white/12 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white transition duration-300 hover:border-sky-300/40 hover:bg-sky-300/10 focus:outline-none focus:ring-2 focus:ring-sky-300/60"
      href={href}
    >
      {children}
      <span aria-hidden="true" className="transition duration-300 group-hover:translate-x-1">
        →
      </span>
    </a>
  );
}

function WorkflowPreview() {
  return (
    <div className="relative mx-auto w-full max-w-xl overflow-hidden rounded-[2rem] border border-white/12 bg-[#07111f] shadow-2xl shadow-sky-950/30">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/60 to-transparent" />
      <div className="border-b border-white/10 px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Source</p>
            <p className="mt-1 font-mono text-sm text-slate-100">GAMEPLAY_042.mp4</p>
          </div>
          <div className="rounded-full border border-sky-300/30 px-3 py-1 font-mono text-xs text-sky-200">
            72%
          </div>
        </div>
      </div>
      <div className="space-y-1 p-5">
        {productionSteps.map(([label, status]) => (
          <div
            className="grid grid-cols-[1fr_auto] items-center gap-5 rounded-xl border border-transparent px-3 py-3 transition duration-300 hover:border-white/10 hover:bg-white/[0.025]"
            key={label}
          >
            <span className="text-sm text-slate-300">{label}</span>
            <span
              className={
                status === "Complete"
                  ? "font-mono text-xs uppercase tracking-[0.18em] text-slate-400"
                  : "font-mono text-xs uppercase tracking-[0.18em] text-sky-200"
              }
            >
              {status}
            </span>
          </div>
        ))}
      </div>
      <div className="px-8 pb-8">
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-[72%] rounded-full bg-sky-300" />
        </div>
        <div className="mt-6 grid grid-cols-3 gap-3 border-t border-white/10 pt-5 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-slate-500">
          <span>Analysis</span>
          <span>Timeline</span>
          <span>Render</span>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#03070f] text-slate-100">
      <header className="sticky top-0 z-50 border-b border-white/8 bg-[#03070f]/85 backdrop-blur-xl">
        <nav aria-label="Main navigation" className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <a className="text-sm font-black tracking-[0.32em] text-white" href="#top">CREATOR</a>
          <div className="hidden items-center gap-8 text-sm text-slate-400 md:flex">
            <a className="transition hover:text-white" href="#how-it-works">How it works</a>
            <a className="transition hover:text-white" href="#features">Features</a>
            <a className="transition hover:text-white" href="#workflow">Workflow</a>
            <a className="transition hover:text-white" href="#why-creator">Why Creator</a>
          </div>
          <a className="rounded-full border border-sky-300/30 px-4 py-2 text-sm font-semibold text-sky-100 transition hover:bg-sky-300/10 focus:outline-none focus:ring-2 focus:ring-sky-300/60" href="/app">Open Creator</a>
        </nav>
      </header>

      <section id="top" className="relative mx-auto grid max-w-7xl gap-16 px-5 pb-28 pt-24 sm:px-8 lg:grid-cols-[1fr_0.86fr] lg:items-center lg:pt-32">
        <div className="absolute left-1/2 top-0 -z-0 h-px w-screen -translate-x-1/2 bg-white/8" />
        <div className="relative z-10">
          <p className="text-xs font-bold uppercase tracking-[0.34em] text-sky-200">VIDEO PRODUCTION FOR GAMING CREATORS</p>
          <h1 className="mt-7 max-w-4xl text-5xl font-semibold tracking-[-0.055em] text-white sm:text-6xl lg:text-7xl">
            Your gameplay already has the content. Creator turns it into the video.
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300">
            Creator understands your footage, finds the story, builds the narration, creates the edit, and turns raw gameplay into polished long-form YouTube videos.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <a className="rounded-full bg-sky-200 px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-sky-300/60" href="/app">Open Creator</a>
            <ArrowLink href="#how-it-works">See how it works</ArrowLink>
          </div>
        </div>
        <WorkflowPreview />
      </section>

      <section className="border-y border-white/8 bg-white/[0.025] px-5 py-24 sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <h2 className="text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">Recording gameplay is easy. Turning it into a great video isn’t.</h2>
            <p className="mt-8 text-lg leading-8 text-slate-300">Creator turns that entire production process into one connected workflow.</p>
          </div>
          <ul className="grid gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 sm:grid-cols-2">
            {workItems.map((item) => (
              <li className="bg-[#050b15] p-6 text-slate-300" key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-7xl px-5 py-28 sm:px-8">
        <h2 className="max-w-3xl text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">From raw gameplay to finished video.</h2>
        <div className="mt-16 border-l border-white/12 lg:border-l-0">
          {[
            ["01", "Upload your gameplay", "Start with the recordings you already capture."],
            ["02", "Creator understands what happened", "Events, momentum shifts, decisions, and key moments become structured context."],
            ["03", "The story takes shape", "A narrative angle, pacing plan, and narration are developed around the actual match."],
            ["04", "The video is produced", "The timeline, audio, cuts, and render are assembled into a long-form YouTube video."],
          ].map(([number, title, copy]) => (
            <article className="grid gap-6 border-t border-white/12 py-8 pl-6 first:border-t-0 lg:grid-cols-[0.25fr_0.75fr] lg:pl-0" key={number}>
              <span className="font-mono text-sm text-sky-200">{number}</span>
              <div className="grid gap-3 lg:grid-cols-[0.45fr_0.55fr]">
                <h3 className="text-2xl font-semibold text-white">{title}</h3>
                <p className="leading-7 text-slate-400">{copy}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="features" className="bg-[#060d18] px-5 py-28 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <h2 className="max-w-3xl text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">One production pipeline. Every step connected.</h2>
          <div className="mt-16 grid gap-px overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <article className="min-h-64 bg-[#03070f] p-8 transition duration-300 hover:bg-[#07111f]" key={feature.title}>
                <p className="font-mono text-xs text-slate-500">0{index + 1}</p>
                <h3 className="mt-10 text-2xl font-semibold text-white">{feature.title}</h3>
                <p className="mt-5 leading-7 text-slate-400">{feature.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="why-creator" className="mx-auto grid max-w-7xl gap-12 px-5 py-28 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
        <div>
          <h2 className="text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">Not another AI clip generator.</h2>
          <p className="mt-8 text-lg leading-8 text-slate-300">Most automated video tools are built around short clips, captions, and recycled social content.</p>
          <p className="mt-5 text-lg leading-8 text-slate-300">Creator is being built for something harder: long-form YouTube videos where context, pacing, storytelling, and payoff actually matter.</p>
        </div>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[2rem] border border-white/10 bg-white/10">
          {['CONTEXT', 'STORY', 'PACING', 'PAYOFF'].map((word) => (
            <div className="bg-[#07111f] p-8 text-2xl font-semibold tracking-[-0.03em] text-white sm:p-10 sm:text-4xl" key={word}>{word}</div>
          ))}
        </div>
      </section>

      <section id="workflow" className="border-y border-white/8 bg-white/[0.025] px-5 py-24 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-3 lg:grid-cols-7 lg:items-center">
            {pipeline.map((stage, index) => (
              <div className="group relative rounded-2xl border border-white/10 bg-[#03070f] p-5 transition duration-300 hover:border-sky-300/30 hover:bg-[#07111f]" key={stage}>
                <p className="font-mono text-[0.65rem] text-slate-500">{String(index + 1).padStart(2, '0')}</p>
                <p className="mt-6 text-sm font-bold tracking-[0.14em] text-slate-100">{stage}</p>
                {index < pipeline.length - 1 ? <span className="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-slate-500 lg:block">→</span> : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 py-28 text-center sm:px-8">
        <h2 className="text-4xl font-semibold tracking-[-0.04em] text-white sm:text-6xl">Play the game. Let Creator handle the production.</h2>
        <p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-slate-300">Turn the gameplay you already record into videos worth watching.</p>
        <div className="mt-10">
          <a className="rounded-full bg-sky-200 px-7 py-4 text-sm font-bold text-slate-950 transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-sky-300/60" href="/app">Open Creator</a>
        </div>
      </section>

      <footer className="border-t border-white/8 px-5 py-10 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 text-sm text-slate-400 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-black tracking-[0.28em] text-white">Creator</p>
            <p className="mt-3">Video production for gaming creators.</p>
            <p className="mt-1">Built by Framepath.</p>
          </div>
          <div className="flex gap-6">
            <a className="transition hover:text-white" href="/privacy">Privacy</a>
            <a className="transition hover:text-white" href="mailto:contact@framepath.com">Contact</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
