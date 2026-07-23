import type { ReactNode } from "react";

const productionStages = [
  { label: "Upload", value: "GAMEPLAY_042.mp4", state: "Ready" },
  { label: "Understand", value: "Match structure mapped", state: "Complete" },
  { label: "Story", value: "Endgame comeback angle", state: "Complete" },
  { label: "Narration", value: "Script synced to timeline", state: "Review" },
  { label: "Edit", value: "Pacing pass in progress", state: "72%" },
] as const;

const timelineMoments = [
  { time: "00:42", label: "Setup", detail: "First chase establishes the pressure." },
  { time: "04:18", label: "Turn", detail: "A risky rescue changes the match." },
  { time: "08:56", label: "Payoff", detail: "The final escape resolves the story." },
] as const;

const productionWork = [
  "reviewing footage",
  "finding key moments",
  "identifying the real story",
  "writing narration",
  "cutting dead time",
  "shaping pacing",
  "mixing audio",
  "polishing final output",
] as const;

const journeySteps = [
  {
    number: "01",
    title: "Upload gameplay",
    body: "Start with the recordings you already have. Creator treats the source footage as the master asset, not disposable clip fuel.",
    rail: "RAW",
  },
  {
    number: "02",
    title: "Creator understands what happened",
    body: "The match is converted into usable production context: events, decisions, momentum shifts, and moments worth revisiting.",
    rail: "CONTEXT",
  },
  {
    number: "03",
    title: "The story takes shape",
    body: "A narrative direction, pacing map, and narration plan are built around the real gameplay instead of generic highlight logic.",
    rail: "STORY",
  },
  {
    number: "04",
    title: "The final video is produced",
    body: "The edit, narration, audio balance, and render plan come together as a reviewable long-form production workflow.",
    rail: "VIDEO",
  },
] as const;

const featureGroups = [
  [
    "Gameplay Intelligence",
    "Understands match flow, important events, mistakes, chases, rescues, and turning points before the edit begins.",
  ],
  [
    "Story Direction",
    "Finds what the video is actually about, so the finished piece has setup, escalation, and payoff.",
  ],
  [
    "Context-Aware Narration",
    "Creates narration that supports the viewer’s understanding without flattening strong gameplay moments.",
  ],
  [
    "Intelligent Editing",
    "Cuts dead time and builds pace while preserving moments that need room to breathe.",
  ],
  [
    "Audio & Rendering",
    "Connects voice, gameplay audio, timing, and final output in one production pass.",
  ],
  [
    "Reviewable Output",
    "Keeps production decisions visible so the result can be checked before final delivery.",
  ],
] as const;

const storyFlow = ["RAW GAMEPLAY", "UNDERSTAND", "STORY", "NARRATION", "EDIT", "FINAL VIDEO"] as const;

function ButtonLink({ href, children, variant = "primary" }: { href: string; children: ReactNode; variant?: "primary" | "secondary" }) {
  return (
    <a className={`button-link button-link--${variant}`} href={href}>
      <span>{children}</span>
      <span aria-hidden="true">→</span>
    </a>
  );
}

