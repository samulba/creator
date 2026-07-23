import { cx } from "./cx";

export type StageState = "done" | "current" | "upcoming";

export type Stage = {
  label: string;
  state: StageState;
  /** Optional right-aligned detail, e.g. elapsed time on the current stage. */
  detail?: string;
};

/**
 * Semantic production progress as a connected vertical timeline — named stages
 * instead of fake percentages (docs/PROCESSING_EXPERIENCE.md). The active node
 * glows; completed connectors fill with the accent.
 */
export function StageList({ stages }: { stages: Stage[] }) {
  return (
    <ol className="relative">
      {stages.map((stage, index) => {
        const isLast = index === stages.length - 1;
        return (
          <li key={stage.label} className="flex gap-4">
            {/* Node + connector column */}
            <div className="flex flex-col items-center">
              <span
                aria-hidden="true"
                className={cx(
                  "flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border transition-colors",
                  stage.state === "done" &&
                    "border-accent/50 bg-accent/15 text-accent",
                  stage.state === "current" &&
                    "pulse-ring border-info bg-info/15 text-info",
                  stage.state === "upcoming" &&
                    "border-edge-strong bg-surface text-ink-muted",
                )}
              >
                {stage.state === "done" ? (
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
                    <path
                      d="M3.5 8.5l3 3 6-6.5"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <span
                    className={cx(
                      "rounded-full",
                      stage.state === "current"
                        ? "h-2 w-2 bg-info"
                        : "h-1.5 w-1.5 bg-ink-muted/50",
                    )}
                  />
                )}
              </span>
              {!isLast ? (
                <span
                  aria-hidden="true"
                  className={cx(
                    "my-1 w-px flex-1",
                    stage.state === "done" ? "bg-accent/40" : "bg-edge",
                  )}
                />
              ) : null}
            </div>

            {/* Label */}
            <div
              className={cx(
                "flex min-w-0 flex-1 items-start justify-between gap-3 pt-0.5",
                isLast ? "pb-0" : "pb-6",
              )}
            >
              <span
                className={cx(
                  "text-sm leading-6",
                  stage.state === "current" && "font-semibold text-ink",
                  stage.state === "done" && "text-ink-secondary",
                  stage.state === "upcoming" && "text-ink-muted",
                )}
              >
                {stage.label}
              </span>
              {stage.state === "current" ? (
                <span className="tabular shrink-0 font-mono text-xs text-info">
                  {stage.detail ?? "In progress"}
                </span>
              ) : stage.detail ? (
                <span className="tabular shrink-0 font-mono text-xs text-ink-muted">
                  {stage.detail}
                </span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
