"use client";

import { useEffect, useRef, useState } from "react";

import { cx } from "@/components/ui/cx";

type Stage = {
  label: string;
  title: string;
  copy: string;
  detail: string;
};

const stages: Stage[] = [
  {
    label: "Raw gameplay",
    title: "The full match stays intact.",
    copy: "Creator starts with the recording you already have — including the quiet stretches that make the payoff land.",
    detail: "Source 01:12:44 · uncut",
  },
  {
    label: "Understand",
    title: "Footage becomes structured context.",
    copy: "Match events, momentum shifts, and candidate moments are mapped before anything is cut.",
    detail: "37 events · 12 moments",
  },
  {
    label: "Story",
    title: "An angle emerges from the match.",
    copy: "Hook, escalation, turning point, and payoff — built around what actually happened.",
    detail: "Angle: pressure into reversal",
  },
  {
    label: "Narrate",
    title: "Narration written against the timeline.",
    copy: "Voiceover adds tension and rhythm instead of repeating what viewers can already see.",
    detail: "6 timestamped sections",
  },
  {
    label: "Edit",
    title: "Pacing makes it watchable.",
    copy: "Dead time removed, key moments preserved, audio balanced for long-form viewing.",
    detail: "Timeline 12:48",
  },
  {
    label: "Final video",
    title: "A finished production, ready to review.",
    copy: "Chapters, narration, edit decisions, and a render you can inspect before approval.",
    detail: "Ready for review · v01",
  },
];

/**
 * Scroll-telling section: the panel pins to the viewport while scrolling
 * through it drives the active stage. Scroll position maps linearly onto
 * the stage index, so scrubbing back and forth replays the sequence.
 */
export function ScrollStory() {
  const sectionRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const [stageProgress, setStageProgress] = useState(0);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = section.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      if (scrollable <= 0) return;
      const progress = Math.min(Math.max(-rect.top / scrollable, 0), 1);
      const position = Math.min(
        progress * stages.length,
        stages.length - 0.0001,
      );
      setActive(Math.floor(position));
      setStageProgress(position % 1);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      id="workflow"
      className="relative border-y border-edge bg-surface"
      style={{ height: `${stages.length * 90 + 60}vh` }}
    >
      <div className="sticky top-0 flex h-screen flex-col justify-center overflow-hidden px-5 sm:px-8">
        <div className="mx-auto w-full max-w-6xl">
          <div className="flex items-end justify-between gap-6">
            <div>
              <p className="text-xs font-semibold tracking-[0.3em] text-accent uppercase">
                The workflow
              </p>
              <h2 className="mt-4 max-w-xl text-3xl font-semibold tracking-[-0.04em] text-ink sm:text-5xl">
                From raw match to finished video.
              </h2>
            </div>
            <p className="tabular hidden font-mono text-sm text-ink-muted sm:block">
              {String(active + 1).padStart(2, "0")} /{" "}
              {String(stages.length).padStart(2, "0")}
            </p>
          </div>

          <div className="mt-10 grid gap-10 lg:mt-14 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-16">
            <ol className="hidden lg:block" aria-hidden="true">
              {stages.map((stage, index) => (
                <li
                  key={stage.label}
                  className="relative border-l border-edge py-2.5 pl-5"
                >
                  {index === active ? (
                    <span
                      className="absolute top-0 left-[-1px] w-px bg-accent transition-none"
                      style={{ height: `${stageProgress * 100}%` }}
                    />
                  ) : null}
                  {index < active ? (
                    <span className="absolute top-0 left-[-1px] h-full w-px bg-accent/50" />
                  ) : null}
                  <span
                    className={cx(
                      "text-sm transition-colors duration-300",
                      index === active
                        ? "font-medium text-ink"
                        : index < active
                          ? "text-ink-secondary"
                          : "text-ink-muted",
                    )}
                  >
                    {stage.label}
                  </span>
                </li>
              ))}
            </ol>

            <div className="relative min-h-[300px] sm:min-h-[280px]">
              {stages.map((stage, index) => (
                <article
                  key={stage.label}
                  className={cx(
                    "absolute inset-0 transition-[opacity,transform] duration-500 ease-out",
                    index === active
                      ? "translate-y-0 opacity-100"
                      : index < active
                        ? "pointer-events-none -translate-y-4 opacity-0"
                        : "pointer-events-none translate-y-4 opacity-0",
                  )}
                >
                  <p className="text-xs font-semibold tracking-[0.24em] text-accent uppercase lg:hidden">
                    {stage.label}
                  </p>
                  <h3 className="mt-4 max-w-2xl text-3xl font-semibold tracking-[-0.04em] text-ink sm:text-4xl lg:mt-0">
                    {stage.title}
                  </h3>
                  <p className="mt-5 max-w-xl text-lg leading-8 text-ink-secondary">
                    {stage.copy}
                  </p>
                  <p className="tabular mt-8 inline-block border border-edge bg-canvas px-4 py-2.5 font-mono text-sm text-ink-secondary">
                    <span className="mr-3 inline-block h-2 w-2 bg-accent align-baseline" />
                    {stage.detail}
                  </p>
                </article>
              ))}
            </div>
          </div>

          <div className="mt-12 flex gap-1.5 lg:hidden" aria-hidden="true">
            {stages.map((stage, index) => (
              <span
                key={stage.label}
                className={cx(
                  "h-0.5 flex-1 transition-colors duration-300",
                  index <= active ? "bg-accent" : "bg-edge",
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