function ProductConsole() {
  return (
    <div className="product-console" aria-label="Creator production workflow preview">
      <div className="console-topbar">
        <div>
          <p className="console-kicker">Creator production</p>
          <p className="console-title">Long-form YouTube edit</p>
        </div>
        <div className="console-status">Processing</div>
      </div>

      <div className="console-body">
        <section className="source-monitor" aria-label="Gameplay preview">
          <div className="monitor-frame">
            <div className="monitor-vignette" />
            <div className="playhead-block">
              <span>GAMEPLAY_042.mp4</span>
              <strong>18:43</strong>
            </div>
          </div>
          <div className="monitor-strip" aria-hidden="true">
            {Array.from({ length: 16 }).map((_, index) => (
              <span key={index} style={{ height: `${28 + (index % 5) * 8}px` }} />
            ))}
          </div>
        </section>

        <section className="production-panel" aria-label="Production state">
          <div className="progress-ring" aria-label="72 percent complete">
            <span>72</span>
            <small>%</small>
          </div>
          <div className="stage-list">
            {productionStages.map((stage) => (
              <article className="stage-row" key={stage.label}>
                <div>
                  <p>{stage.label}</p>
                  <span>{stage.value}</span>
                </div>
                <strong>{stage.state}</strong>
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="timeline-editor" aria-label="Edit timeline preview">
        {timelineMoments.map((moment) => (
          <article key={moment.time}>
            <span>{moment.time}</span>
            <div>
              <strong>{moment.label}</strong>
              <p>{moment.detail}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="marketing-shell">
      <header className="site-header">
        <nav aria-label="Main navigation" className="site-nav">
          <a className="brand-mark" href="#top">CREATOR</a>
          <div className="nav-links">
            <a href="#how-it-works">How it works</a>
            <a href="#features">Features</a>
            <a href="#workflow">Workflow</a>
            <a href="#why-creator">Why Creator</a>
          </div>
          <a className="header-cta" href="/app">Open Creator</a>
        </nav>
      </header>

      <section className="hero-section" id="top">
        <div className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">VIDEO PRODUCTION FOR GAMING CREATORS</p>
            <h1>Your gameplay already has the content. Creator turns it into the video.</h1>
            <p className="hero-lede">
              Creator understands your footage, finds the story, builds the narration, creates the edit, and turns raw gameplay into polished long-form YouTube videos.
            </p>
            <div className="hero-actions">
              <ButtonLink href="/app">Open Creator</ButtonLink>
              <ButtonLink href="#workflow" variant="secondary">Follow the workflow</ButtonLink>
            </div>
          </div>
          <ProductConsole />
        </div>
      </section>

      <section className="problem-section" aria-labelledby="problem-heading">
        <div className="section-index">01 / The work between record and publish</div>
        <div className="problem-grid">
          <div>
            <h2 id="problem-heading">Recording gameplay is easy. Turning it into a great video isn’t.</h2>
            <p>
              Long-form videos demand judgment. The best moments need context, the slow parts need restraint, and the final edit has to feel intentionally built.
            </p>
          </div>
          <div className="production-burden" aria-label="Manual production tasks">
            {productionWork.map((item, index) => (
              <div className="burden-row" key={item}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>{item}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="problem-close">Creator turns that entire production process into one connected workflow.</p>
      </section>

      <section className="journey-section" id="how-it-works" aria-labelledby="journey-heading">
        <div className="journey-heading">
          <p className="section-index">02 / Transformation path</p>
          <h2 id="journey-heading">From raw gameplay to finished video.</h2>
        </div>
        <div className="journey-list">
          {journeySteps.map((step) => (
            <article className="journey-step" key={step.number}>
              <span className="journey-number">{step.number}</span>
              <div className="journey-main">
                <p className="journey-rail">{step.rail}</p>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="features-section" id="features" aria-labelledby="features-heading">
        <div className="features-intro">
          <p className="section-index">03 / Connected production system</p>
          <h2 id="features-heading">One production pipeline. Every decision connected.</h2>
        </div>
        <div className="feature-board">
          {featureGroups.map(([title, body], index) => (
            <article className="feature-slice" key={title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="differentiator-section" id="why-creator" aria-labelledby="different-heading">
        <div className="differentiator-copy">
          <p className="section-index">04 / Built for the harder format</p>
          <h2 id="different-heading">Not another AI clip generator.</h2>
          <p>
            Most automated video tools are built around short clips, captions, and recycled social content.
          </p>
          <p>
            Creator is being built for something harder: long-form YouTube videos where context, pacing, storytelling, and payoff actually matter.
          </p>
        </div>
        <div className="differentiator-words" aria-label="Creator differentiators">
          {['CONTEXT', 'STORY', 'PACING', 'PAYOFF'].map((word) => (
            <strong key={word}>{word}</strong>
          ))}
        </div>
      </section>

      <section className="workflow-story" id="workflow" aria-labelledby="workflow-heading">
        <div className="workflow-sticky">
          <p className="section-index">05 / Scroll the production line</p>
          <h2 id="workflow-heading">A production line for story-driven gameplay.</h2>
          <p>
            The page follows the same transformation the product is designed around: raw footage becomes context, context becomes story, story becomes narration, narration informs the edit, and the edit becomes the final video.
          </p>
        </div>
        <div className="workflow-scroll" aria-label="Creator production workflow">
          {storyFlow.map((stage, index) => (
            <article className="workflow-card" key={stage}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{stage}</h3>
              <div aria-hidden="true" className="workflow-line" />
            </article>
          ))}
        </div>
      </section>

      <section className="final-cta" aria-labelledby="final-heading">
        <p className="section-index">Open the product</p>
        <h2 id="final-heading">Play the game. Let Creator handle the production.</h2>
        <p>Turn the gameplay you already record into videos worth watching.</p>
        <ButtonLink href="/app">Open Creator</ButtonLink>
      </section>

      <footer className="site-footer">
        <div>
          <p className="footer-brand">Creator</p>
          <p>Video production for gaming creators.</p>
          <p>Built by Framepath.</p>
        </div>
        <div>
          <a href="/privacy">Privacy</a>
          <a href="mailto:contact@framepath.com">Contact</a>
        </div>
      </footer>
    </main>
  );
}
