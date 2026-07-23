const storyStages = [
  {
    label: "RAW GAMEPLAY",
    title: "The full match stays intact.",
    copy: "Creator starts with the recording you already have: quiet stretches, chases, mistakes, rescues, and the messy context that makes the payoff land.",
    detail: "Source 01:12:44 · uncut gameplay",
  },
  {
    label: "UNDERSTAND",
    title: "The footage becomes structured context.",
    copy: "Match events, momentum shifts, player decisions, and candidate moments are organized before any story or edit is created.",
    detail: "37 events · 12 candidate moments",
  },
  {
    label: "STORY",
    title: "A video angle emerges from the match.",
    copy: "Creator builds the hook, setup, escalation, turning point, climax, and payoff around what actually happened in the gameplay.",
    detail: "Angle: pressure into reversal",
  },
  {
    label: "NARRATE",
    title: "Narration supports the edit.",
    copy: "Voiceover is written against the timeline so it adds context, tension, and rhythm instead of repeating what viewers can already see.",
    detail: "6 timestamped script sections",
  },
  {
    label: "EDIT",
    title: "Pacing turns raw footage into a watchable video.",
    copy: "Dead time is removed, key moments are preserved, audio is balanced, and the final timeline is assembled for long-form YouTube viewing.",
    detail: "Timeline 12:48 · balanced density",
  },
  {
    label: "FINAL VIDEO",
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

function OpenCreatorLink({
  children,
  variant = "primary",
}: {
  children: string;
  variant?: "primary" | "secondary";
}) {
  const className =
    variant === "primary"
      ? "inline-flex items-center justify-center border border-[#d6b46a] bg-[#d6b46a] px-5 py-3 text-sm font-semibold text-[#10100e] transition duration-300 hover:border-[#f0d58d] hover:bg-[#f0d58d] focus:outline-none focus:ring-2 focus:ring-[#d6b46a]/50 focus:ring-offset-2 focus:ring-offset-[#070706]"
      : "inline-flex items-center justify-center border border-stone-700/80 bg-stone-950/30 px-5 py-3 text-sm font-semibold text-stone-100 transition duration-300 hover:border-stone-500 hover:bg-stone-900/70 focus:outline-none focus:ring-2 focus:ring-[#d6b46a]/40 focus:ring-offset-2 focus:ring-offset-[#070706]";

  return (
    <a className={className} href="/app">
      {children}
      <span aria-hidden="true" className="ml-3">
        ↗
      </span>
    </a>
  );
}

function ProductFrame() {
  return (
    <div className="relative mx-auto w-full max-w-6xl border border-stone-700/70 bg-[#0b0b0a] p-2 shadow-[0_40px_120px_rgba(0,0,0,0.55)]">
      <div className="grid min-h-[520px] border border-stone-800 bg-[#11110f] lg:grid-cols-[270px_minmax(0,1fr)]">
        <aside className="border-b border-stone-800 bg-[#0a0a09] p-5 lg:border-b-0 lg:border-r">
          <div className="text-lg font-semibold tracking-tight text-stone-50">
            Creator
          </div>
          <p className="mt-1 text-xs text-stone-500">Video production</p>
          <div className="mt-10 space-y-2">
            {["Projects", "New Video", "Settings"].map((item, index) => (
              <div
                className={`border px-3 py-2 text-sm ${index === 0 ? "border-stone-700 bg-stone-900/80 text-stone-50" : "border-transparent text-stone-500"}`}
                key={item}
              >
                {item}
              </div>
            ))}
          </div>
        </aside>
        <div className="grid gap-px bg-stone-800/80 lg:grid-cols-[0.62fr_1fr]">
          <section className="bg-[#11110f] p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-stone-50">
                  Projects
                </h2>
                <p className="mt-1 text-sm text-stone-500">
                  One production per match
                </p>
              </div>
              <div className="bg-[#d6b46a] px-3 py-2 text-xs font-semibold text-stone-950">
                New Video
              </div>
            </div>
            <div className="mt-7 space-y-3">
              {[
                "The Ghost Face Who Wouldn’t Leave Me Alone",
                "Huntress Match 042",
                "Gameplay 039",
              ].map((project, index) => (
                <div
                  className={`border p-4 ${index === 0 ? "border-[#d6b46a]/45 bg-[#19160f]" : "border-stone-800 bg-[#0c0c0b]"}`}
                  key={project}
                >
                  <p className="text-sm font-medium text-stone-100">
                    {project}
                  </p>
                  <p className="mt-2 text-xs text-stone-500">
                    {index === 0
                      ? "Final video ready for review"
                      : index === 1
                        ? "Finding important moments"
                        : "Assembling final video"}
                  </p>
                </div>
              ))}
            </div>
          </section>
          <section className="bg-[#11110f] p-5 sm:p-7">
            <div className="inline-flex border border-[#d6b46a]/35 bg-[#d6b46a]/10 px-3 py-1 text-xs font-medium text-[#f0d58d]">
              Ready
            </div>
            <h3 className="mt-4 max-w-xl text-3xl font-semibold tracking-[-0.035em] text-stone-50">
              The Ghost Face Who Wouldn’t Leave Me Alone
            </h3>
            <div className="mt-8 aspect-video border border-stone-700 bg-[linear-gradient(135deg,#171713,#060606)] p-4">
              <div className="flex h-full flex-col justify-between border border-stone-800 bg-black/30 p-4">
                <div className="h-2 w-28 bg-[#d6b46a]" />
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
                    Final video
                  </p>
                  <p className="mt-3 text-4xl font-semibold tracking-[-0.06em] text-stone-100">
                    12:48
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-5 grid gap-px bg-stone-800 sm:grid-cols-3">
              {["Hook", "Turning point", "Payoff"].map((item) => (
                <div
                  className="bg-[#0b0b0a] p-3 text-xs text-stone-400"
                  key={item}
                >
                  {item}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function ScrollStory() {
  return (
    <section
      id="workflow"
      className="border-y border-stone-800 bg-[#0b0b0a] px-5 py-24 sm:px-8 lg:py-32"
    >
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="lg:sticky lg:top-28 lg:h-fit">
            <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[#d6b46a]">
              Scroll story
            </p>
            <h2 className="mt-6 text-5xl font-semibold tracking-[-0.06em] text-stone-50 sm:text-6xl">
              A production sequence, not a clipping trick.
            </h2>
            <p className="mt-7 max-w-md text-lg leading-8 text-stone-400">
              Follow the work from raw gameplay to finished video. Each stage
              earns the next one.
            </p>
          </div>
          <div className="space-y-6">
            {storyStages.map((stage, index) => (
              <article
                className="group sticky top-24 min-h-[390px] border border-stone-800 bg-[#11110f] p-6 transition duration-500 lg:p-9"
                key={stage.label}
                style={{ top: `${96 + index * 10}px` }}
              >
                <div className="flex items-start justify-between gap-6 border-b border-stone-800 pb-6">
                  <span className="font-mono text-xs text-stone-500">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="text-right text-xs font-semibold uppercase tracking-[0.28em] text-[#d6b46a]">
                    {stage.label}
                  </span>
                </div>
                <div className="mt-12 grid gap-10 md:grid-cols-[0.9fr_1.1fr] md:items-end">
                  <div>
                    <h3 className="text-3xl font-semibold tracking-[-0.045em] text-stone-50 sm:text-4xl">
                      {stage.title}
                    </h3>
                    <p className="mt-5 leading-7 text-stone-400">
                      {stage.copy}
                    </p>
                  </div>
                  <div className="border border-stone-800 bg-[#070706] p-5">
                    <div className="h-36 border border-stone-800 bg-[linear-gradient(110deg,#171713,#0a0a09_52%,#211d13)] p-4">
                      <div className="h-full border-l border-[#d6b46a]/50 pl-4 text-sm text-stone-300">
                        {stage.detail}
                      </div>
                    </div>
                    <div className="mt-4 h-px bg-gradient-to-r from-[#d6b46a] via-stone-700 to-transparent" />
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
    <main className="min-h-screen overflow-hidden bg-[#070706] text-stone-100">
      <header className="sticky top-0 z-50 border-b border-stone-800/80 bg-[#070706]/88 backdrop-blur-xl">
        <nav
          aria-label="Main navigation"
          className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8"
        >
          <a
            className="text-sm font-semibold tracking-[0.34em] text-stone-50"
            href="#top"
          >
            CREATOR
          </a>
          <div className="hidden items-center gap-8 text-sm text-stone-500 md:flex">
            <a className="transition hover:text-stone-100" href="#workflow">
              Workflow
            </a>
            <a className="transition hover:text-stone-100" href="#difference">
              Difference
            </a>
            <a className="transition hover:text-stone-100" href="#product">
              Product
            </a>
          </div>
          <OpenCreatorLink variant="secondary">Open Creator</OpenCreatorLink>
        </nav>
      </header>

      <section
        id="top"
        className="relative px-5 pb-20 pt-20 sm:px-8 lg:pb-28 lg:pt-28"
      >
        <div className="mx-auto max-w-7xl">
          <div className="max-w-5xl">
            <p className="text-xs font-semibold uppercase tracking-[0.36em] text-[#d6b46a]">
              Long-form YouTube production for Dead by Daylight creators
            </p>
            <h1 className="mt-8 text-6xl font-semibold tracking-[-0.075em] text-stone-50 sm:text-7xl lg:text-8xl">
              Your gameplay already has the content. Creator turns it into the
              video.
            </h1>
          </div>
          <div className="mt-10 grid gap-8 lg:grid-cols-[0.55fr_0.45fr] lg:items-end">
            <p className="max-w-2xl text-xl leading-9 text-stone-400">
              Creator understands the match, finds the story, writes
              timeline-aware narration, builds the edit, and renders a polished
              long-form video without turning your footage into disposable
              clips.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
              <OpenCreatorLink>Open Creator</OpenCreatorLink>
              <a
                className="inline-flex items-center justify-center border border-stone-700/80 px-5 py-3 text-sm font-semibold text-stone-200 transition hover:border-stone-500"
                href="#workflow"
              >
                Watch the sequence
              </a>
            </div>
          </div>
          <div id="product" className="mt-16">
            <ProductFrame />
          </div>
        </div>
      </section>

      <section className="px-5 py-24 sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-12 border-y border-stone-800 py-20 lg:grid-cols-[0.7fr_1.3fr] lg:items-center">
          <h2 className="text-4xl font-semibold tracking-[-0.055em] text-stone-50 sm:text-6xl">
            Recording is the easy part.
          </h2>
          <p className="max-w-3xl text-2xl leading-10 text-stone-300">
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
              <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[#d6b46a]">
                Not an AI clip generator
              </p>
              <h2 className="mt-6 text-5xl font-semibold tracking-[-0.06em] text-stone-50 sm:text-7xl">
                Built for the shape of a real video.
              </h2>
            </div>
            <p className="text-xl leading-9 text-stone-400">
              Short-form tools optimize for extraction. Creator is designed
              around the full arc: the setup viewers need, the pacing that keeps
              them watching, and the payoff that makes the video feel authored.
            </p>
          </div>
          <div className="mt-16 grid gap-px bg-stone-800 lg:grid-cols-4">
            {proofPoints.map(([title, copy]) => (
              <article className="min-h-72 bg-[#11110f] p-7" key={title}>
                <h3 className="text-4xl font-semibold tracking-[-0.06em] text-stone-50">
                  {title}
                </h3>
                <p className="mt-20 leading-7 text-stone-400">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-stone-800 px-5 py-24 text-center sm:px-8 lg:py-32">
        <p className="mx-auto max-w-4xl text-5xl font-semibold tracking-[-0.065em] text-stone-50 sm:text-7xl">
          Play the match. Keep the story. Ship the video.
        </p>
        <p className="mx-auto mt-8 max-w-2xl text-lg leading-8 text-stone-400">
          Open the current Creator prototype and review the production interface
          that informed this landing page.
        </p>
        <div className="mt-10">
          <OpenCreatorLink>Open Creator</OpenCreatorLink>
        </div>
      </section>

      <footer className="border-t border-stone-800 px-5 py-10 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 text-sm text-stone-500 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-semibold tracking-[0.28em] text-stone-100">
              Creator
            </p>
            <p className="mt-3">
              Premium long-form video production for gaming creators.
            </p>
            <p className="mt-1">Built by Framepath.</p>
          </div>
          <a
            className="transition hover:text-stone-100"
            href="mailto:contact@framepath.com"
          >
            Contact
          </a>
        </div>
      </footer>
    </main>
  );
}
